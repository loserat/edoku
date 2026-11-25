// Nur im isolierten Testcontainer ohne Original-Volumes starten.
// Die erzeugten Quellen sind frei erfunden; dieser Prozess gibt keine Datei frei.
const fs = require("node:fs/promises"), path = require("node:path");
const { PDFDocument } = require("pdf-lib");
const { fixture, mcpClient } = require("./helpers/integrationFixture");
const { setup, area } = require("./helpers/documentationExample");
const { scopes } = require("../src/api/schemas");

async function main() {
  const f = await fixture({ setup, port: Number(process.env.EDOKU_DEMO_PORT) || 3000 });
  const documents = path.join(f.root, "synthetic-sources"); await fs.mkdir(documents);
  const key = f.makeToken("alice", { name: "Künstliche MCP-Demonstration", scopes });
  const client = mcpClient(f.base, key.token, true, documents);
  const call = async (name, args) => {
    const result = await client.rpc("tools/call", { name, arguments: args });
    if (result.error || result.result.isError) throw Error(JSON.stringify(result));
    return result.result.structuredContent;
  };
  await client.initialize();
  const project = await call("edoku_create_project", { requestId: "demo_project_20261118", input: { projektname: "KÜNSTLICHES BEISPIEL – MCP-Abnahme", projektnummer: "DEMO-MCP-001", auftraggeber: "Beispiel GmbH (fiktiv)", liegenschaft: "Musterhaus (fiktiv)", baumassnahme: "Künstlicher Prüflauf ohne reale Anlagendaten" } });
  const projectId = project.data.id;
  const etag = async () => (await call("edoku_get_project", { projectId })).etag;
  await call("edoku_select_service_areas", { projectId, etag: await etag(), selection: { active: [area] } });
  await call("edoku_select_systems", { projectId, etag: await etag(), selection: { items: [{ leistungsbereich: area, hersteller: "Beispielhersteller", systemart: "Testinstallation", herstellerSystem: "Testsystem", dokumentarten: ["Bedienungsanleitung"] }] } });
  const listId = (await call("edoku_list_device_lists", { projectId })).data.items.find(list => list.leistungsbereich === area).id;
  await call("edoku_patch_device_position", { projectId, listId, position: 1, etag: await etag(), changes: { hersteller: "Beispielhersteller", typ: "Test 100", system: "Testsystem", beschreibung: "Fiktives Gerät für die API-Abnahme" } });
  const jobId = (await call("edoku_create_documentation_job", { projectId, requestId: "demo_job_20261118", input: { instruction: "Erstelle eine Dokumentation für dieses ausschließlich künstliche Beispiel. Frage nach fehlenden Daten. Jede vorbereitete Datei muss der Benutzer selbst sichten und einzeln bestätigen.", requirements: [{ id: "manual_test_100", title: "Test 100 – Anleitung R1", category: "Bedienungsanleitungen", device: { listId, position: 1, manufacturer: "Beispielhersteller", model: "Test 100", revision: "R1" } }] } })).data.id;
  await call("edoku_update_documentation_job", { projectId, jobId, update: { questions: [{ id: "reviewer", prompt: "Wer prüft dieses künstliche Beispielprojekt? Bitte einen Testnamen eingeben.", required: true }], message: "Die Dateien sind nur vorbereitet. Bitte jede Datei öffnen, prüfen und einzeln entscheiden. Es werden keine echten Herstellerunterlagen verwendet." } });
  for (const [filename, title, text, required] of [["Test_100_R1.pdf", "Test 100 – Anleitung R1 (künstlich)", "Kuenstliche Anleitung - Test 100 - Revision R1", true], ["Unpassend_Test_200.pdf", "Test 200 – unpassender Vorschlag (künstlich)", "Kuenstliches Gegenbeispiel - Test 200 - passt nicht zu Test 100", false]]) {
    const pdf = await PDFDocument.create(); const page = pdf.addPage();
    page.drawText("EDOKU - KUENSTLICHES PRUEFBEISPIEL", { x: 45, y: 770, size: 18 });
    page.drawText(text, { x: 45, y: 730, size: 12 });
    page.drawText("Keine Herstellerfreigabe. Keine reale Anlage. Keine technische Verwendbarkeit.", { x: 45, y: 690, size: 10 });
    page.drawText(required ? "Bitte Inhalt sichten und als Testdatei einzeln bestaetigen." : "Dieses Gegenbeispiel ist fuer eine manuelle Ablehnung vorgesehen.", { x: 45, y: 650, size: 10 });
    await fs.writeFile(path.join(documents, filename), await pdf.save());
    await call("edoku_propose_document", { projectId, jobId, filePath: path.join(documents, filename), metadata: { title, category: "Bedienungsanleitungen", sourceLabel: "Frei erfundene Quelle im isolierten Testcontainer", reason: required ? "Modell und Revision passen zum fiktiven Testgerät." : "Bewusst falsches Modell; bitte manuell ablehnen.", documentRevision: "R1", requirementIds: required ? ["manual_test_100"] : [] } });
  }
  const exportId = (await call("edoku_queue_export", { projectId, jobId, requestId: "demo_export_20261118" })).data.id;
  await client.close();
  const info = { artificial: true, projectId, jobId, exportId, url: `/assistent/auftraege/${jobId}`, login: "alice", password: f.password };
  if (process.env.EDOKU_DEMO_INFO) await fs.writeFile(process.env.EDOKU_DEMO_INFO, JSON.stringify(info, null, 2), { mode: 0o600 });
  process.stdout.write(JSON.stringify({ artificial: true, projectId, jobId, exportId, url: info.url }) + "\n");
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await f.cleanup(); process.exit(0); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
}
main().catch(error => { process.stderr.write(error.message + "\n"); process.exit(1); });
