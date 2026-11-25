// Ausschließlich künstliche Daten; keine Mounts der Benutzerinstallation verwenden.
const fs = require('node:fs/promises'), path = require('node:path');
const { fixture } = require('./integrationFixture');
const { createDocumentAssistantService } = require('../../services/documentAssistantService');
const store = require('../../services/projectDataStoreService');
const PDFDocument = require('pdfkit');
(async () => {
  const f = await fixture({ port: 3000 });
  const service = createDocumentAssistantService(f.root, { db: f.db, verificationService: f.productVerification });
  const project = await f.request('/projects/same');
  await f.request('/projects/same', { method:'PATCH', headers:{'If-Match':project.etag}, body:{projektname:'Vorschau · Logistikhalle',projektnummer:'0815-3',auftraggeber:'Beispiel-Auftraggeber',liegenschaft:'LKW-Beladungszone 2'} });
  const j = service.create('alice','same',{instruction:'Die Dokumentation aus der Materialliste vervollständigen. Bestehende Daten erhalten, Kleinteile auslassen und jede Datei manuell prüfen lassen.'});
  service.update('alice',j.id,{message:'Die Materialliste ist eingearbeitet. Herstellerdaten werden ergänzt. Alle alten Entwürfe bleiben in der Historie. Keine Datei wurde automatisch übernommen.',questions:[{id:'plans',prompt:'Welche Bestandspläne und Prüfprotokolle liegen bereits vor?',required:true},{id:'uv',prompt:'Welcher Typ wurde für UV 01 und UV 02 verwendet?',required:true}]});
  service.recordAnswers('alice',j.id,{version:service.get('alice',j.id).version,answers:[{questionId:'uv',answer:'Beide Verteilungen sind BALS 89076.',evidence:{sourceLabel:'Beispielchat',sourceQuote:'UV 01 und UV 02 sind beide BALS 89076'}}]});
  async function pdf(title) {
    const doc = new PDFDocument({size:'A4',margin:50}),parts=[];
    const done=new Promise(resolve=>{doc.on('data',p=>parts.push(p));doc.on('end',()=>resolve(Buffer.concat(parts)));});
    doc.fillColor('#2459b7').fontSize(12).text('edoku | Beispieldokument').moveDown(2);doc.fillColor('#172033').fontSize(22).text(title).moveDown();doc.fontSize(11).text('Projekt 0815-3 | Logistikhalle – LKW-Beladungszone 2').moveDown();
    for(const [h,t] of [['Projektumfang','Versorgung der Hallentore über zwei BALS-Unterverteilungen. Kabelverlegung auf Niedax-Kabeltrassen sowie Installation der Datentechnik.'],['Verteilungen','UV 01 und UV 02: BALS VARIABOX-L 89076. Genaue Stromkreiszuordnungen und Montageorte sind noch zu ergänzen.'],['Dokumentationsstand','Dieser Entwurf enthält ausschließlich Beispieldaten für die Oberflächenprüfung. Keine Prüfung oder fachliche Abnahme bestätigt.']])doc.font('Helvetica-Bold').fontSize(13).text(h).moveDown(.4).font('Helvetica').fontSize(11).text(t).moveDown();doc.end();return done;
  }
  const names=['BALS 89076 – Datenblatt','BALS VARIABOX – Montageanleitung','BALS VARIABOX-L – Herstellererklärung','Niedax RLVC 60.300 – Datenblatt','ESYLUX APC20 – Bedienungsanleitung','Anlagenbeschreibung – Entwurf R3','Geräte- und Systemverzeichnis – Entwurf R2','Bedienung und Instandhaltung – Entwurf R2','Nachweise und Übergabe – Entwurf R2'];
  const documents=[];
  for(let i=0;i<names.length;i++) {
    const category=i===1||i===4||i===7?'Bedienungsanleitungen':i===0||i===3?'Datenblätter':'Nachweise';
    const d=await service.propose('alice',j.id,{title:names[i],category,sourceLabel:i<5?'Herstellerunterlagen · Beispielquelle':'Materialliste und bestätigte Projektangaben',reason:'Passende Unterlage zur Dokumentation der verwendeten Geräte und Systeme. Bitte vor der Übernahme Inhalt und Zuordnung prüfen.',documentRevision:i<5?'':'R2'},{originalName:'Beispiel.pdf',buffer:await pdf(names[i])});documents.push(d);
    if(i<5){service.viewed('alice',j.id,d.id,d.sha256);await service.approve('alice',j.id,d.id,{reviewed:'on',sha256:d.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:d.title,category}});}
  }
  const history=await service.propose('alice',j.id,{title:'Anlagenbeschreibung – alter Entwurf R1',category:'Nachweise',sourceLabel:'Beispielquelle',reason:'Historischer Stand'},{originalName:'Alt.pdf',buffer:await pdf('Alter Entwurf R1')});
  service.replaceProposals('alice',j.id,{version:service.get('alice',j.id).version,replacements:[{previousId:history.id,replacementId:documents[5].id}]});
  await fs.writeFile('/preview/preview.json',JSON.stringify({jobId:j.id,reviewId:documents[5].id}));
  console.log(JSON.stringify({previewReady:true,jobId:j.id,reviewId:documents[5].id}));
  process.on('SIGTERM',async()=>{await f.cleanup();process.exit(0);});
})().catch(error=>{console.error('Oberflächenvorschau konnte nicht starten:', error.message);process.exit(1);});
