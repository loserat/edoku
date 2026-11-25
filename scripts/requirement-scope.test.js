const {registerFixtureMaterial}=require('./helpers/materialFixture');
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const { setup, area } = require('./helpers/documentationExample');

async function reviewer(f, projectId) {
  const cookies = new Map(); let csrf;
  const request = async (url, options = {}) => {
    const response = await fetch(f.base + url, { redirect: 'manual', ...options, headers: { Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '), ...options.headers } });
    for (const line of response.headers.getSetCookie()) { const p = line.split(';')[0], i = p.indexOf('='); cookies.set(p.slice(0,i), p.slice(i+1)); }
    return response;
  };
  const page = async url => { const response = await request(url); assert.equal(response.status,200); const html = await response.text(); csrf = html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1]; return html; };
  await page('/login');
  assert.equal((await request('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);
  await page('/projekte');
  assert.equal((await request('/projekte/'+projectId+'/oeffnen',{method:'POST',body:new URLSearchParams({_csrf:csrf})})).status,302);
  return { page, request, post: (url,body) => request(url,{method:'POST',body:new URLSearchParams({...body,_csrf:csrf})}) };
}

test('Interne Anforderungen: belegte Ablageentscheidung erhält Originalpflichten, Dateientscheidungen und Versionsschutz', async t => {
  const f = await fixture({setup:async args => {
    await setup(args);
    const p=path.join(args.root,'data/dokumentenmatrix.json'),matrix=JSON.parse(await fs.readFile(p));matrix[0].formularart='Text';await fs.writeFile(p,JSON.stringify(matrix));
  }});
  const key=f.makeToken('alice',{scopes}),client=mcpClient(f.base,key.token,true);
  const request=(url,options={})=>f.request(url,{token:key.token,...options});
  const call=async(name,args)=>{const r=await client.rpc('tools/call',{name,arguments:args});assert.ok(!r.error&&!r.result.isError,JSON.stringify(r));return r.result.structuredContent.data;};
  const evidence={sourceLabel:'Künstlicher Testchat',sourceQuote:'Die Projekttexte bleiben ausschließlich intern. Originalanleitung und Messprotokoll gehören weiter in die Übergabe.'};
  let projectId,jobId,ui,oldProposal,internal;
  const root=()=>'/projects/'+projectId,jobPath=()=>root()+'/assistant/jobs/'+jobId;
  const job=async()=>(await request(jobPath())).data.data;
  const revision=async()=>(await request(root())).etag;
  const status=async()=>(await request(root()+'/documentation-status?assistantJobId='+jobId)).data.data;
  const choose=async(items,extra={})=>request(root()+'/workflow',{method:'POST',headers:{'If-Match':await revision()},body:{jobId,documentScope:'internal',evidence,jobVersion:(await job()).version,requirementScopes:items,...extra}});
  const prepare=async(scope,revisionLabel,supersedes=[])=>call('edoku_prepare_project_document',{projectId,jobId,etag:await revision(),requestId:'scope_draft_'+revisionLabel,input:{title:'Künstlicher Projekttext '+revisionLabel,sourceLabel:'Künstliche Materialliste',reason:'Interne und Kundenablage mit ausdrücklicher Einzelprüfung testen',category:'Nachweise',documentRevision:revisionLabel,requirementIds:['working_text'],supersedes,expectedJobVersion:(await job()).version,content:{scope,...(scope==='documentation'?{documentId:'description'}:{}),sections:[{heading:'Bestätigter Teststand',text:'Nur künstliche Daten. Keine Messung oder Abnahme bestätigt. '+revisionLabel}]}}});
  const approve=async document=>{
    const base='/assistent/auftraege/'+jobId+'/dateien/'+document.id;
    await ui.page(base);await(await ui.request(base+'/inhalt')).arrayBuffer();
    return ui.post(base+'/uebernehmen',{reviewed:'on',sha256:document.sha256,revision:(await revision()).slice(1,-1),title:document.title,category:document.category});
  };
  try {
    await client.initialize();
    projectId=(await call('edoku_create_project',{requestId:'scope_test_project',input:{projektname:'Synthetische Ablageprüfung',projektnummer:'SCOPE',auftraggeber:'Testkunde',liegenschaft:'Testhalle',baumassnahme:'Künstlicher Ablauf'}})).id;
    await call('edoku_select_service_areas',{projectId,etag:await revision(),selection:{active:[area]}});
    const list=(await request(root()+'/device-lists')).data.data.items.find(item=>item.aktiv&&item.leistungsbereich===area);
    await call('edoku_add_device_position',{projectId,listId:list.id,etag:await revision(),values:{hersteller:'Beispielhersteller',system:'Testsystem',typ:'Test 100'}});
    await registerFixtureMaterial(request,projectId,list.id);
    jobId=(await call('edoku_create_documentation_job',{projectId,input:{instruction:'Interne Arbeitsunterlage getrennt von realen Übergabenachweisen prüfen.',requirements:[{id:'working_text',title:'Interner Projekttext',category:'Nachweise'},{id:'actual_test',title:'Tatsächliches Messprotokoll',category:'Messprotokolle'},{id:'original',title:'Herstelleroriginal',category:'Bedienungsanleitungen',device:{listId:list.id,position:1,manufacturer:'Beispielhersteller',model:'Test 100'}}]}})).id;
    const originalRequirements=(await job()).requirements;
    oldProposal=await prepare('documentation','before_scope');ui=await reviewer(f,projectId);
    await t.test('Keine stille Umdeutung: unveränderte Anforderungen bleiben ohne Einzelzuordnung Kundenpflichten',async()=>{
      await call('edoku_start_workflow',{projectId,etag:await revision(),input:{jobId,documentScope:'internal',evidence}});
      assert.equal((await status()).requirements.find(item=>item.id==='working_text').scope,'documentation');
      assert.ok((await status()).issues.some(item=>item.requirementId==='working_text'));
    });
    await t.test('Geräteoriginale, unbekannte IDs, fremde Benutzer und veraltete Auftragsversionen werden abgewiesen',async()=>{
      assert.equal((await choose([{id:'original',scope:'internal'}])).data.error.code,'DEVICE_REQUIREMENT_PROTECTED');
      assert.equal((await choose([{id:'unknown',scope:'internal'}])).data.error.code,'UNKNOWN_REQUIREMENT');
      assert.equal((await choose([{id:'working_text',scope:'internal'}],{jobVersion:'0'.repeat(64)})).status,412);
      assert.equal((await choose([{id:'working_text',scope:'internal'}],{jobVersion:undefined})).status,400);
      const reader=f.makeToken('alice',{scopes:['projects:read','assistant:read']});
      assert.equal((await f.request(root()+'/workflow',{token:reader.token,method:'POST',body:{}})).status,403);
      const projectWriter=f.makeToken('alice',{scopes:['projects:write','assistant:read']});
      assert.equal((await f.request(root()+'/workflow',{token:projectWriter.token,method:'POST',headers:{'If-Match':await revision()},body:{jobId,evidence,jobVersion:(await job()).version,requirementScopes:[{id:'working_text',scope:'internal'}]}})).status,403);
      const other=f.makeToken('bob',{scopes});assert.equal((await f.request(root()+'/workflow',{token:other.token,method:'POST',body:{}})).status,404);
    });
    await t.test('Belegte Einzelzuordnung ist nachvollziehbar, wiederholbar und erhält den Pflichtkatalog',async()=>{
      const result=await choose([{id:'working_text',scope:'internal'}]);assert.equal(result.status,200);
      assert.equal(result.data.data.scopeHistory.length,1);assert.equal(result.data.data.scopeHistory[0].evidence.sourceQuote,evidence.sourceQuote);
      assert.equal((await choose([{id:'working_text',scope:'internal'}])).data.data.scopeHistory.length,1);
      await call('edoku_start_workflow',{projectId,etag:await revision(),input:{jobId,documentScope:'internal',evidence}});
      assert.deepEqual((await job()).requirements,originalRequirements);
      const s=await status();assert.equal(s.requirements.find(item=>item.id==='working_text').scope,'internal');
      assert.ok(!s.issues.some(item=>item.requirementId==='working_text'));assert.ok(s.issues.some(item=>item.requirementId==='actual_test'));assert.ok(s.issues.some(item=>item.requirementId==='original'));
      const html=await ui.page('/assistent/auftraege/'+jobId+'?ansicht=angaben');assert.match(html,/<td>Intern<\/td>/);assert.match(html,/<td>Kundendokumentation<\/td>/);
    });
    await t.test('Eine alte Kundenfassung kann nach Umordnung nicht versehentlich übernommen werden',async()=>{
      const result=await approve(oldProposal);assert.equal(result.status,409);assert.equal((await request(root()+'/attachments')).data.data.total,0);
      const wrong=await request(jobPath()+'/prepare-document',{method:'POST',headers:{'If-Match':await revision(),'Idempotency-Key':'wrong_scope_prepare'},body:{title:'Falsche Kundenfassung',category:'Nachweise',sourceLabel:'Künstlicher Test',reason:'Scope-Konflikt prüfen',requirementIds:['working_text'],content:{scope:'documentation',documentId:'description',sections:[{heading:'Test',text:'Test'}]}}});
      assert.equal(wrong.status,409);assert.equal(wrong.data.error.code,'REQUIREMENT_SCOPE_MISMATCH');
    });
    await t.test('Interner Ersatz bleibt bis zur manuellen Sichtung offen und erzeugt keinen Kundenanhang',async()=>{
      internal=await prepare('internal','internal_revision',[oldProposal.id]);
      const p=await call('edoku_next_action',{projectId,jobId,limit:10,view:'full'});assert.ok(!p.agentActions.items.some(item=>item.code==='PREPARE_INTERNAL_DOCUMENT'));assert.equal(p.readiness.canGenerate,false);
      assert.equal((await status()).requirements.find(item=>item.id==='working_text').fulfilled,false);
      assert.equal((await approve(internal)).status,302);
      const s=await status();assert.equal(s.requirements.find(item=>item.id==='working_text').fulfilledBy,internal.id);assert.equal(s.canGenerate,false);
      assert.equal((await request(root()+'/attachments')).data.data.total,0);assert.equal((await job()).documents.find(item=>item.id===oldProposal.id).state,'superseded');
    });
    await t.test('Fehlende interne Quelldatei bleibt erkennbar; Originalpflichten bleiben unabhängig bestehen',async()=>{
      const file=path.join(f.root,'storage/users/alice/assistant',jobId,internal.id+'.pdf');const bytes=await fs.readFile(file);await fs.writeFile(file,'corrupt');
      assert.equal((await status()).requirements.find(item=>item.id==='working_text').fulfilled,false);
      const p=await call('edoku_next_action',{projectId,jobId,limit:10,view:'full'});assert.ok(p.agentActions.items.some(item=>item.code==='PREPARE_INTERNAL_DOCUMENT'));
      await fs.writeFile(file,bytes);
      for(const [id,category] of [['original','Bedienungsanleitungen'],['actual_test','Messprotokolle']]){
        const pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetic original '+id);
        const body=new FormData();body.set('metadata',JSON.stringify({title:'Künstlicher Originalnachweis '+id,category,sourceLabel:'Synthetische Testquelle',reason:'Tatsächliche Übergabeanforderung im künstlichen Prüfaufbau',requirementIds:[id]}));body.set('file',new Blob([await pdf.save()]),'Original.pdf');
        const response=await fetch(f.base+'/api/v1'+jobPath()+'/documents',{method:'POST',headers:{Authorization:'Bearer '+key.token},body});assert.equal(response.status,201);assert.equal((await approve((await response.json()).data)).status,302);
      }
      assert.equal((await status()).canGenerate,true);assert.equal((await request(root()+'/attachments')).data.data.total,2);
      assert.equal((await choose([{id:'actual_test',scope:'internal'}])).data.error.code,'APPROVED_DOCUMENT_SCOPE_CONFLICT');
    });
    await t.test('Rückkehr zur Kundenpflicht braucht einen neuen Kundenentwurf; interne Freigabe wird nicht umetikettiert',async()=>{
      assert.equal((await choose([{id:'working_text',scope:'documentation'}])).status,200);
      assert.equal((await status()).requirements.find(item=>item.id==='working_text').fulfilled,false);
      const document=await prepare('documentation','customer_revision');assert.equal((await approve(document)).status,302);
      assert.equal((await status()).requirements.find(item=>item.id==='working_text').fulfilledBy,document.id);
      assert.ok((await request(root())).data.data.projekt.interneDokumente['internal-'+internal.id]);
      assert.deepEqual((await job()).requirements,originalRequirements);
    });
  } finally {await client.close();await f.cleanup();}
});
