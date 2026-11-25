const {registerFixtureMaterial}=require('./helpers/materialFixture');
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path");
const { PDFDocument } = require("pdf-lib");
const { fixture, mcpClient } = require("./helpers/integrationFixture");
const { scopes } = require("../src/api/schemas");
const { createExportJobService } = require("../services/exportJobService");
const { generateCompleteDocumentation } = require("../services/projectWorkspaceService");
const { setup, area } = require("./helpers/documentationExample");
const { buildDocumentationPlan } = require("../services/documentationPlanService");


async function reviewer(base, password, projectId) {
  const cookies = new Map();
  const request = async (route, options = {}) => {
    const response = await fetch(base + route, { redirect: "manual", ...options, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...options.headers } });
    for (const line of response.headers.getSetCookie()) { const pair = line.split(";")[0], index = pair.indexOf("="); cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
    return response;
  };
  const login = await (await request("/login")).text();
  let csrf = login.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  assert.equal((await request("/login", { method: "POST", body: new URLSearchParams({ email: "alice", password, _csrf: csrf }) })).status, 302);
  const page = async route => { const response = await request(route); assert.equal(response.status, 200); const html = await response.text(); csrf = html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1]; return html; };
  const post = (route, fields, options={}) => request(route, { ...options, method: 'POST', body: new URLSearchParams({ _csrf: csrf, ...fields }) });
  if (projectId) { await page('/projekte'); assert.equal((await post('/projekte/' + projectId + '/oeffnen', {})).status,302); }
  return { request, page, post };
}

test('Schlanke Einzelprüfung: JSON-Entscheidung, nächste Datei und neuer Versionsschutz ohne Projektvollprüfung',async()=>{
 const f=await fixture({setup:async({root})=>{
  await fs.appendFile(path.join(root,'services/documentationReadinessService.js'),"\nconst realReadinessFactory=module.exports.createDocumentationReadinessService;module.exports.createDocumentationReadinessService=(...args)=>{const s=realReadinessFactory(...args);s.inspect=async()=>{throw Error('FULL_PROJECT_CHECK_ON_REVIEW');};return s;};\n");
 }});
 try{
  const token=f.makeToken('alice',{scopes}).token,req=(url,options={})=>f.request(url,{token,...options});
  const job=(await req('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Künstliche Einzelprüfung mit drei getrennten Dateientscheidungen.'}})).data.data;
  const service=require('../services/documentAssistantService').createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification}),docs=[];
  for(let i=0;i<3;i++){const pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetic manual review '+i);docs.push(await service.propose('alice',job.id,{title:'Künstliche Prüfdatei '+i,category:'Nachweise',sourceLabel:'Künstlicher Test',reason:'Nur getrennte Testdaten zur manuellen Einzelprüfung.'},{buffer:Buffer.from(await pdf.save()),originalName:'Test.pdf'}));}
  const ui=await reviewer(f.base,f.password),base='/assistent/auftraege/'+job.id,headers={Accept:'application/json'};
  const page=await ui.page(base+'/dateien/'+docs[0].id+'?panel=1');assert.match(page,/data-review-host/);assert.doesNotMatch(page,/FULL_PROJECT_CHECK_ON_REVIEW/);
  const fields=async doc=>({title:doc.title,category:doc.category,sha256:doc.sha256,revision:(await req('/projects/same')).etag.slice(1,-1),panel:'1',continueReview:'1',reviewed:'on'});
  let response=await ui.post(base+'/dateien/'+docs[0].id+'/uebernehmen',await fields(docs[0]),{headers});assert.equal(response.status,409);assert.equal((await response.json()).code,'REVIEW_REQUIRED');
  await (await ui.request(base+'/dateien/'+docs[0].id+'/inhalt')).arrayBuffer();
  response=await ui.post(base+'/dateien/'+docs[0].id+'/uebernehmen',await fields(docs[0]),{headers});assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);
  const saved=await response.json();assert.equal(saved.proposalId,docs[0].id);assert.equal(saved.nextUrl,base+'/dateien/'+docs[1].id);assert.ok(JSON.stringify(saved).length<600);
  assert.equal(service.get('alice',job.id).documents.find(x=>x.id===docs[0].id).state,'approved');
  const fragment=await ui.request(saved.nextUrl+'?fragment=review&panel=1',{headers});assert.equal(fragment.status,200);const next=await fragment.json();assert.equal(next.proposalId,docs[1].id);assert.match(next.html,/name="reviewed" required/);assert.doesNotMatch(next.html,/name="reviewed"[^>]*checked/);assert.doesNotMatch(next.html,/<html|data-workspace-content/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,1);
  response=await ui.post(base+'/dateien/'+docs[0].id+'/uebernehmen',await fields(docs[0]),{headers});assert.equal(response.status,409);assert.equal((await response.json()).code,'ALREADY_DECIDED');
  response=await ui.post(base+'/dateien/'+docs[1].id+'/uebernehmen',{...await fields(docs[1]),revision:next.revision},{headers});assert.equal(response.status,409);assert.equal((await response.json()).code,'REVIEW_REQUIRED');
  await (await ui.request(base+'/dateien/'+docs[1].id+'/inhalt')).arrayBuffer();
  response=await ui.post(base+'/dateien/'+docs[1].id+'/uebernehmen',await fields(docs[1]),{headers});assert.equal(response.status,200);assert.equal((await response.json()).nextUrl,base+'/dateien/'+docs[2].id);
  response=await ui.post(base+'/dateien/'+docs[2].id+'/ablehnen',{reason:'Inhalt passt für diesen künstlichen Test nicht.',panel:'1'},{headers});assert.equal(response.status,200);assert.equal((await response.json()).nextUrl,null);
  const attachments=await require('../services/jsonService').readJson(require('../services/projectArchiveService').dataFilesForProject(f.root,'alice','same').anhaenge);assert.equal(attachments.length,2);
 }finally{await f.cleanup();}
});

test('Arbeitslisten-Fragment aktualisiert Inhalte ohne neue Sichtungsnachweise oder Freigaben',async()=>{
 const f=await fixture();try{
  const token=f.makeToken('alice',{scopes}).token,req=(url,options={})=>f.request(url,{token,...options});
  const job=(await req('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Künstliche Arbeitsliste für gezielte Aktualisierung prüfen.'}})).data.data;
  const ui=await reviewer(f.base,f.password);await ui.page('/assistent');
  for(const url of ['/assistent?fragment=workspace','/assistent/auftraege/'+job.id+'?fragment=workspace']){
   const response=await ui.request(url,{headers:{Accept:'application/json'}});assert.equal(response.status,200);const value=await response.json();assert.equal(value.projectId,'same');assert.match(value.html,/aria-label="Dokumentationsauftrag"/);assert.match(value.html,/Dateien prüfen<span>0<\/span>/);assert.doesNotMatch(value.html,/assistant-workspace-metrics/);assert.doesNotMatch(value.html,/<html|<dialog|<script/);assert.ok(value.viewVersion);
  }
 }finally{await f.cleanup();}
});

test('Menüeinstieg zeigt nur das geöffnete Projekt, speichert Antworten dort und belässt Dateien ungeprüft', async () => {
  const f = await fixture();
  try {
    const alice = f.makeToken('alice', { scopes }), bob = f.makeToken('bob', { scopes });
    const create = async (project, token, prompt) => {
      const created = await f.request(`/projects/${project}/assistant/jobs`, { token, method:'POST', body:{ instruction:'Künstlichen Dokumentationsauftrag für die projektübergreifende Übersicht anlegen.' } });
      assert.equal(created.status,201);
      const api = `/projects/${project}/assistant/jobs/${created.data.data.id}`;
      assert.equal((await f.request(api,{ token, method:'PATCH', body:{questions:[{id:'place',prompt,required:true}]} })).status,200);
      return { api, id:created.data.data.id };
    };
    const first = await create('same',alice.token,'FRAGE_ERSTES_PROJEKT');
    const second = await create('second',alice.token,'FRAGE_ZWEITES_PROJEKT');
    const foreign = await create('same',bob.token,'FREMDER_VERTRAULICHER_PUNKT');
    const ui = await reviewer(f.base,f.password);
    const page = await ui.page('/assistent');
    assert.match(page,/FRAGE_ERSTES_PROJEKT/);assert.doesNotMatch(page,/FRAGE_ZWEITES_PROJEKT|data-project-picker|Alle Projekte/);
    assert.doesNotMatch(page,/FREMDER_VERTRAULICHER_PUNKT/);
    for(const job of [first]) {
      assert.match(page,new RegExp(`action="/assistent/auftraege/${job.id}/antworten"`));
      assert.ok(page.includes(`/assistent/auftraege/${job.id}?ansicht=export`));
      assert.ok(page.includes(`/assistent/auftraege/${job.id}?ansicht=angaben`));
    }
    assert.match(page,/href="\/einstellungen#api"/);assert.match(page,/data-status-url="\/assistent\/status"/);
    const before = await (await ui.request('/assistent/status')).json();
    const answered = await ui.post(`/assistent/auftraege/${first.id}/antworten`,{returnToOverview:'1','answers[place]':'Tor 2'});
    assert.equal(answered.status,302);assert.ok(answered.headers.get('location').startsWith('/assistent?success='));
    assert.equal((await f.request(first.api,{token:alice.token})).data.data.questions[0].answer,'Tor 2');
    assert.equal((await f.request(second.api,{token:alice.token})).data.data.questions[0].answer,'');
    assert.equal((await ui.post(`/assistent/auftraege/${foreign.id}/antworten`,{'answers[place]':'Unerlaubt'})).status,404);
    const pdf = await PDFDocument.create();pdf.addPage().drawText('Nur manuell freigeben');
    const form = new FormData();form.set('metadata',JSON.stringify({title:'OFFENE_TESTDATEI',category:'Datenblätter',sourceLabel:'Künstliche Testquelle',reason:'Keine automatische Sichtung durch die Übersicht'}));form.set('file',new Blob([await pdf.save()]),'Test.pdf');
    const submitted = await fetch(f.base+'/api/v1'+first.api+'/documents',{method:'POST',headers:{Authorization:'Bearer '+alice.token},body:form});
    assert.equal(submitted.status,201);const document = (await submitted.json()).data;
    const after = await (await ui.request('/assistent/status')).json();
    assert.notEqual(after.viewVersion,before.viewVersion);assert.equal(after.pending,1);
    assert.match(await ui.page('/assistent'),/OFFENE_TESTDATEI/);
    const files = await ui.page('/assistent?ansicht=dateien');
    assert.ok(files.includes(`/assistent/auftraege/${first.id}/dateien/${document.id}`));
    assert.match(files,/data-file-search/);assert.doesNotMatch(files,/FREMDER_VERTRAULICHER_PUNKT/);
    assert.equal((await f.request(first.api,{token:alice.token})).data.data.documents[0].state,'pending');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM document_review_views').get().n,0);
    assert.match(await ui.page('/assistent?ansicht=auftraege&neu=1'),/id="neuer-auftrag" class="settings-panel" open/);
    const project = (await f.request('/projects/same')).data.data.projekt;
    assert.equal(project.projektname,'alice same');
  } finally { await f.cleanup(); }
});

test('Interner Projekttext bleibt nach individueller GUI-Freigabe intern und wird kein Kundenanhang', async () => {
  const f = await fixture();
  try {
    const agent = f.makeToken('alice', { scopes });
    const request = (route, options = {}) => f.request(route, { token: agent.token, ...options });
    const job = (await request('/projects/same/assistant/jobs', { method: 'POST', body: { instruction: 'Eine interne Arbeitsnotiz vorbereiten, keine Aufnahme in die Kundendokumentation.' } })).data.data;
    const base = '/assistent/auftraege/' + job.id;
    const proposal = await request('/projects/same/assistant/jobs/' + job.id + '/prepare-document', { method: 'POST', headers: { 'If-Match': (await request('/projects/same')).etag, 'Idempotency-Key': 'internal_working_note' }, body: { title: 'Interne Arbeitsnotiz', sourceLabel: 'Künstlicher Testchat', reason: 'Interne Ablage getrennt vom Kundenexport prüfen', content: { sections: [{ heading: 'Offene Punkte', text: 'Ausschließlich interne künstliche Arbeitsnotiz.' }] } } });
    assert.equal(proposal.status, 201); const document = proposal.data.data;
    assert.equal(document.projectDocument.scope, 'internal');
    const ui = await reviewer(f.base, f.password);
    await ui.page(base + '/dateien/' + document.id);
    await (await ui.request(base + '/dateien/' + document.id + '/inhalt')).arrayBuffer();
    assert.equal((await ui.post(base + '/dateien/' + document.id + '/uebernehmen', { reviewed: 'on', sha256: document.sha256, revision: (await request('/projects/same')).etag.slice(1, -1), title: document.title, category: document.category })).status, 302);
    const project = (await request('/projects/same')).data.data.projekt;
    assert.equal(Object.values(project.interneDokumente)[0].sha256, document.sha256);
    assert.equal(project.dokumentInhalte, undefined);
    assert.equal((await request('/projects/same/attachments')).data.data.total, 0);
    const saved = (await request('/projects/same/assistant/jobs/' + job.id)).data.data.documents[0];
    assert.equal(saved.state, 'approved'); assert.equal(saved.attachmentId, null);
  } finally { await f.cleanup(); }
});

test('Assistent-Übersicht: offene Aufgaben getrennt, kompakte Einzelprüfung und manuell bestätigte Weiterleitung', async () => {
  const f = await fixture();
  try {
    const agent = f.makeToken('alice', { scopes });
    const created = await f.request('/projects/same/assistant/jobs', { token:agent.token, method:'POST', body:{instruction:'LANGER_URSPRUNGS_AUFTRAG mit allen technischen Details ausschließlich im Verlauf anzeigen.'} });
    const id = created.data.data.id, api = `/projects/same/assistant/jobs/${id}`, base = `/assistent/auftraege/${id}`;
    await f.request(api, {token:agent.token,method:'PATCH',body:{questions:[{id:'open',prompt:'Offene Frage nach dem Montageort',required:true},{id:'done',prompt:'Bereits beantwortete Typfrage',required:true}]}});
    let job = (await f.request(api,{token:agent.token})).data.data;
    await f.request(api+'/answers',{token:agent.token,method:'POST',body:{version:job.version,answers:[{questionId:'done',answer:'BESTAETIGTE_ANTWORT',evidence:{sourceLabel:'Testchat',sourceQuote:'BESTAETIGTE_ANTWORT'}}]}});
    const docs=[];
    for(const title of ['Erste aktuelle Datei','Zweite aktuelle Datei']) {
      const pdf=await PDFDocument.create();pdf.addPage().drawText(title);
      const form=new FormData();form.set('metadata',JSON.stringify({title,category:'Nachweise',sourceLabel:'Testquelle',reason:'Die Quelle muss zur manuellen Einzelprüfung erhalten bleiben'}));form.set('file',new Blob([await pdf.save()]),'Test.pdf');
      const response=await fetch(f.base+'/api/v1'+api+'/documents',{method:'POST',headers:{Authorization:'Bearer '+agent.token},body:form});assert.equal(response.status,201);docs.push((await response.json()).data);
    }
    const ui=await reviewer(f.base,f.password);
    const overview=await ui.page(base);
    assert.match(overview,/aria-label="Offene Punkte und Vorschläge"/);assert.match(overview,/data-work-row/);
    assert.match(overview,/name="answers\[open\]"/);
    assert.doesNotMatch(overview,/LANGER_URSPRUNGS_AUFTRAG|BESTAETIGTE_ANTWORT|name="answers\[done\]"/);
    const questions=await ui.page(base+'?ansicht=angaben');
    assert.match(questions,/name="answers\[open\]"/);assert.doesNotMatch(questions,/name="answers\[done\]"/);
    assert.match(await ui.page(base+'?ansicht=verlauf'),/BESTAETIGTE_ANTWORT/);
    const review=await ui.page(base+'/dateien/'+docs[0].id);
    assert.match(review,/name="continueReview" value="1"/);assert.match(review,/<details class="assistant-assignment"><summary>Zuordnung ändern/);
    assert.ok(review.indexOf('name="title"') < review.indexOf('class="assistant-assignment"'));
    assert.match(review,/<details class="assistant-source-details"><summary>Quelle &amp; Details/);
    assert.doesNotMatch(review,/data-file-row|name="answers\[/);
    await (await ui.request(base+'/dateien/'+docs[0].id+'/inhalt')).arrayBuffer();
    const fields={sha256:docs[0].sha256,revision:(await f.request('/projects/same')).etag.slice(1,-1),title:docs[0].title,category:'Nachweise',continueReview:'1'};
    assert.equal((await ui.post(base+'/dateien/'+docs[0].id+'/uebernehmen',fields)).status,409);
    const accepted=await ui.post(base+'/dateien/'+docs[0].id+'/uebernehmen',{...fields,reviewed:'on'});
    assert.equal(accepted.status,302);assert.ok(accepted.headers.get('location').startsWith(base+'/dateien/'+docs[1].id));
    job=(await f.request(api,{token:agent.token})).data.data;
    assert.equal(job.documents[0].state,'approved');assert.equal(job.documents[1].state,'pending');
  } finally { await f.cleanup(); }
});

test("Material zu edoku: belegte Chatantworten, Projektkatalog, Kapitelentwurf, Versionshistorie und GUI-Freigabe bis zum Export", async t => {
  const f = await fixture({ setup: async args => {
    await setup(args);
    const file = path.join(args.root, "data/dokumentenmatrix.json");
    const matrix = JSON.parse(await fs.readFile(file)); matrix[0].formularart = "Text";
    await fs.writeFile(file, JSON.stringify(matrix));
  } });
  const agent = f.makeToken("alice", { scopes });
  const client = mcpClient(f.base, agent.token, true);
  const call = async (name, args) => { const r = await client.rpc("tools/call", { name, arguments: args }); assert.ok(!r.error && !r.result.isError, JSON.stringify(r)); return r.result.structuredContent.data; };
  const request = (route, options = {}) => f.request(route, { token: agent.token, ...options });
  let projectId, jobId, draft1, draft2, exportId;
  try {
    await client.initialize();
    projectId = (await call("edoku_create_project", { requestId: "material_project_001", input: { projektname: "Künstlicher Materialtest", projektnummer: "MCP-FLOW", auftraggeber: "Testkunde", liegenschaft: "Testhalle", baumassnahme: "Testinstallation" } })).id;
    const route = `/projects/${projectId}`, jobRoute = () => `${route}/assistant/jobs/${jobId}`;
    const revision = async () => (await request(route)).etag;
    const currentJob = async () => (await request(jobRoute())).data.data;
    await call("edoku_select_service_areas", { projectId, etag: await revision(), selection: { active: [area] } });
    const catalogBefore = await fs.readFile(path.join(f.root, "data/systeme.json"));
    await t.test("Belegter Projektkatalog ergänzt Sondertypen ohne globale Vorgaben oder Geräte zu verändern", async () => {
      await call("edoku_select_systems", { projectId, etag: await revision(), selection: { items: [{ leistungsbereich: area, hersteller: "Projekt-Sonderhersteller", systemart: "Sondertyp 01", evidence: { sourceLabel: "Künstliche Materialliste", sourceQuote: "Projekt-Sonderhersteller Sondertyp 01" } }] } });
      const systems = (await request(route + "/systems")).data.data.items;
      assert.equal(systems.find(x => x.leistungsbereich === area).hersteller, "Projekt-Sonderhersteller");
      assert.deepEqual(await fs.readFile(path.join(f.root, "data/systeme.json")), catalogBefore);
      await call("edoku_select_service_areas", { projectId, etag: await revision(), selection: { active: [area] } });
      assert.equal((await request(route + "/systems")).data.data.items.find(x => x.leistungsbereich === area).hersteller, "Projekt-Sonderhersteller");
    });
    const lists = (await request(route + "/device-lists")).data.data.items;
    await call("edoku_add_device_position", { projectId, listId: lists.find(list => list.aktiv && list.leistungsbereich === area).id, etag: await revision(), values: { hersteller: "Projekt-Sonderhersteller", typ: "Sondertyp 01", system: "Test", beschreibung: "Künstliches Prüfgerät" } });
    await registerFixtureMaterial(request,projectId,lists.find(list=>list.aktiv&&list.leistungsbereich===area).id);
    jobId = (await call("edoku_create_documentation_job", { projectId, requestId: "material_job_001", input: { instruction: "Künstlichen vollständigen Materialablauf testen.", requirements: [{ id: "native_text", title: "Projektbezogene Anlagenbeschreibung", category: "Anlagenbeschreibungen" }] } })).id;
    await call("edoku_update_documentation_job", { projectId, jobId, update: { questions: [{ id: "customer", prompt: "Wer ist Auftraggeber?" }, { id: "old_scope", prompt: "Gehört die alte Testanlage dazu?" }] } });
    await t.test("Chatbelege sind versioniert, benutzergebunden und beseitigen nur beantwortete oder belegbar überholte Fragen", async () => {
      const version = (await currentJob()).version;
      await call("edoku_record_user_answers", { projectId, jobId, input: { version, answers: [{ questionId: "customer", answer: "Testkunde", evidence: { sourceLabel: "Testchat", sourceQuote: "Mein Auftraggeber ist Testkunde" } }], obsolete: [{ questionId: "old_scope", reason: "Durch die aktuelle Materialliste ersetzt", evidence: { sourceLabel: "Testchat", sourceQuote: "Wir nehmen ausschließlich diese Materialliste" } }] } });
      assert.equal((await currentJob()).questions[0].evidence.kind, "chat");
      assert.equal((await currentJob()).questions[1].obsolete.reason, "Durch die aktuelle Materialliste ersetzt");
      assert.equal((await request(jobRoute() + "/answers", { method: "POST", body: { version, answers: [{ questionId: "customer", answer: "Veraltet", evidence: { sourceLabel: "Test", sourceQuote: "Test" } }] } })).status, 412);
      const reader = f.makeToken("alice", { scopes: ["assistant:read"] });
      assert.equal((await f.request(jobRoute() + "/answers", { token: reader.token, method: "POST", body: {} })).status, 403);
      const other = f.makeToken("bob", { scopes });
      assert.equal((await f.request(jobRoute() + "/answers", { token: other.token, method: "POST", body: {} })).status, 404);
    });
    const prepare = async (revisionLabel, supersedes = []) => {
      const args = { projectId, jobId, etag: await revision(), requestId: "material_prepare_" + revisionLabel, input: { title: "Projektbezogene Anlagenbeschreibung", sourceLabel: "Künstliche Materialliste und Testchat", reason: "Test der manuellen Kapitelübernahme", documentRevision: revisionLabel, requirementIds: ["native_text"], supersedes, expectedJobVersion: (await currentJob()).version, content: { scope: "documentation", documentId: "description", sections: [{ heading: "Bestätigter Umfang", text: "Zwei benannte Verteilungen des bestätigten Typs. Messwerte und Abnahme sind offen. " + revisionLabel }] } } };
      const draft = await call("edoku_prepare_project_document", args);
      assert.equal((await call("edoku_prepare_project_document", args)).id, draft.id);
      return draft;
    };
    await t.test("Kapitelinhalt bleibt bis zur echten Einzelprüfung außerhalb der Projektdaten", async () => {
      draft1 = await prepare("R1");
      assert.equal((await request(route)).data.data.projekt.dokumentInhalte, undefined);
      assert.equal((await request(route + "/attachments")).data.data.total, 0);
      assert.equal(draft1.state, "pending");
      assert.equal((await request(jobRoute() + "/prepare-document", { method: "POST", headers: { "Idempotency-Key": "material_missing_etag" }, body: { title: "Test", sourceLabel: "Test", reason: "Test", content: { documentId: "description", sections: [{ heading: "H", text: "T" }] } } })).status, 428);
    });
    const ui = await reviewer(f.base, f.password, projectId), uiPath = `/assistent/auftraege/${jobId}`;
    const approve = async (document, viewed = true) => {
      await ui.page(`${uiPath}/dateien/${document.id}`);
      if (viewed) await (await ui.request(`${uiPath}/dateien/${document.id}/inhalt`)).arrayBuffer();
      return ui.post(`${uiPath}/dateien/${document.id}/uebernehmen`, { reviewed: "on", sha256: document.sha256, revision: (await revision()).slice(1, -1), title: document.title, category: document.category });
    };
    await t.test("R2 löst R1 ab, ohne Freigabe; historische Fassung kann nicht übernommen werden", async () => {
      const intermediate = await prepare("R1b", [draft1.id]);
      draft2 = await prepare("R2");
      await call("edoku_replace_document_proposals", { projectId, jobId, input: { version: (await currentJob()).version, replacements: [{ previousId: intermediate.id, replacementId: draft2.id }] } });
      assert.equal((await currentJob()).documents.find(x => x.id === draft1.id).state, "superseded");
      assert.equal((await approve(draft1)).status, 409);
      assert.equal((await approve(draft2, false)).status, 409);
      const proofPdf = await PDFDocument.create(); proofPdf.addPage().drawText("Synthetic manufacturer evidence");
      const proofForm = new FormData();
      proofForm.set("metadata", JSON.stringify({ title: "Künstlicher Herstellernachweis", category: "Nachweise", sourceLabel: "Künstliche Testquelle", reason: "Nachweise müssen im Gesamt-PDF enthalten sein" }));
      proofForm.set("file", new Blob([await proofPdf.save()]), "Nachweis.pdf");
      const proofResponse = await fetch(f.base + "/api/v1" + jobRoute() + "/documents", { method: "POST", headers: { Authorization: "Bearer " + agent.token }, body: proofForm });
      assert.equal(proofResponse.status, 201);
      assert.equal((await approve((await proofResponse.json()).data)).status, 302);
      const manualPdf = await PDFDocument.create(); manualPdf.addPage().drawText("Synthetic original operating manual");
      const manualForm = new FormData();
      manualForm.set("metadata", JSON.stringify({ title: "Künstliche Geräteanleitung", category: "Bedienungsanleitungen", sourceLabel: "Künstliche Testquelle", reason: "Bereits freigegebene Quelle weiteren Geräten zuordnen" }));
      manualForm.set("file", new Blob([await manualPdf.save()]), "Anleitung.pdf");
      const manualResponse = await fetch(f.base + "/api/v1" + jobRoute() + "/documents", { method: "POST", headers: { Authorization: "Bearer " + agent.token }, body: manualForm });
      assert.equal(manualResponse.status, 201);
      const manual = (await manualResponse.json()).data;
      const target = { listId: lists.find(list => list.aktiv && list.leistungsbereich === area).id, position: 1, manufacturer: "Projekt-Sonderhersteller", model: "Sondertyp 01" };
      assert.equal((await request(route + "/approved-document-links", { method: "POST", headers: { "If-Match": await revision() }, body: { attachmentId: "anh_" + manual.id, devices: [target] } })).status, 409);
      assert.equal((await approve(manual)).status, 302);
      await call("edoku_link_existing_document", { projectId, etag: await revision(), input: { attachmentId: "anh_" + manual.id, devices: [target] } });
      const linked = (await request(`${route}/device-lists/${target.listId}`)).data.data.positionen.items;
      assert.equal(linked[0].bedienungsanleitungId, "anh_" + manual.id);
      await call('edoku_update_documentation_job', { projectId, jobId, update: { requirements: [{ id: 'reused_original', title: 'Vorhandene Originalanleitung für bestätigtes Gerät wiederverwenden', category: 'Bedienungsanleitungen', device: target }] } });
      const html = await ui.page(uiPath + '?ansicht=verlauf');
      assert.match(html, /Ersetzte Entwürfe/); assert.match(html, /Aus dem Chat übernommen/);
      const status = (await request(route + "/documentation-status?assistantJobId=" + jobId)).data.data;
      assert.equal(status.pendingDocuments.length, 1);
      assert.equal(status.requirements.find(item => item.id === 'reused_original').fulfilledBy, manual.id);
      assert.ok(!status.issues.some(x => x.code === "ANSWER_REQUIRED"));
      exportId = (await call("edoku_queue_export", { projectId, jobId, requestId: "material_export_001" })).id;
      await new Promise(resolve => setTimeout(resolve, 900));
      assert.equal((await request(`${route}/export-jobs/${exportId}`)).data.data.state, "waiting_review");
    });
    await t.test("GUI-Freigabe übernimmt genau die gesichtete Datei und deren Text ins richtige Kapitel", async () => {
      assert.equal((await approve(draft2)).status, 302);
      const project = (await request(route)).data.data.projekt;
      assert.equal(project.dokumentInhalte.description.sha256, draft2.sha256);
      assert.match(project.dokumentInhalte.description.sections[0].text, /R2/);
      const attachments = (await request(route + "/attachments")).data.data.items;
      const chapter = attachments.find(item => item.matrixDocumentId === "description");
      assert.ok(chapter);
      const matrix = (await request(route + "/documents")).data.data.items;
      const plan = buildDocumentationPlan(matrix, [], attachments);
      assert.ok(plan.some(x => x.dokumenttyp === "Nachweise" && x.attachmentId));
      assert.equal(plan.filter(x => x.matrixId === "description").length, 1);
      assert.equal(plan.find(x => x.matrixId === "description").attachmentId, chapter.id);
      const current = await currentJob();
      assert.equal((await request(jobRoute() + "/replacements", { method: "POST", body: { version: current.version, replacements: [{ previousId: draft2.id, replacementId: draft1.id }] } })).status, 409);
    });
    await t.test("Freigegebenes Kapitel gelangt ohne doppelte Anlagenbeschreibung in Gesamt-PDF und ZIP", async () => {
      let run;
      for (let n = 0; n < 50; n++) {
        run = (await request(`${route}/export-jobs/${exportId}`)).data.data;
        if (run.state === "succeeded") break;
        assert.ok(!["failed", "incomplete", "stale"].includes(run.state), JSON.stringify(run));
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      assert.equal(run.state, "succeeded", JSON.stringify(run)); assert.equal(run.result.summary.complete, true);
      assert.ok(run.files.some(x => x.kind === "pdf") && run.files.some(x => x.kind === "zip"));
      await f.restart();
      assert.equal((await currentJob()).questions[0].answer, "Testkunde");
      assert.equal((await currentJob()).documents.find(x => x.id === draft1.id).state, "superseded");
    });
  } finally { await client.close(); await f.cleanup(); }
});

test("Datenblätter: Vorschläge vorsortieren, Kategorie vorauswählen und Korrekturen bis zum Export berücksichtigen", async () => {
  const f = await fixture();
  try {
    const agent = f.makeToken("alice", { scopes: ["projects:read", "devices:read", "documents:read", "assistant:read", "assistant:write"] });
    const created = await f.request("/projects/same/assistant/jobs", { token: agent.token, method: "POST", body: {
      instruction: "Datenblatt und Anleitung für das künstliche Testgerät vorbereiten.",
      requirements: [{ id: "datasheet", title: "Technisches Produktdatenblatt", category: "Datenblätter" }]
    } });
    assert.equal(created.status, 201);
    const jobId = created.data.data.id, apiPath = `/projects/same/assistant/jobs/${jobId}`, uiPath = `/assistent/auftraege/${jobId}`;
    const propose = async (title, category, requirementIds = []) => {
      const pdf = await PDFDocument.create(); pdf.addPage().drawText(title);
      const body = new FormData();
      body.set("metadata", JSON.stringify({ title, category, requirementIds, sourceLabel: "Künstliche Testquelle", reason: "Test der vorgeschlagenen Dokumentkategorie" }));
      body.set("file", new Blob([await pdf.save()]), "Test.pdf");
      const response = await fetch(`${f.base}/api/v1${apiPath}/documents`, { method: "POST", headers: { Authorization: `Bearer ${agent.token}` }, body });
      assert.equal(response.status, 201);
      return (await response.json()).data;
    };
    const corrected = await propose("A Produktdaten", "Bedienungsanleitungen", ["datasheet"]);
    const last = await propose("Z Datenblatt", "Datenblätter");
    const first = await propose("B Datenblatt", "Datenblätter");
    const approved = await propose("A Datenblatt", "Datenblätter");
    const ui = await reviewer(f.base, f.password);
    const approve = async (document, category) => {
      await ui.page(`${uiPath}/dateien/${document.id}`);
      await (await ui.request(`${uiPath}/dateien/${document.id}/inhalt`)).arrayBuffer();
      const revision = (await f.request("/projects/same")).etag.slice(1, -1);
      assert.equal((await ui.post(`${uiPath}/dateien/${document.id}/uebernehmen`, { reviewed: "on", sha256: document.sha256, revision, title: document.title, category })).status, 302);
    };
    let html = await ui.page(`${uiPath}/dateien/${first.id}`);
    assert.match(html, /<option value="Datenblätter" selected>Datenblätter<\/option>/);
    html = await ui.page(`${uiPath}/dateien/${corrected.id}`);
    assert.match(html, /<option value="Bedienungsanleitungen" selected>/);
    assert.match(html, /<option value="Datenblätter">Datenblätter<\/option>/);
    await approve(approved, "Datenblätter");
    html = await ui.page(uiPath + '?ansicht=dateien&filter=all');
    const group = html.match(/<section class="assistant-document-group" aria-label="Datenblätter"[^>]*>([\s\S]*?)<\/section>/)[1];
    assert.ok(group.indexOf("B Datenblatt") < group.indexOf("Z Datenblatt"));
    assert.ok(group.indexOf("Z Datenblatt") < group.indexOf("A Datenblatt")); // Offene Sichtungen vor übernommenen Dateien.
    assert.doesNotMatch(group, /A Produktdaten/);
    const status = async () => { const result = await f.request(`/projects/same/documentation-status?assistantJobId=${jobId}`, { token: agent.token }); assert.equal(result.status, 200, JSON.stringify(result)); return result.data.data; };
    assert.equal((await status()).requirements[0].fulfilled, false);
    await approve(corrected, "Datenblätter");
    assert.equal((await status()).requirements[0].fulfilled, true);
    const attachments = JSON.parse(f.db.prepare("SELECT payload FROM project_documents WHERE user_id='alice' AND project_id='same' AND name='anhaenge.json'").get().payload);
    assert.equal(attachments.length, 2);
    assert.ok(attachments.every(item => item.category === "Datenblätter" && item.kapitel === "7" && item.export === true));
    const plan = buildDocumentationPlan([], [], attachments);
    assert.equal(plan.filter(entry => entry.attachmentId).length, 2);
    assert.ok(plan.filter(entry => entry.attachmentId).every(entry => entry.parentKapitel === "7" && entry.dokumenttyp === "Datenblätter"));
    html = await ui.page("/anhaenge?kategorie=" + encodeURIComponent("Datenblätter"));
    assert.match(html, /<h1>Datenblätter<\/h1>/);
    assert.match(html, /A Produktdaten/);
    assert.match(html, /name="anlage"/);
    assert.equal((await f.request(apiPath, { token: agent.token })).data.data.documents.find(document => document.id === last.id).state, "pending");
  } finally { await f.cleanup(); }
});

test("Dokumentationsablauf: MCP-Projektanlage, konkrete Lücken und Pflichtunterlagen", async t => {
  const f = await fixture({ setup });
  const agent = f.makeToken("alice", { name: "Vollständiger künstlicher Prüflauf", scopes });
  const client = mcpClient(f.base, agent.token, true);
  let projectId, jobId, listId, exportId;
  const request = (route, options = {}) => f.request(route, { token: agent.token, ...options });
  const revision = async () => (await request(`/projects/${projectId}`)).etag;
  const call = async (name, args) => {
    const response = await client.rpc("tools/call", { name, arguments: args });
    assert.ok(!response.error && !response.result.isError, JSON.stringify(response));
    return response.result.structuredContent;
  };
  const waitForExport = async (expected, identifier = exportId) => {
    let state;
    for (let n = 0; n < 40; n++) {
      state = (await request(`/projects/${projectId}/export-jobs/${identifier}`)).data.data;
      if (expected.includes(state?.state)) return state;
      if (["failed", "stale", "incomplete"].includes(state?.state)) assert.fail(JSON.stringify(state));
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.fail("Export blieb stehen: " + JSON.stringify(state));
  };
  try {
    await client.initialize();
    await t.test("Projektanlage über echtes MCP ist wiederholungssicher und wechselt das Browserprojekt nicht", async () => {
      const args = { input: { projektname: "Künstliches Doku-Beispiel", projektnummer: "GOAL-TEST" }, requestId: "goal_project_create_001" };
      const first = await call("edoku_create_project", args), replay = await call("edoku_create_project", args);
      projectId = first.data.id;
      assert.equal(replay.data.id, projectId);
      assert.equal(f.db.prepare("SELECT count(*) n FROM projects WHERE user_id='alice' AND id=?").get(projectId).n, 1);
      assert.equal(f.db.prepare("SELECT current_project_id FROM users WHERE id='alice'").get().current_project_id, "same");
      assert.equal((await request("/projects", { method: "POST", headers: { "Idempotency-Key": args.requestId }, body: { projektname: "Anderer Inhalt" } })).status, 409);
      const restricted = f.makeToken("alice", { scopes: ["projects:write"], projectIds: ["same"] });
      assert.equal((await f.request("/projects", { token: restricted.token, method: "POST", headers: { "Idempotency-Key": "restricted_create" }, body: { projektname: "Nicht erlaubt" } })).status, 403);
      const parallel = () => request("/projects", { method: "POST", headers: { "Idempotency-Key": "goal_parallel_project_002" }, body: { projektname: "Künstliche parallele Anlage" } });
      const pair = await Promise.all([parallel(), parallel()]);
      assert.ok(pair.some(result => result.status === 201));
      assert.ok(pair.every(result => [201, 409].includes(result.status)));
      const repeated = await parallel();
      assert.equal(f.db.prepare("SELECT count(*) n FROM projects WHERE user_id='alice' AND id=?").get(repeated.data.data.id).n, 1);
    });
    await t.test("Status benennt fehlende Stammdaten konkret und bleibt vor der Ergänzung unvollständig", async () => {
      const status = await call("edoku_documentation_status", { projectId, view: "full" });
      assert.equal(status.data.canGenerate, false);
      assert.ok(status.data.issues.some(issue => issue.field === "auftraggeber"));
      assert.ok(status.data.issues.some(issue => issue.code === "SERVICE_AREA_MISSING"));
      assert.ok(status.data.suggestedQuestions.some(question => question.prompt.includes("Auftraggeber")));
      assert.equal(status.data.professionalApproval, "not_assessed");
    });
    await t.test("Leistungsbereiche, Systeme und Dokumentauswahl benutzen echte bestehende Fachlogik", async () => {
      const catalog = (await call("edoku_get_section", { projectId, section: "system-catalog" })).data;
      assert.equal(catalog.items[0].name, area);
      const manufacturers=(await call("edoku_get_section",{projectId,section:"system-catalog",serviceArea:area})).data;
      assert.equal(manufacturers.items[0].name,"Beispielhersteller");
      assert.equal((await request(`/projects/${projectId}/system-catalog`)).status, 200);
      await call("edoku_select_service_areas", { projectId, etag: await revision(), selection: { active: [area] } });
      const lists = await request(`/projects/${projectId}/device-lists`);
      listId = lists.data.data.items.find(item => item.leistungsbereich === area).id;
      await call("edoku_select_systems", { projectId, etag: await revision(), selection: { items: [{ leistungsbereich: area, hersteller: "Beispielhersteller", systemart: "Testinstallation", herstellerSystem: "Testsystem", dokumentarten: ["Bedienungsanleitung"] }] } });
      assert.equal((await request(`/projects/${projectId}/systems`)).data.data.items.find(item => item.leistungsbereich === area).hersteller, "Beispielhersteller");
      assert.equal((await request(`/projects/${projectId}/documents`, { method: "PATCH", headers: { "If-Match": await revision() }, body: { items: [{ id: "description", export: false }] } })).status, 403);
      const before = await revision();
      assert.equal((await request(`/projects/${projectId}/service-areas`, { method: "PATCH", headers: { "If-Match": before }, body: { active: ["Erfundener Bereich"] } })).status, 400);
      assert.equal(await revision(), before);
    });
    await t.test("Gerätelücken verschwinden erst bei tatsächlicher Speicherung; POST-Wiederholung legt keine zweite Position an", async () => {
      const fields = { hersteller: "Beispielhersteller", typ: "Test 100", system: "Testsystem", beschreibung: "Künstliches Prüfgerät" };
      await call("edoku_add_device_position", { projectId, listId, etag: await revision(), requestId: "goal_device_position_001", values: fields });
      const args = { projectId, listId, etag: await revision(), requestId: "goal_device_position_002", values: fields };
      const first = await call("edoku_add_device_position", args), replay = await call("edoku_add_device_position", args);
      assert.equal(replay.data.pos, first.data.pos);
      const list = await request(`/projects/${projectId}/device-lists/${listId}`);
      assert.equal(list.data.data.positionen.total, 2);
      await registerFixtureMaterial(request,projectId,listId);
      assert.ok(!(await request(`/projects/${projectId}/documentation-status`)).data.data.issues.some(issue => issue.code === "DEVICE_FIELD_MISSING"));
    });
    await t.test("Pflichtunterlage und Rückfrage bleiben am Auftrag gebunden und können nicht still abgeschwächt werden", async () => {
      const requirement = { id: "manual_test_100", title: "Bedienungsanleitung Test 100, Revision R1", category: "Bedienungsanleitungen", device: { listId, position: 1, manufacturer: "Beispielhersteller", model: "Test 100", revision: "R1" } };
      const args = { projectId, requestId: "goal_documentation_job_001", input: { instruction: "Erstelle die Dokumentation für das künstliche Prüfprojekt. Frage fehlende Daten ab und prüfe jede Quelle.", requirements: [requirement] } };
      const created = await call("edoku_create_documentation_job", args); jobId = created.data.id;
      assert.equal((await call("edoku_create_documentation_job", args)).data.id, jobId);
      await call("edoku_update_documentation_job", { projectId, jobId, update: { questions: [{ id: "client_name", prompt: "Wie heißen Auftraggeber und Liegenschaft für dieses künstliche Projekt?", required: true }] } });
      assert.equal((await request(`/projects/${projectId}/assistant/jobs/${jobId}`, { method: "PATCH", body: { requirements: [{ ...requirement, device: { ...requirement.device, model: "Anderes Gerät" } }] } })).status, 409);
      const status = (await request(`/projects/${projectId}/documentation-status?assistantJobId=${jobId}`)).data.data;
      assert.ok(status.issues.some(issue => issue.code === "ANSWER_REQUIRED"));
      assert.ok(status.issues.some(issue => issue.code === "REQUIRED_DOCUMENT_MISSING"));
    });
    await t.test("Hintergrundexport wartet auf tatsächliche Eingaben; wiederholter MCP-Aufruf erzeugt keinen zweiten Auftrag", async () => {
      const args = { projectId, jobId, requestId: "goal_background_export_001" };
      const first = await call("edoku_queue_export", args); exportId = first.data.id;
      assert.equal((await call("edoku_queue_export", args)).data.id, exportId);
      const waiting = await waitForExport(["waiting_input"]);
      assert.equal(waiting.attempt, 0);
      assert.equal(waiting.files.length, 0);
      assert.equal((await request(`/projects/${projectId}/export-jobs/${exportId}/files/pdf`)).status, 409);
      const restricted = f.makeToken("bob", { scopes: ["exports:read"] });
      assert.equal((await f.request(`/projects/${projectId}/export-jobs/${exportId}`, { token: restricted.token })).status, 404);
    });
    await t.test("Benutzerantwort ist nach einem Serverneustart vorhanden; der Agent ergänzt nur die angegebenen Stammdaten", async () => {
      const ui = await reviewer(f.base, f.password, projectId);
      await ui.page(`/assistent/auftraege/${jobId}`);
      assert.equal((await ui.post(`/assistent/auftraege/${jobId}/antworten`, { "answers[client_name]": "Auftraggeber: Beispiel GmbH; Liegenschaft: Musterhaus" })).status, 302);
      await f.restart();
      const resumed = await call("edoku_get_documentation_job", { projectId, jobId, view:"full" });
      assert.equal(resumed.data.questions[0].answer, "Auftraggeber: Beispiel GmbH; Liegenschaft: Musterhaus");
      assert.equal((await request(`/projects/${projectId}/export-jobs/${exportId}`)).data.data.id, exportId);
      await call("edoku_patch_project", { projectId, etag: await revision(), changes: { auftraggeber: "Beispiel GmbH", liegenschaft: "Musterhaus", baumassnahme: "Künstliche Bestandsdokumentation" } });
    });
    await t.test("Dateivorschlag erfüllt eine Pflichtquelle erst nach simulierter Benutzerfreigabe; spätere Geräteänderung wird erkannt", async () => {
      const pdf = await PDFDocument.create(); pdf.addPage().drawText("Kuenstliche Bedienungsanleitung Test 100 - Revision R1");
      const body = new FormData();
      body.set("metadata", JSON.stringify({ title: "Test 100 - Bedienungsanleitung R1", category: "Bedienungsanleitungen", sourceLabel: "Künstliche Herstellerquelle", sourceUrl: "https://example.com/test-100-r1.pdf", documentRevision: "R1", requirementIds: ["manual_test_100"], reason: "Hersteller, Modell und Revision passen zur angegebenen Geräteposition." }));
      body.set("file", new Blob([await pdf.save()]), "Test_100_R1.pdf");
      const upload = await fetch(`${f.base}/api/v1/projects/${projectId}/assistant/jobs/${jobId}/documents`, { method: "POST", headers: { Authorization: `Bearer ${agent.token}` }, body });
      assert.equal(upload.status, 201); const document = (await upload.json()).data;
      const pending = (await request(`/projects/${projectId}/documentation-status?assistantJobId=${jobId}`)).data.data;
      assert.equal(pending.reviewComplete, false); assert.equal(pending.requirements[0].fulfilled, false);
      assert.equal((await waitForExport(["waiting_review"])).attempt, 0);
      const ui = await reviewer(f.base, f.password, projectId);
      await ui.page(`/assistent/auftraege/${jobId}/dateien/${document.id}`);
      await (await ui.request(`/assistent/auftraege/${jobId}/dateien/${document.id}/inhalt`)).arrayBuffer();
      assert.equal((await ui.post(`/assistent/auftraege/${jobId}/dateien/${document.id}/uebernehmen`, { reviewed: "on", sha256: document.sha256, revision: (await revision()).slice(1, -1), title: document.title, category: document.category })).status, 302);
      const ready = (await request(`/projects/${projectId}/documentation-status?assistantJobId=${jobId}`)).data.data;
      assert.equal(ready.canGenerate, true); assert.equal(ready.requirements[0].fulfilled, true);
      assert.equal(ready.technicalExportComplete, false); // Interne PDFs wurden noch nicht erzeugt.
      await call("edoku_patch_device_position", { projectId, listId, position: 1, etag: await revision(), changes: { typ: "Anderes Gerät" } });
      const changed = (await request(`/projects/${projectId}/documentation-status?assistantJobId=${jobId}`)).data.data;
      assert.equal(changed.canGenerate, false); assert.ok(changed.issues.some(issue => issue.code === "DEVICE_REFERENCE_CHANGED"));
      await call("edoku_patch_device_position", { projectId, listId, position: 1, etag: await revision(), changes: { typ: "Test 100" } });
    });
    await t.test("Nach Dateifreigabe entstehen echte, prüfbare PDF-, ZIP- und Berichtsdateien ohne Änderung der Projektdaten", async () => {
      const before = await revision();
      const done = await waitForExport(["succeeded"]);
      assert.equal(done.attempt, 1);
      assert.equal(done.current, true);
      assert.equal(await revision(), before);
      assert.deepEqual(done.files.map(file => file.kind), ["pdf", "zip", "report"]);
      const downloads = {};
      for (const file of done.files) {
        const response = await fetch(`${f.base}/api/v1/projects/${projectId}/export-jobs/${exportId}/files/${file.kind}`, { headers: { Authorization: `Bearer ${agent.token}` } });
        assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.length, file.bytes);
        assert.equal(require("node:crypto").createHash("sha256").update(bytes).digest("hex"), file.sha256);
        downloads[file.kind] = bytes;
      }
      assert.ok((await PDFDocument.load(downloads.pdf)).getPageCount() >= 3);
      assert.equal(downloads.zip.subarray(0, 2).toString(), "PK");
      assert.ok(downloads.zip.includes(Buffer.from("DOKUMENTATIONSBERICHT.json")));
      const zipCheck = require("node:child_process").spawnSync("python3", ["-c", "import io,sys,json,zipfile,hashlib\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nassert z.testzip() is None\nprint(json.dumps([{'name':n,'sha256':hashlib.sha256(z.read(n)).hexdigest()} for n in z.namelist()]))"], { input: downloads.zip, encoding: "utf8" });
      assert.equal(zipCheck.status, 0, zipCheck.stderr);
      const zipFiles = JSON.parse(zipCheck.stdout);
      const approved = (await request(`/projects/${projectId}/assistant/jobs/${jobId}`)).data.data.documents[0];
      assert.ok(zipFiles.some(file => file.sha256 === approved.sha256), "ZIP enthält die unveränderten freigegebenen PDF-Bytes");
      const report = JSON.parse(downloads.report.toString());
      assert.equal(report.exportJobId, exportId);
      assert.equal(report.requirements[0].fulfilled, true);
      assert.equal(report.sources.length, 1);
      assert.equal(report.professionalApproval, "not_assessed");
      if (process.env.EDOKU_WORKFLOW_EVIDENCE_DIR) {
        const directory = path.resolve(process.env.EDOKU_WORKFLOW_EVIDENCE_DIR);
        await fs.mkdir(directory, { recursive: true });
        for (const file of done.files) await fs.writeFile(path.join(directory, file.name), downloads[file.kind]);
        await fs.writeFile(path.join(directory, "prueflauf.json"), JSON.stringify({ note: "Ausschließlich künstliche Daten. Benutzerantwort und GUI-Einzelfreigabe wurden durch den Test simuliert; keine menschliche oder fachliche Abnahme.", export: done, zipFiles }, null, 2));
      }
      assert.equal((await request(`/projects/${projectId}/documentation-status?assistantJobId=${jobId}`)).data.data.technicalExportComplete, true);
      const pdfFile = done.files.find(file => file.kind === "pdf");
      const published = path.join(f.root, "storage/users/alice/projects", projectId, "output/runs", `${exportId}_a${done.attempt}`, "06_Final", pdfFile.name);
      const preserved = await fs.readFile(published);
      const tampered = Buffer.from(preserved); tampered[tampered.length - 1] ^= 1;
      await fs.writeFile(published, tampered);
      assert.equal((await request(`/projects/${projectId}/export-jobs/${exportId}/files/pdf`)).status, 409);
      await fs.writeFile(published, preserved);
      const ui = await reviewer(f.base, f.password, projectId);
      assert.match(await ui.page(`/assistent/auftraege/${jobId}?ansicht=export`), /Ausgabe vorbereiten/);
    });
    await t.test("Ablehnung einer Pflichtdatei bleibt eine erkennbare Lücke und erzeugt keinen scheinbar fertigen Export", async () => {
      const rejectedJob = (await call("edoku_create_documentation_job", { projectId, requestId: "goal_rejected_document_job", input: { instruction: "Künstlicher Negativtest: Pflichtunterlage ausdrücklich ablehnen.", requirements: [{ id: "rejected_manual", title: "Abgelehnte Testunterlage", category: "Bedienungsanleitungen" }] } })).data.id;
      const pdf = await PDFDocument.create(); pdf.addPage().drawText("Diese kuenstliche Datei soll abgelehnt werden.");
      const body = new FormData(); body.set("file", new Blob([await pdf.save()]), "Ablehnen.pdf");
      body.set("metadata", JSON.stringify({ title: "Unpassende künstliche Unterlage", category: "Bedienungsanleitungen", sourceLabel: "Künstliche Negativquelle", reason: "Bewusst zur Ablehnung vorgesehen", requirementIds: ["rejected_manual"] }));
      const uploaded = await fetch(`${f.base}/api/v1/projects/${projectId}/assistant/jobs/${rejectedJob}/documents`, { method: "POST", headers: { Authorization: `Bearer ${agent.token}` }, body });
      assert.equal(uploaded.status, 201); const document = (await uploaded.json()).data;
      const queued = (await call("edoku_queue_export", { projectId, jobId: rejectedJob, requestId: "goal_rejected_export_003" })).data.id;
      await waitForExport(["waiting_review"], queued);
      const ui = await reviewer(f.base, f.password, projectId); await ui.page(`/assistent/auftraege/${rejectedJob}/dateien/${document.id}`);
      assert.equal((await ui.post(`/assistent/auftraege/${rejectedJob}/dateien/${document.id}/ablehnen`, {})).status, 302);
      const blocked = await waitForExport(["waiting_input"], queued);
      assert.ok(blocked.result.readiness.issues.some(issue => issue.code === "REQUIRED_DOCUMENT_MISSING"));
      assert.equal(blocked.attempt, 0); assert.equal(blocked.files.length, 0);
      await call("edoku_cancel_export", { projectId, exportId: queued });
    });
    await t.test("Abbruch, Wiederaufnahme und abgelaufene Prozesssperre bleiben wiederholungssicher", async () => {
      await call("edoku_patch_project", { projectId, etag: await revision(), changes: { auftraggeber: "" } });
      const created = await call("edoku_queue_export", { projectId, jobId, requestId: "goal_cancel_retry_002" });
      const identifier = created.data.id;
      await waitForExport(["waiting_input"], identifier);
      assert.equal((await call("edoku_cancel_export", { projectId, exportId: identifier })).data.state, "cancelled");
      await f.restart();
      assert.equal((await request(`/projects/${projectId}/export-jobs/${identifier}`)).data.data.state, "cancelled");
      await call("edoku_retry_export", { projectId, exportId: identifier });
      await waitForExport(["waiting_input"], identifier);
      await f.stop();
      f.db.prepare("UPDATE documentation_exports SET state='running',lease_owner='dead-process',lease_until=0,next_check_at=0 WHERE id=?").run(identifier);
      await f.restart();
      await waitForExport(["waiting_input"], identifier);
      const revoked = f.makeToken("alice", { scopes });
      await request(`/projects/${projectId}/export-jobs/${identifier}/cancel`, { method: "POST", body: {} });
      await f.stop();
      f.db.prepare("UPDATE documentation_exports SET state='queued',origin_token_id=?,next_check_at=0 WHERE id=?").run(revoked.id, identifier);
      f.tokens.revoke("alice", revoked.id);
      await f.restart();
      const failed = await waitForExport(["failed"], identifier);
      assert.equal(failed.errorCode, "ACCESS_REVOKED");
      assert.equal(failed.files.length, 0);
    });
    await t.test("Änderungen und Rechteentzug während der PDF-Erzeugung veröffentlichen keine Ausgabe", async () => {
      await call("edoku_patch_project", { projectId, etag: await revision(), changes: { auftraggeber: "Beispiel GmbH" } });
      await f.stop();
      let failedId;
      for (const scenario of ["revision", "source", "cancel", "role", "failure"]) {
        let entered, release;
        const reached = new Promise(resolve => { entered = resolve; });
        const gate = new Promise(resolve => { release = resolve; });
        const worker = createExportJobService(f.root, { db: f.db, intervalMs: 20, generate: async (root, data) => {
          await generateCompleteDocumentation(root, data); entered(); await gate;
          if (scenario === "failure") throw Error("Künstlicher Erzeugungsfehler");
        } });
        worker.start();
        const created = worker.create("alice", projectId, { assistantJobId: jobId });
        let sourcePath, originalSource;
        try {
          await Promise.race([reached, new Promise((_, reject) => { const timeout = setTimeout(() => reject(Error("Export erreichte Prüfpunkt nicht")), 10000); timeout.unref(); })]);
          if (scenario === "revision") f.db.prepare("UPDATE project_data_revisions SET version=version+1 WHERE user_id='alice' AND project_id=?").run(projectId);
          if (scenario === "source") {
            const proposal = f.db.prepare("SELECT attachment_id FROM document_proposals WHERE job_id=? AND state='approved'").get(jobId);
            sourcePath = path.join(f.root, "storage/users/alice/projects", projectId, "anhaenge", proposal.attachment_id + ".pdf");
            originalSource = await fs.readFile(sourcePath);
            const altered = Buffer.from(originalSource); altered[altered.length - 1] ^= 1; await fs.writeFile(sourcePath, altered);
          }
          if (scenario === "cancel") worker.cancel("alice", projectId, created.id);
          if (scenario === "role") f.db.prepare("UPDATE users SET role='viewer' WHERE id='alice'").run();
          release();
          let result;
          for (let n = 0; n < 100; n++) {
            result = worker.get("alice", projectId, created.id);
            if (!["queued", "running"].includes(result.state)) break;
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          assert.equal(result.state, scenario === "cancel" ? "cancelled" : ["source", "revision"].includes(scenario) ? "stale" : "failed", scenario + ": " + JSON.stringify(result));
          assert.equal(result.files.length, 0);
          if (scenario === "failure") failedId = created.id;
          await assert.rejects(worker.file("alice", projectId, created.id, "pdf"), { apiCode: "EXPORT_NOT_READY" });
        } finally {
          release(); await worker.stop();
          f.db.prepare("UPDATE users SET role='systemadmin' WHERE id='alice'").run();
          if (originalSource) await fs.writeFile(sourcePath, originalSource);
        }
      }
      await f.restart();
      await call("edoku_retry_export", { projectId, exportId: failedId });
      assert.equal((await waitForExport(["succeeded"], failedId)).attempt, 2);
    });
  } finally { await client.close(); await f.cleanup(); }
});

test('Arbeitsplatz: Zurückstellen und Wiederaufnahme schützen Versionen und lassen Dateifreigaben unverändert', async () => {
  const f = await fixture();
  try {
    const token = f.makeToken('alice', { scopes }).token;
    const request = (route, options = {}) => f.request(route, { token, ...options });
    const job = (await request('/projects/same/assistant/jobs', { method:'POST',body:{instruction:'Künstlichen Arbeitsplatz mit offenen Angaben und Einzelprüfung testen.'} })).data.data;
    const api = '/projects/same/assistant/jobs/' + job.id, base = '/assistent/auftraege/' + job.id;
    await request(api, {method:'PATCH',body:{questions:[{id:'place',prompt:'Wo ist das künstliche Gerät montiert?',required:true}]}});
    const ui = await reviewer(f.base,f.password);
    const html = await ui.page(base);
    assert.match(html,/data-work-drawer/); assert.match(html,/data-work-filter="waiting"/); assert.match(html,/Material hinzufügen/);
    const versions = async () => ({revision:(await request('/projects/same')).etag.slice(1,-1),jobVersion:(await request(api)).data.data.version});
    const hold = {target:JSON.stringify({kind:'question',questionId:'place'}),state:'deferred',reason:'Die Angabe kommt nach dem nächsten Vororttermin.',resumeCondition:'Nach dem Vororttermin',...await versions()};
    assert.equal((await ui.post(base+'/arbeit',hold)).status,302);
    let result = (await request('/projects/same/assistant/jobs/'+job.id+'/document-work')).data.data;
    assert.equal(result.items[0].state,'deferred');
    assert.equal((await request(api)).data.data.questions[0].answer,'');
    assert.equal((await ui.post(base+'/arbeit',{...hold,state:'resume'})).status,412);
    assert.equal((await ui.post(base+'/arbeit',{...hold,...await versions(),state:'resume',reason:'Vororttermin erledigt; Angabe kann jetzt geklärt werden.'})).status,302);
    result = (await request(api+'/document-work?history=true')).data.data;
    assert.deepEqual(result.items.map(r=>r.state),['deferred','resume']);
    const current = (await request(api)).data.data;
    const addition = {jobVersion:current.version,kind:'material',text:'Zwei künstliche Geräte zum Test ergänzen.'};
    assert.equal((await ui.post(base+'/ergaenzen',addition)).status,302);
    const updated = (await request(api)).data.data;
    assert.ok(updated.instruction.startsWith(current.instruction)); assert.match(updated.instruction,/Zwei künstliche Geräte/);
    assert.equal((await ui.post(base+'/ergaenzen',addition)).status,412);
    assert.equal(updated.documents.length,0); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views').get().n,0);
    const second = (await request('/projects/second/assistant/jobs',{method:'POST',body:{instruction:'Zweiter künstlicher Auftrag zum Prüfen der Projektwahl.'}})).data.data;
    assert.ok(!(await ui.page('/assistent?projekt=same')).includes('/auftraege/'+second.id));
    assert.equal((await ui.request(base+'/arbeit',{method:'POST',body:new URLSearchParams(hold)})).status,403);
    const document = (await request(api+'/prepare-document',{method:'POST',headers:{'If-Match':(await request('/projects/same')).etag,'Idempotency-Key':'workspace_reject_reason'},body:{title:'Künstlicher Ablehnungstest',sourceLabel:'Künstliche Quelle',reason:'Begründete Ablehnung muss dauerhaft am Vorschlag gespeichert werden',content:{sections:[{heading:'Test',text:'Keine echten Projektangaben.'}]}}})).data.data;
    await ui.page(base+'/dateien/'+document.id+'?panel=1');
    assert.equal((await ui.post(base+'/dateien/'+document.id+'/ablehnen',{reason:'Inhalt passt nicht zum Testartikel.',panel:'1'})).status,302);
    const rejected = (await request(api)).data.data.documents.find(d=>d.id===document.id);
    assert.equal(rejected.state,'rejected'); assert.equal(rejected.rejectionReason,'Inhalt passt nicht zum Testartikel.');
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views').get().n,0);

  } finally { await f.cleanup(); }
});

test('Aktives GUI-Projekt sperrt fremde Auftragslinks, Formulare und Downloads auch nach Projektwechsel', async () => {
  const f = await fixture();
  try {
    const token=f.makeToken('alice',{scopes}).token;
    const request=(route,options={})=>f.request(route,{token,...options});
    const jobs={};
    for(const projectId of ['same','second']) jobs[projectId]=(await request('/projects/'+projectId+'/assistant/jobs',{method:'POST',body:{instruction:'Künstlicher Auftrag im Projekt '+projectId+' zum Prüfen der GUI-Projektgrenze.'}})).data.data;
    const ui=await reviewer(f.base,f.password), first='/assistent/auftraege/'+jobs.same.id, other='/assistent/auftraege/'+jobs.second.id;
    const before=(await request('/projects/second/assistant/jobs/'+jobs.second.id)).data.data;
    const html=await ui.page('/assistent?projekt=second');
    assert.match(html,/Aktuelles Projekt/);assert.doesNotMatch(html,/data-project-picker|Alle Projekte|alice second/);
    assert.ok(!html.includes(jobs.second.id));
    assert.equal((await ui.request(other)).status,404);
    assert.equal((await ui.request(other+'/status')).status,404);
    assert.equal((await ui.request(other+'/dateien/missing/inhalt')).status,404);
    for(const action of ['antworten','arbeit','ergaenzen','export','abschliessen','dateien/missing/uebernehmen','dateien/missing/ablehnen']) assert.equal((await ui.post(other+'/'+action,{reason:'Keine projektfremde Änderung.'})).status,404,action);
    assert.equal((await ui.request('/assistent/projekte/second/exporte/missing/dateien/pdf')).status,404);
    assert.equal((await ui.post('/assistent/auftraege',{projectId:'second',instruction:'Darf das aktive Projekt nicht ändern.'})).status,409);
    assert.deepEqual((await request('/projects/second/assistant/jobs/'+jobs.second.id)).data.data,before);
    assert.equal((await (await ui.request('/assistent/status')).json()).projectId,'same');
    await ui.page('/projekte');assert.equal((await ui.post('/projekte/second/oeffnen',{})).status,302);
    const switched=await ui.page('/assistent');assert.match(switched,/alice second/);assert.ok(!switched.includes(jobs.same.id));
    assert.equal((await ui.request(first)).status,404);
    assert.equal((await ui.post(first+'/antworten',{})).status,404);
    // Ohne gültigen geöffneten Kontext wird kein anderes Projekt automatisch gewählt.
    f.db.prepare('UPDATE users SET current_project_id=NULL WHERE id=?').run('alice');
    assert.equal((await ui.request('/assistent')).status,409);
    assert.equal((await ui.post('/assistent/auftraege',{instruction:'Ohne Projekt keinen Auftrag anlegen.'})).status,409);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views').get().n,0);
  } finally { await f.cleanup(); }
});
