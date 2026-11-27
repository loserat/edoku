const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {PDFDocument}=require('pdf-lib');
const {normalizePostedGeraetelisten,applyGeraetelistenVorlage}=require('../services/geraetelistenService');
const {repairOptions}=require('../services/deviceReferenceRepairService');
const {classify}=require('../services/workflowBlockerService');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {readJson,writeJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const store=require('../services/projectDataStoreService');
const area='Elektroinstallation / DIN VDE 0100';
const row=(pos,extra={})=>({pos,hersteller:'Prüfhersteller',typ:'A1',system:'Test',...extra});
const list=positions=>({id:'devices',leistungsbereich:area,aktiv:true,export:true,positionen:positions});

test('GUI-Speichern erhält Kennungen, Originalfelder und Reserven trotz Reihenfolge und Löschung',()=>{
 const before=list([row(2,{custom:{keep:true},datenblattId:'approved'}),row(9)]);
 const posted={...before,aktiv:'true',export:'true',positionen:[{...before.positionen[1],_delete:'1'},{...before.positionen[0],_originalPos:'2'},{...row(3),_new:'1'}]};
 const result=normalizePostedGeraetelisten([posted],[before])[0];
 assert.deepEqual(result.positionen.map(p=>p.pos),[2,10]);assert.deepEqual(result.positionen[0].custom,{keep:true});assert.equal(result.positionen[0].datenblattId,'approved');
 const empty=normalizePostedGeraetelisten([{...result,positionen:[]}],[result])[0];
 assert.equal(normalizePostedGeraetelisten([{...empty,positionen:[{...row(1),_new:'1'}]}],[empty])[0].positionen[0].pos,11);
 assert.throws(()=>normalizePostedGeraetelisten([{...posted,positionen:[{...row(4),_originalPos:'2'}]}],[before]),/kennungen/i);
 assert.throws(()=>normalizePostedGeraetelisten([{...posted,positionen:[row(2),row(2)]}],[before]),/eindeutig/);
 const template=applyGeraetelistenVorlage(result,{...before,id:'template',name:'Testvorlage'});
 assert.ok(template.positionen.every(p=>p.pos>10));assert.ok(template.positionen.every(p=>!p.datenblattId));
});

test('Reparatur benötigt vorhandene Dateizuordnung und eindeutige Geräteinstanz',()=>{
 const attachment={id:'file',category:'Datenblätter',mimeType:'application/pdf',deviceReferences:[{listId:'devices',position:1,manufacturer:'Prüfhersteller',model:'A1'}]};
 const data={leistungsbereiche:{aktiv:[area]},geraetelisten:[list([row(1,{typ:'anderer Artikel'}),row(7,{datenblattId:'file'})])]};
 assert.equal(repairOptions(data,attachment).repairs[0].to.position,7);
 data.geraetelisten[0].positionen.push(row(8,{datenblattId:'file'}));assert.equal(repairOptions(data,attachment).repairs.length,0);assert.equal(repairOptions(data,attachment).blocked[0].code,'AMBIGUOUS_DEVICE_INSTANCE');
 data.geraetelisten[0].positionen=[row(7)];assert.equal(repairOptions(data,attachment).repairs.length,0);
});

test('Blocker unterscheiden Herstellerfreischaltung, Dateigröße und belegten Nichtfund',()=>{
 assert.equal(classify({outcome:'blocked',reason:'manufacturer_source_unconfirmed'}).owner,'maintainer');
 assert.equal(classify({outcome:'blocked',blockerCode:'SOURCE_FILE_LIMIT'}).code,'SOURCE_FILE_LIMIT');
 assert.equal(classify({outcome:'not_found'}).code,'DOCUMENT_NOT_FOUND');assert.equal(classify({outcome:'retry'}),null);
});

test('API/MCP repariert nur belegte Bezüge nach Vorschau, schützt Hash/Freigabe und liefert Folgeaufgabe',async()=>{
 const f=await fixture(),key=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,key,true);
 try {
  const files=dataFilesForProject(f.root,'alice','same');
  await store.withProjectDataTransaction(async()=>{await writeJson(files.geraetelisten,[list([row(1)])]);await writeJson(files.leistungsbereiche,{aktiv:[area],optionen:[area]});});
  const {createDocumentAssistantService}=require('../services/documentAssistantService');
  const assistant=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  const job=assistant.create('alice','same',{instruction:'Ausschließlich künstliche stabile Gerätebezüge prüfen.'});
  const pdf=await PDFDocument.create();pdf.addPage();
  const doc=await assistant.propose('alice',job.id,{title:'Künstliches Original',category:'Datenblätter',sourceLabel:'Prüfdaten',reason:'Künstliche Zuordnung',deviceReferences:[{listId:'devices',position:1,manufacturer:'Prüfhersteller',model:'A1'}]},{buffer:Buffer.from(await pdf.save()),originalName:'test.pdf'});
  const metadata=JSON.parse(f.db.prepare('SELECT metadata FROM document_proposals WHERE id=?').get(doc.id).metadata);delete metadata.productVerificationPolicy;
  f.db.prepare('UPDATE document_proposals SET metadata=? WHERE id=?').run(JSON.stringify(metadata),doc.id);
  await assistant.content('alice',job.id,doc.id);assistant.viewed('alice',job.id,doc.id,doc.sha256);
  await assistant.approve('alice',job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:doc.title,category:doc.category}});
  const originalDecision=f.db.prepare('SELECT state,decided_at,decided_by,metadata FROM document_proposals WHERE id=?').get(doc.id);
  const attachmentId=assistant.get('alice',job.id).documents[0].attachmentId;
  const deviceLists=await readJson(files.geraetelisten);deviceLists[0].positionen[0].pos=7;deviceLists[0].positionen.unshift(row(1,{typ:'anderer Artikel'}));await writeJson(files.geraetelisten,deviceLists);
  await client.initialize();const call=async args=>{const r=(await client.rpc('tools/call',{name:'edoku_repair_document_references',arguments:{projectId:'same',attachmentId,...args}})).result;assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent;};
  const initialPlan=(await f.request('/projects/same/next-action?view=compact&limit=1',{token:key})).data.data;
  assert.equal(initialPlan.nextAction.code,'REPAIR_DEVICE_REFERENCES');assert.equal(initialPlan.nextAction.call.arguments.attachmentId,attachmentId);
  const preview=await call({mode:'preview'});assert.equal(preview.data.repairs[0].to.position,7);
  const url='/projects/same/attachments/'+attachmentId+'/device-repair';
  const attachment=(await readJson(files.anhaenge)).find(a=>a.id===attachmentId);
  const file=await require('../services/attachmentService').resolveAttachmentFile(f.root,files,attachment.relativePath),originalBytes=await fs.readFile(file);
  await fs.appendFile(file,'changed');
  const changed=await f.request(url,{token:key,method:'POST',headers:{'If-Match':preview.etag},body:{previewToken:preview.data.previewToken,evidence:{sourceLabel:'Test',sourceQuote:'Veränderte Bytes dürfen nie übernommen werden.'}}});assert.equal(changed.status,409);
  assert.equal((await readJson(files.anhaenge)).find(a=>a.id===attachmentId).deviceReferences[0].position,1);
  await fs.writeFile(file,originalBytes);
  const stale=await f.request(url,{token:key,method:'POST',headers:{'If-Match':preview.etag},body:{previewToken:'0'.repeat(64),evidence:{sourceLabel:'Test',sourceQuote:'Belegter künstlicher Gerätebezug.'}}});assert.equal(stale.status,412);
  const result=await call({mode:'apply',etag:preview.etag,input:{previewToken:preview.data.previewToken,evidence:{sourceLabel:'Prüfung',sourceQuote:'Die vorhandene Originalzuordnung belegt Geräteposition 7.'}}});
  assert.equal(result.data.approvalPreserved,true);assert.ok(result.continuation?.checkpoint || result.continuation?.state==='refresh_required');
  assert.deepEqual(f.db.prepare('SELECT state,decided_at,decided_by,metadata FROM document_proposals WHERE id=?').get(doc.id),originalDecision);
  assert.equal((await readJson(files.anhaenge)).find(a=>a.id===attachmentId).deviceReferences[0].position,7);
  assert.equal((await readJson(files.projekt)).assistantReferenceRepairs.length,1);
  const other=await f.request('/projects/second/attachments/'+attachmentId+'/device-repair',{token:key});assert.notEqual(other.status,200);
  const noRights=f.makeToken('alice',{scopes:['projects:read']}).token;assert.equal((await f.request(url,{token:noRights})).status,403);
  const targeted=await f.request('/projects/same/device-lists/devices?position=7&limit=1',{token:key});assert.equal(targeted.data.data.positionen.items[0].pos,7);
  const plan=await f.request('/projects/same/next-action?view=compact&limit=1',{token:key});assert.ok(!plan.data.data.nextAction?.code.includes('REPAIR_DEVICE_REFERENCES'));
  const coverage=(await f.request('/projects/same/datasheet-coverage?limit=3',{token:key})).data.data;
  const open=coverage.items.find(a=>a.model==='anderer Artikel');
  const recorded=await f.request('/projects/same/datasheet-searches',{token:key,method:'POST',headers:{'If-Match':plan.etag},body:{articleId:open.id,outcome:'blocked',blockerCode:'SOURCE_FILE_LIMIT',reason:'Künstliche Herstellerdatei überschreitet die belegte technische Grenze.',sources:['https://example.invalid/fixture.pdf'],evidence:{sourceLabel:'Synthetischer Test',sourceQuote:'SOURCE_FILE_LIMIT'}}});assert.equal(recorded.status,200);
  const waiting=(await f.request('/projects/same/next-action?view=compact&limit=1',{token:key})).data.data;
  assert.equal(waiting.taskCounts.agent,0);assert.ok(waiting.blockers.groups.some(g=>g.code==='SOURCE_FILE_LIMIT'));assert.equal(waiting.readiness.canGenerate,false);
  const filtered=(await client.rpc('tools/call',{name:'edoku_datasheet_coverage',arguments:{projectId:'same',articleId:open.id,limit:1}})).result;
  assert.ok(!filtered.isError,JSON.stringify(filtered));assert.equal(filtered.structuredContent.data.items[0].blocker.owner,'maintainer');
 }finally{await client.close();await f.cleanup()}
});

test('Folgeplan ist optional und ohne zusätzliche Leserechte nicht verfügbar',async()=>{
 const f=await fixture();try {
  const key=f.makeToken('alice',{scopes}).token,project=await f.request('/projects/same',{token:key});
  const r=await f.request('/projects/same',{token:key,method:'PATCH',headers:{'If-Match':project.etag,Prefer:'return=next-action'},body:{projektname:'Künstlicher Folgeplan'}});
  assert.equal(r.status,200);assert.ok(r.data.continuation);assert.ok(JSON.stringify(r.data).length<6500);
  const limited=f.makeToken('alice',{scopes:['projects:read','projects:write']}).token;
  const r2=await f.request('/projects/same',{token:limited,method:'PATCH',headers:{'If-Match':r.etag,Prefer:'return=next-action'},body:{projektname:'Weiterhin künstlich'}});assert.equal(r2.status,200);assert.equal(r2.data.continuation,undefined);
 }finally{await f.cleanup()}
});
