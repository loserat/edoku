const test = require('node:test'), assert = require('node:assert/strict');
const { fragment } = require('../src/api/knowledgeSchemas');
const knowledge = require('../services/knowledgeService');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const subject = { kind: 'requirement', requirementId: 'manual' };
const fact = (key, status, value, extra = {}) => fragment.parse({ subject, key, status, ...(value !== undefined ? {value} : {}), ...extra });
const requirements = [
  { id:'manual',title:'Passende Montageanleitung',category:'Bedienungsanleitungen',dependsOn:[{subject,key:'system'}] },
  { id:'proof',title:'Zugehöriger Systemnachweis',category:'Brandschutz',dependsOn:[{subject,key:'system'}] },
  { id:'execution',title:'Tatsächliche Ausführung',category:'Nachweise',dependsOn:[{subject,key:'wallThicknessMm'}] }
];
const workspace = () => ({ projekt:{},leistungsbereiche:{aktiv:['X']},brandschutz:[],projektSysteme:[],geraetelisten:[{id:'list',aktiv:true,leistungsbereich:'X',positionen:[{pos:1,hersteller:'A',typ:'Model A'}]}] });
const job = () => ({id:'job_test',requirements:structuredClone(requirements),questions:[],documents:[]});
function append(data, current, facts, quote='Tatsächlicher synthetischer Benutzerbeleg') {
  const result=knowledge.appendFragments(data,current,facts,{sourceLabel:'Synthetischer Benutzerchat',sourceQuote:quote},'decision_test','alice');data.projekt.assistantFacts=result.records;return result;
}
test('Informationsgewinn: gemeinsame Systemidentität entsperrt zwei Aufgaben vor einem einzelnen Maß',()=>{
  const d=workspace(),j=job(),state=knowledge.buildKnowledge(d,j);
  assert.equal(state.questions[0].target.key,'system');assert.equal(state.questions[0].unlocks,2);
  assert.equal(state.questions[0].immediatelyUnblocks,2);assert.equal(state.summary.blockedTasks,3);
  append(d,j,[fact('system','confirmed','M21-S90')],'M21-S90');
  const next=knowledge.buildKnowledge(d,j);assert.equal(next.summary.readyTasks,2);assert.equal(next.questions[0].target.key,'wallThicknessMm');
});
test('Alle von der Brandschutzregel gelieferten Faktenziele sind im aktuellen Vertrag gültig',()=>{
  const d=workspace();d.leistungsbereiche.aktiv=['Brandschutzabschottungen'];const j=job();j.requirements=require('../services/firestopDocumentationService').firestopRequirements(d).map(row=>row.definition);
  const state=knowledge.buildKnowledge(d,j);for(const f of state.facts)assert.doesNotThrow(()=>require('../src/api/knowledgeSchemas').ref.parse({subject:f.subject,key:f.key}));
  assert.ok(state.facts.some(row=>row.key==='ausfuehrungsdatum'));
  d.projektSysteme=[{aktiv:true,leistungsbereich:'Brandschutzabschottungen',hersteller:'Hersteller',herstellerSystem:'Kabelabschottung'}];j.requirements=require('../services/firestopDocumentationService').firestopRequirements(d).map(row=>row.definition);
  assert.ok(knowledge.buildKnowledge(d,j).facts.filter(row=>row.key==='system').every(row=>row.state!=='confirmed'));
});
test('Widersprüche werden nicht überschrieben; belegte Korrektur erhält die Originalfragmente',()=>{
  const d=workspace(),j=job();append(d,j,[fact('wallThicknessMm','confirmed',300)],'300');append(d,j,[fact('wallThicknessMm','confirmed',400)],'400');
  let current=knowledge.resolveFact(d,j,{subject,key:'wallThicknessMm'});assert.equal(current.state,'conflict');assert.equal(current.value,undefined);
  assert.equal(knowledge.buildKnowledge(d,j).questions[0].state,'conflict');
  append(d,j,[fact('wallThicknessMm','confirmed',300,{supersedes:current.fragmentIds,reason:'Benutzer korrigiert die falsche Angabe ausdrücklich.'})],'Richtig sind 300 mm.');
  current=knowledge.resolveFact(d,j,{subject,key:'wallThicknessMm'});assert.equal(current.state,'confirmed');assert.equal(current.value,300);assert.equal(d.projekt.assistantFacts.length,3);
});
test('300 mm bleibt unzugeordnet bis zur ausdrücklichen Zuordnung; weder Wand noch Schott wird geraten',()=>{
  const d=workspace(),j=job();append(d,j,[fact('unassigned','ambiguous','300 mm')],'300 mm');
  const ambiguous=knowledge.resolveFact(d,j,{subject,key:'unassigned'});assert.equal(knowledge.resolveFact(d,j,{subject,key:'wallThicknessMm'}).state,'unknown');
  append(d,j,[fact('wallThicknessMm','confirmed',300,{supersedes:ambiguous.fragmentIds,reason:'Benutzer ordnet 300 mm ausdrücklich der Wanddicke zu.'})],'300 mm, auf die Wanddicke');
  assert.equal(knowledge.resolveFact(d,j,{subject,key:'unassigned'}).state,'resolved');assert.equal(knowledge.resolveFact(d,j,{subject,key:'wallThicknessMm'}).value,300);
  assert.equal(knowledge.resolveFact(d,j,{subject,key:'sealDepthMm'}).state,'unknown');assert.equal(d.projekt.assistantFacts.length,2);
});
test('Vermutung, Dummy und Zurückstellung entsperren keine Aufgabe; geänderte Geräte übernehmen keine alten Fakten',()=>{
  const d=workspace(),j=job();append(d,j,[fact('system','inferred','M21-S90',{origin:'research',sourceUrl:'https://manufacturer.example/product'})]);
  assert.equal(knowledge.buildKnowledge(d,j).summary.readyTasks,0);
  append(d,j,[fact('wallThicknessMm','deferred',undefined)]);assert.ok(!knowledge.buildKnowledge(d,j).questions.some(row=>row.target.key==='wallThicknessMm'));
  d.projekt.ausfuehrendeFirma='DUMMY – Musterfirma';assert.equal(knowledge.resolveFact(d,j,{subject:{kind:'project'},key:'ausfuehrendeFirma'}).state,'unknown');
  const device={kind:'device',listId:'list',position:1};append(d,j,[fragment.parse({subject:device,key:'sealDepthMm',value:170,status:'confirmed'})]);d.geraetelisten[0].positionen[0].typ='Model B';
  assert.equal(knowledge.resolveFact(d,j,{subject:device,key:'sealDepthMm'}).state,'stale');
  assert.throws(()=>fact('wallThicknessMm','confirmed','300mm'));
  assert.throws(()=>fact('system','confirmed','M21-S90',{origin:'research',sourceUrl:'https://manufacturer.example/product'}));
  assert.throws(()=>fragment.parse({subject:{kind:'project',entryId:'foreign'},key:'system',status:'unknown'}));
});
test('Vorhandene Antworten werden vor einer erneuten Benutzerfrage gezielt zur Strukturierung angeboten',()=>{
  const d=workspace(),j=job();j.questions=[{id:'old',prompt:'Welches System?',answer:'M21-S90',targets:[{kind:'requirement',requirementId:'manual'}]}];
  const state=knowledge.buildKnowledge(d,j);assert.deepEqual(state.questions[0].legacyQuestionIds,['old']);
  append(d,j,[fact('system','confirmed','M21-S90')],'M21-S90');assert.ok(!knowledge.buildKnowledge(d,j).questions.some(row=>row.target.key==='system'));
});
test('Bestätigte Komponenten ermöglichen Recherche; ein Ergebnis bleibt vor Einbaubestätigung eine Vermutung',()=>{
  const d=workspace(),j=job();append(d,j,[fact('components','confirmed',['ZZ 217','ZZ 330']),fact('manufacturer','confirmed','ZAPP-ZIMMERMANN')],'ZZ217 und ZZ330 von ZAPP-ZIMMERMANN');
  let q=knowledge.buildKnowledge(d,j).questions[0];assert.equal(q.target.key,'system');assert.equal(q.researchInputs.length,2);
  append(d,j,[fact('system','inferred','ZZ M21-S90',{origin:'research',sourceUrl:'https://manufacturer.example/system'})],'Hersteller-Systemzuordnung');
  q=knowledge.buildKnowledge(d,j).questions[0];assert.equal(q.state,'inferred');assert.equal(q.researchInputs.length,0);assert.match(q.prompt,/ZZ M21-S90/);
  const missing=workspace();append(missing,j,[fact('components','confirmed',['Unklarer Stein'])],'Unklarer Stein');append(missing,j,[fact('system','unknown',undefined,{origin:'research',sourceUrl:'https://manufacturer.example/catalog',reason:'Herstellerkatalog liefert keine eindeutige Zuordnung.'})],'Keine eindeutige Systemzuordnung');assert.equal(knowledge.buildKnowledge(missing,j).questions[0].researchInputs.length,0);
});
test('Lange vorhandene Felder bleiben erhalten und werden für kompakte Antworten kenntlich gekürzt',()=>{
  const d=workspace(),j=job();d.projekt.baumassnahme='L'.repeat(20000);
  const full=knowledge.resolveFact(d,j,{subject:{kind:'project'},key:'baumassnahme'}),compact=knowledge.publicFact(full);
  assert.equal(compact.value.length,300);assert.equal(compact.valueTruncated,true);assert.equal(d.projekt.baumassnahme.length,20000);assert.equal(full.value.length,20000);
});
test('Primärfelder werden durch ein Fragment nicht überschrieben; Ersatz braucht ausdrückliche Korrektur',()=>{
  const d=workspace(),j=job(),p={kind:'project'};d.projekt.auftraggeber='Bisherige Firma';
  append(d,j,[fragment.parse({subject:p,key:'auftraggeber',value:'Neue Firma',status:'confirmed'})],'Neue Firma');
  assert.equal(knowledge.resolveFact(d,j,{subject:p,key:'auftraggeber'}).state,'conflict');assert.equal(d.projekt.auftraggeber,'Bisherige Firma');
  append(d,j,[fragment.parse({subject:p,key:'auftraggeber',value:'Neue Firma',status:'confirmed',replaceStored:true,reason:'Benutzer beauftragt ausdrücklich die Änderung der Firma.'})],'Bitte Auftraggeber in Neue Firma ändern.');
  const result=knowledge.resolveFact(d,j,{subject:p,key:'auftraggeber'});assert.equal(result.state,'confirmed');assert.equal(result.needsApplication,true);assert.equal(d.projekt.auftraggeber,'Bisherige Firma');
});
test('Echte API/MCP: Fragmente atomar, versioniert und paginiert speichern; präzise Fragen und unabhängige Arbeit',async()=>{
  const f=await fixture({setup:async({root})=>{
    const files=require('../services/projectArchiveService').dataFilesForProject(root,'alice','same');
    await require('../services/projectDataStoreService').withProjectDataTransaction(async()=>{
      const json=require('../services/jsonService');
      await json.writeJson(files.leistungsbereiche,{aktiv:['Elektroinstallation / DIN VDE 0100'],optionen:['Elektroinstallation / DIN VDE 0100']});
      const lists=await json.readJson(files.geraetelisten,[]);lists[0].aktiv=true;lists[0].export=true;await json.writeJson(files.geraetelisten,lists);
    });
  }}),token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true);
  const base='/projects/same',request=(url,options={})=>f.request(url,{token,...options});let sequence=0;
  try{
    const created=await request(base+'/assistant/jobs',{method:'POST',body:{instruction:'Synthetische Informationsfragmente und gezielte Abhängigkeiten testen.',requirements:[...requirements,{id:'independent',title:'Unabhängiges Originalprotokoll',category:'Messprotokolle'}]}});
    assert.equal(created.status,201);const j=created.data.data,path=base+'/assistant/jobs/'+j.id;
    const jobCount=f.db.prepare('SELECT count(*) n FROM documentation_jobs').get().n;
    const invalid=await request(base+'/assistant/jobs',{method:'POST',body:{instruction:'Ungültige fremde Abhängigkeit darf keinen Auftrag erzeugen.',requirements:[{id:'invalid',title:'Ungültiger Bezug',category:'Nachweise',dependsOn:[{subject:{kind:'requirement',requirementId:'foreign'},key:'system'}]}]}});assert.equal(invalid.status,409);assert.equal(f.db.prepare('SELECT count(*) n FROM documentation_jobs').get().n,jobCount);
    const narrow=f.makeToken('alice',{scopes:['assistant:write']}).token;
    assert.equal((await f.request(base+'/assistant/jobs',{token:narrow,method:'POST',body:{instruction:'Abhängigkeiten ohne erforderliche Leserechte verweigern.',requirements}})).status,403);
    const snapshot=(await request(base)).etag;
    await client.initialize();
    const call=async(name,args)=>{const r=(await client.rpc('tools/call',{name,arguments:args})).result;assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent.data;};
    let plan=await call('edoku_next_action',{projectId:'same',jobId:j.id});assert.equal(plan.execution.action,'continue');assert.notEqual(plan.nextAction.code,'ASK_TARGETED_QUESTION');
    const full=(await request(base+'/next-action?jobId='+j.id+'&view=full&limit=10')).data.data;
    const targeted=full.agentActions.items.find(t=>t.code==='ASK_TARGETED_QUESTION'&&t.target.key==='system');assert.ok(targeted);
    assert.ok(Buffer.byteLength(JSON.stringify(plan))<7168);
    const question=await call('edoku_ask_question',{projectId:'same',jobId:j.id,input:{version:plan.jobVersion,question:targeted.question}});assert.equal(question.created,true);
    const waiting=(await request(base+'/next-action?jobId='+j.id+'&view=full&limit=10')).data.data;
    assert.ok(waiting.agentActions.items.some(row=>row.target?.requirementId==='independent'));
    const post=async(facts,quote='M21-S90',extra={})=>{
      const p=(await request(base+'/next-action?jobId='+j.id+'&view=compact')).data.data;
      return request(path+'/decisions',{method:'POST',headers:{'If-Match':p.projectETag,'Idempotency-Key':'knowledge_'+(++sequence)},body:{jobVersion:p.jobVersion,evidence:{sourceLabel:'Synthetischer Benutzerchat',sourceQuote:quote},facts,...extra}});
    };
    const result=await post([fact('system','confirmed','M21-S90')]);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.data.receipt.savedFacts,1);
    const summary=await call('edoku_knowledge',{projectId:'same',jobId:j.id});assert.equal(summary.summary.readyTasks,2);
    assert.ok((await call('edoku_knowledge',{projectId:'same',jobId:j.id,section:'schema'})).keys.includes('sealDepthMm'));
    const page=await call('edoku_knowledge',{projectId:'same',jobId:j.id,section:'facts',limit:1});assert.equal(page.items.length,1);assert.ok(page.total>=2);
    const id=knowledge.factId({subject,key:'system'}),history=await call('edoku_knowledge',{projectId:'same',jobId:j.id,section:'history',factId:id,limit:1});assert.equal(history.items[0].evidence.sourceQuote,'M21-S90');
    assert.equal(result.data.data.receipt.savedAnswers,1);
    const stale=await request(path+'/questions',{method:'POST',body:{version:result.data.data.plan.jobVersion,question:targeted.question}});assert.equal(stale.status,409);assert.equal(stale.data.error.code,'FACT_STATE_CHANGED');
    const before=(await request(base)).etag;
    const failed=await post([fact('wallThicknessMm','confirmed',300),fragment.parse({subject:{kind:'requirement',requirementId:'foreign'},key:'system',status:'confirmed',value:'X'})]);assert.equal(failed.status,409);assert.equal((await request(base)).etag,before);
    const rolledBack=await post([fact('wallThicknessMm','confirmed',300)],'300',{answers:[{questionId:'missing_question',answer:'300',disposition:'confirmed'}]});assert.equal(rolledBack.status,409);assert.equal((await request(base)).etag,before);
    assert.equal((await call('edoku_knowledge',{projectId:'same',jobId:j.id,section:'history',factId:knowledge.factId({subject,key:'wallThicknessMm'})})).total,0);
    const bob=f.makeToken('bob',{scopes}).token;assert.equal((await f.request(path+'/knowledge',{token:bob})).status,404);
    assert.notEqual((await request(base)).etag,snapshot);
    const jobAfter=(await request(path)).data.data;assert.equal(jobAfter.documents.length,0);assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
    assert.equal((await request(path+'/knowledge?section=history')).status,400);
    const linked=await request(path,{method:'PATCH',body:{requirements:[{id:'native_dependency',title:'Anforderung mit vorhandenem Gerätebezug',category:'Nachweise',dependsOn:[{subject:{kind:'device',listId:'devices',position:1},key:'typ'}]}]}});assert.equal(linked.status,200,JSON.stringify(linked.data));
    const preview=await request(base+'/deletions/preview?kind=device&listId=devices&position=1');assert.equal(preview.status,200);assert.ok(preview.data.data.blockers.some(row=>row.kind==='requirement'&&row.id==='native_dependency'));
  }finally{await client.close();await f.cleanup();}
});
