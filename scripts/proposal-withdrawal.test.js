const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const { createDocumentAssistantService } = require('../services/documentAssistantService');
const { dataFilesForProject } = require('../services/projectArchiveService');
const { writeJson, readJson } = require('../services/jsonService');
const evidence = { sourceLabel: 'Synthetischer Benutzerchat', sourceQuote: 'Die fünf Testgeräte wurden nicht verwendet; ihre Dateivorschläge zurückziehen.' };
async function context() {
  const f = await fixture({ setup: async ({root}) => {
    const files = dataFilesForProject(root, 'alice', 'same');
    await writeJson(files.geraetelisten, [{id:'devices', aktiv:true, leistungsbereich:'Elektroinstallation / DIN VDE 0100', positionen:Array.from({length:6}, (_,i)=>({pos:i+1, hersteller:'Testhersteller', typ:'T'+(i+1)}))}]);
    await writeJson(files.leistungsbereiche, {aktiv:['Elektroinstallation / DIN VDE 0100'], optionen:['Elektroinstallation / DIN VDE 0100']});
  }});
  const token = f.makeToken('alice', {scopes}).token;
  const req = (url, options={}) => f.request(url, {token,...options});
  const service = createDocumentAssistantService(f.root, {db:f.db, verificationService:f.productVerification});
  const reference = n => ({listId:'devices', position:n, manufacturer:'Testhersteller', model:'T'+n});
  const job = service.create('alice','same',{instruction:'Synthetische Dateivorschläge mit einzeln geschützter manueller Freigabe.', requirements:[{id:'required_sheet', title:'Weiterhin erforderlicher Nachweis', category:'Datenblätter', device:reference(1)}]});
  async function propose(n, parent=job.id, label='') {
    const pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetic test '+n+label);const bytes=Buffer.from(await pdf.save());
    const metadata={title:'Datenblatt T'+n+label, category:'Datenblätter', sourceLabel:'Testquelle', reason:'Synthetisches Original', deviceReferences:[reference(n)], ...(n===1?{requirementIds:['required_sheet']}:{})};
    const proposal=await service.propose('alice',parent,metadata,{buffer:bytes,originalName:'test.pdf'});
    return {proposal,bytes,metadata};
  }
  const version = () => service.get('alice',job.id).version;
  const route = '/projects/same/assistant/jobs/'+job.id;
  const body = ids => ({version:version(),proposalIds:ids,reason:'Testgeräte nicht verbaut',evidence});
  const withdraw = (ids, changes={}) => req(route+'/withdrawals',{method:'POST',body:{...body(ids),...changes}});
  const table = () => f.db.prepare('SELECT * FROM document_proposals ORDER BY id').all();
  const others = () => f.db.prepare("SELECT * FROM project_documents WHERE NOT(user_id='alice' AND project_id='same') ORDER BY user_id,project_id,name").all();
  return {...f,req,service,reference,job,propose,version,route,body,withdraw,table,others,token};
}

test('Echter MCP: fünf Vorschläge atomar zurückziehen, Originale/Freigaben erhalten und Gerät danach löschen/restore',async()=>{
  const f=await context(),client=mcpClient(f.base,f.token,true);
  try {
    const docs=[];for(let n=1;n<=6;n++)docs.push(await f.propose(n));
    const approved=docs[5].proposal;f.service.viewed('alice',f.job.id,approved.id,approved.sha256);
    await f.service.approve('alice',f.job.id,approved.id,{reviewed:'on',sha256:approved.sha256,revision:(await f.req('/projects/same')).etag.slice(1,-1),metadata:{title:approved.title,category:approved.category}});
    const protectedRow=f.table().find(x=>x.id===approved.id),others=f.others();
    await client.initialize();const catalog=(await client.rpc('tools/list',{})).result.tools;
    assert.equal(catalog.length,58);assert.ok(catalog.some(x=>x.name==='edoku_withdraw_document_proposals'));assert.ok(!catalog.some(x=>/approve|freigeben/i.test(x.name)));
    const result=(await client.rpc('tools/call',{name:'edoku_withdraw_document_proposals',arguments:{projectId:'same',jobId:f.job.id,input:f.body(docs.slice(0,5).map(x=>x.proposal.id))}})).result;
    assert.ok(!result.isError,JSON.stringify(result));assert.ok(Buffer.byteLength(JSON.stringify(result))<2000);
    assert.equal(result.structuredContent.data.withdrawn.length,5);
    const current=f.service.get('alice',f.job.id);
    assert.deepEqual(current.documents.map(x=>x.state).sort(),['approved',...Array(5).fill('withdrawn')].sort());
    for(const d of current.documents.filter(x=>x.state==='withdrawn')){assert.equal(d.withdrawal.reason,'Testgeräte nicht verbaut');assert.deepEqual(d.withdrawal.evidence,evidence);assert.equal(d.withdrawal.recordedBy,'alice');assert.equal(d.decidedAt,null);assert.equal(d.attachmentId,null);}
    assert.deepEqual(f.table().find(x=>x.id===approved.id),protectedRow);assert.deepEqual(f.others(),others);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views').get().n,1);
    for(const d of docs)assert.deepEqual((await f.service.content('alice',f.job.id,d.proposal.id)).bytes,d.bytes);
    const status=(await f.req('/projects/same/documentation-status')).data.data;
    assert.equal(status.pendingDocuments.length,0);assert.equal(status.requirements.find(x=>x.id==='required_sheet').fulfilled,false);
    const coverage=(await f.req('/projects/same/datasheet-coverage?limit=10')).data.data;
    const item=coverage.items.find(x=>x.model==='T2');assert.equal(item.status,'research');assert.equal(item.withdrawn[0].id,docs[1].proposal.id);assert.equal(item.rejected.length,0);
    const preview=async n=>(await f.req('/projects/same/deletions/preview?'+new URLSearchParams({kind:'device',listId:'devices',position:String(n)}))).data.data;
    assert.equal((await preview(1)).canDelete,false);const p=await preview(2);assert.equal(p.canDelete,true);
    const reason={confirm:true,reason:'Dieses synthetische Gerät entfernen',evidence};
    const removed=await f.req('/projects/same/device-lists/devices/positions/2',{method:'DELETE',headers:{'If-Match':p.etag,'Idempotency-Key':'withdraw_then_delete'},body:{...reason,previewCheckpoint:p.previewCheckpoint}});assert.equal(removed.status,200,JSON.stringify(removed.data));
    const restored=await f.req('/projects/same/deletions/'+removed.data.data.deletionId+'/restore',{method:'POST',headers:{'If-Match':(await f.req('/projects/same')).etag,'Idempotency-Key':'withdraw_then_restore'},body:reason});assert.equal(restored.status,200,JSON.stringify(restored.data));
    await f.restart();assert.equal(f.service.get('alice',f.job.id).documents.filter(x=>x.state==='withdrawn').length,5);
    assert.deepEqual(f.table().find(x=>x.id===approved.id),protectedRow);assert.deepEqual(f.others(),others);
  } finally {await client.close();await f.cleanup();}
});

test('HTTP-Schutz: Version/Beleg, Rechte, Fremdprojekt und atomarer Konflikt ohne Teiländerung',async()=>{
  const f=await context();try {
    const first=await f.propose(1),second=await f.propose(2);
    const before=f.table(),ids=[first.proposal.id];
    for(const changes of [{version:'0'.repeat(64)},{reason:' '},{evidence:undefined},{proposalIds:[...ids,...ids]},{proposalIds:Array(11).fill(ids[0])},{reviewed:'on'}]){
      const r=await f.withdraw(ids,changes);assert.ok([400,412].includes(r.status),JSON.stringify(r.data));assert.deepEqual(f.table(),before);
    }
    const read=f.makeToken('alice',{scopes:['projects:read','documents:read','assistant:read']}).token;
    assert.equal((await f.request(f.route+'/withdrawals',{token:read,method:'POST',body:f.body(ids)})).status,403);
    assert.equal((await f.request(f.route+'/withdrawals',{token:f.makeToken('bob',{scopes}).token,method:'POST',body:f.body(ids)})).status,404);
    assert.equal((await f.req(f.route.replace('/same/','/second/')+'/withdrawals',{method:'POST',body:f.body(ids)})).status,404);
    const other=f.service.create('alice','same',{instruction:'Anderer synthetischer Auftrag'}),foreign=await f.propose(3,other.id);
    assert.equal((await f.withdraw([second.proposal.id,foreign.proposal.id])).status,404);assert.deepEqual(f.table().slice().filter(x=>x.job_id===f.job.id),before);
    f.service.reject('alice',f.job.id,second.proposal.id,'Synthetische manuelle Ablehnung');
    const rejected=f.table();assert.equal((await f.withdraw([first.proposal.id,second.proposal.id])).data.error.code,'WITHDRAWAL_CONFLICT');assert.deepEqual(f.table(),rejected);
    assert.equal((await f.withdraw(ids)).status,200);const withdrawn=f.table();
    assert.equal((await f.withdraw(ids)).data.error.code,'WITHDRAWAL_CONFLICT');assert.deepEqual(f.table(),withdrawn);
    const duplicate=await f.service.propose('alice',f.job.id,first.metadata,{buffer:first.bytes,originalName:'again.pdf'});
    assert.equal(duplicate.id,first.proposal.id);assert.equal(duplicate.state,'withdrawn');assert.deepEqual(f.table(),withdrawn);
    await assert.rejects(f.service.approve('alice',f.job.id,first.proposal.id,{reviewed:'on',sha256:first.proposal.sha256}),{apiCode:'ALREADY_DECIDED'});
  } finally {await f.cleanup();}
});

test('Freigegebene/ersetzte Vorschläge und Pflichtanforderungen bleiben geschützt; SQL-Fehler rollt Paket zurück',async()=>{
  const f=await context();try {
    const one=await f.propose(1),two=await f.propose(2),three=await f.propose(3),four=await f.propose(4);
    f.service.replaceProposals('alice',f.job.id,{version:f.version(),replacements:[{previousId:two.proposal.id,replacementId:three.proposal.id}]});
    let before=f.table();assert.equal((await f.withdraw([one.proposal.id,two.proposal.id])).status,409);assert.deepEqual(f.table(),before);
    const approved=four.proposal;f.service.viewed('alice',f.job.id,approved.id,approved.sha256);
    await f.service.approve('alice',f.job.id,approved.id,{reviewed:'on',sha256:approved.sha256,revision:(await f.req('/projects/same')).etag.slice(1,-1),metadata:{title:approved.title,category:approved.category}});
    before=f.table();assert.equal((await f.withdraw([one.proposal.id,approved.id])).status,409);assert.deepEqual(f.table(),before);
    f.db.exec(`CREATE TRIGGER reject_withdrawal BEFORE UPDATE OF metadata ON document_proposals WHEN NEW.id='${three.proposal.id}' BEGIN SELECT RAISE(ABORT,'synthetic rollback'); END;`);
    assert.equal((await f.withdraw([one.proposal.id,three.proposal.id])).status,500);assert.deepEqual(f.table(),before);
    f.db.exec('DROP TRIGGER reject_withdrawal');
    const closed=f.service.create('alice','same',{instruction:'Synthetischer leerer geschlossener Auftrag'});f.service.close('alice',closed.id);
    const closedRequest=await f.req('/projects/same/assistant/jobs/'+closed.id+'/withdrawals',{method:'POST',body:{...f.body([one.proposal.id]),version:f.service.get('alice',closed.id).version}});assert.equal(closedRequest.data.error.code,'JOB_CLOSED');
    assert.equal((await f.withdraw([one.proposal.id])).status,200);
    assert.equal(f.service.get('alice',f.job.id).requirements.length,1);
  } finally {await f.cleanup();}
});

test('Gleichzeitige Freigabe: zwischenzeitliches Zurückziehen verhindert jede aktive Übernahme',async()=>{
  const f=await context();try {
    const d=await f.propose(2);f.service.viewed('alice',f.job.id,d.proposal.id,d.proposal.sha256);
    const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification,checkStorage:async()=>{
      f.service.withdrawProposals('alice',f.job.id,f.body([d.proposal.id]));
    }});
    const files=dataFilesForProject(f.root,'alice','same'),before=await readJson(files.geraetelisten);
    await assert.rejects(service.approve('alice',f.job.id,d.proposal.id,{reviewed:'on',sha256:d.proposal.sha256,revision:(await f.req('/projects/same')).etag.slice(1,-1),metadata:{title:d.proposal.title,category:d.proposal.category}}),{apiCode:'ALREADY_DECIDED'});
    assert.deepEqual(await readJson(files.anhaenge),[]);assert.deepEqual(await readJson(files.geraetelisten),before);
    const row=f.table().find(x=>x.id===d.proposal.id);assert.equal(row.state,'pending');assert.equal(row.decided_at,null);assert.equal(row.attachment_id,null);assert.equal(f.service.get('alice',f.job.id).documents[0].state,'withdrawn');
  } finally {await f.cleanup();}
});

test('GUI: CSRF/Version, Zurückziehen ohne Sichtung, nächste Datei und nachvollziehbarer Verlauf',async()=>{
  const f=await context();try {
    const one=await f.propose(1),two=await f.propose(2);const cookies=new Map();
    const browser=async(url,options={})=>{const response=await fetch(f.base+url,{redirect:'manual',...options,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}return response;};
    let html=await(await browser('/login')).text(),csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
    assert.equal((await browser('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);
    const url='/assistent/auftraege/'+f.job.id+'/dateien/'+one.proposal.id;
    html=await(await browser(url)).text();csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];assert.match(html,/data-document-withdrawal/);assert.match(html,/name="jobVersion"/);
    const revision=(await f.req('/projects/same')).etag.slice(1,-1);
    const body=(extra={})=>new URLSearchParams({_csrf:csrf,_projectRevision:revision,projectId:'same',jobVersion:f.version(),reason:'Dieses Testgerät ist nicht verbaut',...extra});
    const post=fields=>browser(url+'/zurueckziehen',{method:'POST',headers:{Accept:'application/json'},body:fields});
    assert.equal((await post(body({_csrf:''}))).status,403);
    const stale=await post(body({jobVersion:'0'.repeat(64)}));assert.equal(stale.status,412,await stale.text());
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views').get().n,0);
    const response=await post(body());assert.equal(response.status,200);const value=await response.json();assert.equal(value.state,'withdrawn');assert.equal(value.nextUrl,'/assistent/auftraege/'+f.job.id+'/dateien/'+two.proposal.id);
    const fragment=await(await browser(url+'?fragment=review')).json();assert.equal(fragment.state,'withdrawn');assert.match(fragment.html,/Dieses Testgerät ist nicht verbaut/);assert.doesNotMatch(fragment.html,/data-document-approval|data-document-withdrawal/);
    const history=await(await browser('/assistent/auftraege/'+f.job.id+'?ansicht=verlauf')).text();assert.match(history,/Ersetzte Entwürfe, zurückgezogene und abgelehnte Dateien/);assert.match(history,/Dieses Testgerät ist nicht verbaut/);
    const files=await readJson(dataFilesForProject(f.root,'alice','same').anhaenge);assert.deepEqual(files,[]);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views').get().n,0);
    const log=await fs.readFile(path.join(f.root,'storage/audit/events.jsonl'),'utf8');assert.match(log,/assistant.document.withdraw/);
  } finally {await f.cleanup();}
});
