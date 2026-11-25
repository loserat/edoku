const crypto = require('node:crypto');
const { parse, fault } = require('../src/api/validation');
const { detailQuery, decisionInput, decisionQuery } = require('../src/api/agentSchemas');
const { createDocumentAssistantService } = require('./documentAssistantService');
const { createDocumentWorkService } = require('./documentWorkService');
const { createIntegrationService } = require('./integrationService');
const store = require('./projectDataStoreService');
const { readJson, writeJson } = require('./jsonService');
const knowledge = require('./knowledgeService');
const { loadProjectWorkspace } = require('./projectWorkspaceService');
const MAX_READ_BYTES = 32768;
function bounded(value, maxBytes = 7168) {
  if (Buffer.byteLength(JSON.stringify(value),'utf8') > maxBytes) throw fault('Antwort zu groß. Kleinere Seite, section oder entryId gezielt angeben; keine unveränderte Wiederholung.',413,'RESPONSE_LIMIT');
  return value;
}
function detail(job, query) {
  const q=parse(detailQuery,query);
  if(q.view==='full'&&q.section==='summary') return bounded(job,31744);
  const result={id:job.id,projectId:job.projectId,version:job.version,status:job.status,counts:{questions:job.questions.length,openQuestions:job.questions.filter(x=>!x.answer&&!x.obsolete).length,requirements:job.requirements.length,documents:job.documents.reduce((n,x)=>(n[x.state]=(n[x.state]||0)+1,n),{})}};
  if(q.section==='summary') return result;
  if(['instruction','message'].includes(q.section)) { const text=job[q.section]||'',total=Math.ceil(text.length/1000);return bounded({...result,section:q.section,items:Array.from({length:Math.max(0,Math.min(q.limit,total-q.offset))},(_,i)=>({index:q.offset+i,text:text.slice((q.offset+i)*1000,(q.offset+i+1)*1000)})),total,limit:q.limit,offset:q.offset}); }
  if(q.section==='question_history') { if(!q.entryId) throw fault('entryId der Rückfrage erforderlich.',400,'VALIDATION_ERROR');const items=job.questions.find(x=>x.id===q.entryId)?.history||[];return bounded({...result,section:q.section,items:items.slice(q.offset,q.offset+q.limit),total:items.length,limit:q.limit,offset:q.offset}); }
  let items=job[q.section]; if(q.entryId) items=items.filter(x=>x.id===q.entryId);
  if(q.section==='questions' && q.history==='false') items=items.map(({history,...rest})=>rest);
  return bounded({...result,section:q.section,items:items.slice(q.offset,q.offset+q.limit),total:items.length,limit:q.limit,offset:q.offset});
}
function createAgentContractService(root) {
  const assistant=createDocumentAssistantService(root), work=createDocumentWorkService(root), integration=createIntegrationService(root);
  async function capture(auth,projectId,jobId,etag,raw,{onCommit}={}) {
    const value=parse(decisionInput,raw);
    if(Buffer.byteLength(JSON.stringify(value))>6144)throw fault('Entscheidungspaket zu groß (maximal 6 KiB). Kleinere fachlich zusammengehörige Pakete verwenden.',413,'DECISION_INPUT_LIMIT');
    return integration.mutate(auth,projectId,etag,async files=>{
      const job=assistant.get(auth.user.id,jobId);
      if(job.projectId!==projectId) throw fault('Auftrag wurde nicht gefunden.',404,'NOT_FOUND');
      assistant.assertVersion(auth.user.id,jobId,value.jobVersion);
      if(job.status==='closed') throw fault('Auftrag ist abgeschlossen.',409,'JOB_CLOSED');
      const project=await readJson(files.projekt,{}),history=project.assistantDecisionHistory||[];
      if(!Array.isArray(history)||history.length>=1000) throw fault('Entscheidungshistorie ungültig oder voll.',409,'DECISION_HISTORY_LIMIT');
      const id='dec_'+crypto.randomBytes(12).toString('hex');
      let savedFacts=0;
      if(value.facts.length) {
        const workspace=await loadProjectWorkspace(root,auth.user.id,projectId);
        const merged=knowledge.appendFragments(workspace,job,value.facts,value.evidence,id,auth.user.id);
        project.assistantFacts=merged.records; savedFacts=merged.added;
        await writeJson(files.projekt,project);
        const state=knowledge.buildKnowledge({...workspace,projekt:project},job);
        const touched=new Set(value.facts.map(knowledge.factId));
        for(const question of job.questions.filter(row=>!row.answer&&!row.obsolete&&row.targets?.length&&row.targets.every(target=>target.kind==='fact'))) {
          if(value.answers.length>=10||value.answers.some(answer=>answer.questionId===question.id)||!question.targets.some(target=>touched.has(knowledge.factId(target))))continue;
          const resolved=question.targets.map(target=>state.facts.find(row=>row.id===knowledge.factId(target)));
          if(resolved.every(row=>row?.state==='confirmed'))value.answers.push({questionId:question.id,answer:resolved.map(row=>`${row.label}: ${Array.isArray(row.value)?row.value.join(', '):row.value}`).join('; ').slice(0,2000),disposition:'confirmed'});
        }
      }
      const seen=new Set(),future=structuredClone(job),decisions=[...value.decisions];
      for(const answer of value.answers) {
        if(seen.has(answer.questionId)) throw fault('Antwort mehrfach angegeben.',400,'VALIDATION_ERROR');
        seen.add(answer.questionId);const q=future.questions.find(x=>x.id===answer.questionId&&!x.obsolete);
        if(!q) throw fault('Aktuelle Rückfrage fehlt.',409,'WORK_TARGET_CHANGED');
        q.answer=answer.answer;
        if(answer.disposition!=='confirmed') decisions.push({target:{kind:'question',questionId:answer.questionId},state:answer.disposition,reason:answer.reason,...(answer.resumeCondition?{resumeCondition:answer.resumeCondition}:{})});
        else decisions.push({target:{kind:'question',questionId:answer.questionId},state:'resume',reason:'Neue ausdrücklich bestätigte Benutzerantwort mit Originalbeleg gespeichert.'});
      }
      const targets=new Set();
      for(const decision of decisions) {
        const key=JSON.stringify(decision.target);if(targets.has(key)) throw fault('Entscheidungsziel mehrfach angegeben.',400,'VALIDATION_ERROR');targets.add(key);
        await work.record(auth,projectId,jobId,etag,{...decision,jobVersion:value.jobVersion,evidence:{kind:'user',...value.evidence}},{fingerprintJob:future});
      }
      // Arbeitsstatus und Originalbeleg bleiben im vorhandenen Projektdokument erhalten.
      const updated=await readJson(files.projekt,{});
      updated.assistantDecisionHistory=[...history,{id,jobId,recordedAt:new Date().toISOString(),recordedBy:auth.user.id,...value}];
      await writeJson(files.projekt,updated);
      store.onProjectDataCommit(()=>{
        assistant.assertVersion(auth.user.id,jobId,value.jobVersion);
        if(value.answers.length) assistant.recordAnswers(auth.user.id,jobId,{version:value.jobVersion,answers:value.answers.map(a=>({questionId:a.questionId,answer:a.answer,evidence:value.evidence}))});
      });
      return {id,jobId,savedAnswers:value.answers.length,savedDecisions:decisions.length,...(value.facts.length?{savedFacts}:{})};
    },{onCommit});
  }
  async function history(auth,projectId,jobId,query) {
    integration.project(auth,projectId);const job=assistant.get(auth.user.id,jobId);
    if(job.projectId!==projectId) throw fault('Auftrag wurde nicht gefunden.',404,'NOT_FOUND');
    const q=parse(decisionQuery,query),project=(await integration.get(auth,projectId)).projekt;
    const items=(project.assistantDecisionHistory||[]).filter(x=>x.jobId===jobId&&(!q.entryId||x.id===q.entryId));
    return bounded({jobId,items:items.slice(q.offset,q.offset+q.limit),total:items.length,limit:q.limit,offset:q.offset});
  }
  async function inspectKnowledge(auth,projectId,jobId,raw) {
    integration.project(auth,projectId);
    const q=parse(require('../src/api/knowledgeSchemas').query,raw);
    return store.withProjectDataTransaction(async()=>{
      const job=assistant.get(auth.user.id,jobId);
      if(job.projectId!==projectId) throw fault('Auftrag wurde nicht gefunden.',404,'NOT_FOUND');
      const data=await loadProjectWorkspace(root,auth.user.id,projectId);
      const state=knowledge.buildKnowledge(data,job,{work:work.current(data,job)});
      const base={projectId,jobId,jobVersion:job.version,projectETag:`"${store.projectDataRevision(root,auth.user.id,projectId)}"`,policy:state.policy,summary:state.summary};
      if(q.section==='schema')return bounded({...base,subjects:['project','device','requirement','firestop'],keys:require('../src/api/knowledgeSchemas').keys,states:['confirmed','inferred','unknown','ambiguous','deferred'],derivedStates:['conflict','stale','resolved','invalid_target'],units:{measurements:'mm',fireResistance:'minutes',installationDate:'YYYY-MM-DD'}});
      if(q.section==='summary')return bounded({...base,nextQuestion:state.questions[0]||null});
      if(q.section==='history'&&!q.factId)throw fault('Historie nur gezielt mit factId lesen.',400,'FACT_ID_REQUIRED');
      let items=q.section==='history'?knowledge.records(data).filter(row=>row.jobId===jobId):state[q.section];
      if(q.factId)items=items.filter(row=>q.section==='dependencies'?row.dependsOn.includes(q.factId):(row.factId||row.id)===q.factId);
      const total=items.length;
      items=items.slice(q.offset,q.offset+q.limit);
      if(q.section==='facts')items=items.map(knowledge.publicFact);
      if(q.section==='history')items=items.map(({inputHash,fingerprint,...row})=>{
        const original=data.projekt.assistantDecisionHistory?.find(item=>item.id===row.decisionId)?.evidence;
        return {...row,evidence:original?{sourceLabel:original.sourceLabel.slice(0,100),sourceQuote:original.sourceQuote.slice(0,160)}:null};
      });
      return bounded({...base,section:q.section,items,total,limit:q.limit,offset:q.offset});
    });
  }
  async function validateDependencies(auth,projectId,incoming,jobId) {
    if(!incoming?.some(row=>row.dependsOn?.length))return;
    if(!['projects:read','devices:read'].every(scope=>auth.token.scopes.includes(scope)))throw fault('Faktenabhängigkeiten benötigen projects:read und devices:read.',403,'FORBIDDEN');
    const existing=jobId?assistant.get(auth.user.id,jobId):{requirements:[]};
    if(jobId&&existing.projectId!==projectId)throw fault('Auftrag wurde nicht gefunden.',404,'NOT_FOUND');
    const data=await loadProjectWorkspace(root,auth.user.id,projectId),merged=new Map(existing.requirements.map(row=>[row.id,row]));
    incoming.forEach(row=>merged.set(row.id,row));
    const future={...existing,requirements:[...merged.values()]};
    incoming.forEach(row=>(row.dependsOn||[]).forEach(target=>knowledge.source(data,future,target.subject)));
  }
  return {capture,history,inspectKnowledge,validateDependencies};
}
module.exports={MAX_READ_BYTES,bounded,detail,createAgentContractService};
