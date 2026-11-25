const path = require('node:path');
const { readJson } = require('./jsonService');
const { DEFAULT_LEISTUNGSBEREICHE } = require('./bootstrapService');
const fields = ['projektname','projektnummer','auftraggeber','liegenschaft','baumassnahme','massnahmeNr','auftragsNr','auftragGewerk','ortDerAusfuehrung','ausfuehrendeFirma','firmenanschrift','bearbeiter','ortDatum'];
const matrixFields = ['id','kapitel','titel','ebene','export','pflicht','leistungsbereich','dokumenttyp','formularart','sortierung','autoAktiv'];
// Source categories are structural hints. Never copy project file paths or URLs.
const sources = new Set(['Auftragnehmer','Auftragnehmer / Hersteller','Fachplaner / Hersteller','Hersteller','Hersteller / Auftragnehmer','Messgerät','Messgerät / Auftragnehmer','Netzwerktester','Planablage','Prüfstelle / Auftragnehmer','Regelwerk','System','data/geraetelisten.json','manuelle Eingabe','output/final']);
async function emptyProjectDocuments(dataDir,input={}) {
 const catalog=await readJson(path.join(dataDir,'leistungsbereiche.json'),{});
 const matrix=await readJson(path.join(dataDir,'dokumentenmatrix.json'),[]);
 const options=Array.isArray(catalog.optionen)?catalog.optionen.filter(v=>typeof v==='string'&&v.trim()):DEFAULT_LEISTUNGSBEREICHE;
 const project=Object.fromEntries(fields.map(key=>[key,typeof input[key]==='string'?input[key]:'']));
 if(input.auftragGewerk===undefined)project.auftragGewerk='Elektrotechnik';
 project.logoPfad='';
 project.assistantMaterialImports={version:1,activeId:null,imports:[]};
 project.assistantMaterialPolicy={version:1,exclusions:{...require('./documentationMaterialPolicy').newProjectExclusions}};
 if(Array.isArray(input.stockwerke))project.stockwerke=input.stockwerke.filter(v=>typeof v==='string');
 return {
  'projekt.json':project,
  'leistungsbereiche.json':{optionen:[...new Set(options)],aktiv:[],systemAuswahl:{}},
  'dokumentenmatrix.json':(Array.isArray(matrix)?matrix:[]).map(entry=>({
   ...Object.fromEntries(matrixFields.filter(key=>Object.hasOwn(entry,key)).map(key=>[key,entry[key]])),
   aktiv:(!entry.leistungsbereich||entry.leistungsbereich==='Allgemein')&&entry.aktiv!==false,
   quelle:sources.has(entry.quelle)?entry.quelle:'',bemerkung:''
  })),
  'geraetelisten.json':[],'brandschutz.json':[],'projektSysteme.json':[],
  'anhaenge.json':[],'exportliste.json':[],'files.json':[]
 };
}
module.exports={emptyProjectDocuments};
