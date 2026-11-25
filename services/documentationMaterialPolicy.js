const POLICY='documentation_material_exclusions_v1';
const keys=['connectionTerminals','cablesAndWires','fasteningMaterial'];
const labels={connectionTerminals:'Verbindungsklemmen',cablesAndWires:'Kabel und Leitungen',fasteningMaterial:'Befestigungsmaterial'};
const newProjectExclusions=Object.freeze({connectionTerminals:true,cablesAndWires:true,fasteningMaterial:true});
const norm=v=>String(v||'').normalize('NFKC').replace(/[®™]/g,'').replace(/[‐‑‒–—−]/g,'-').trim();
function historicalSample(row={}){
 const explicit=/\b(?:Beispieldatensatz|Testposition|Musterposition)\b/i;
 return explicit.test([row.typ,row.beschreibung].filter(Boolean).join(' '))||/^(?:Beispieldatensatz|Testposition|Musterposition)(?:\s*$|\s*[.;|])/i.test(norm(row.bemerkung));
}
function explicit(project){
 const value=project?.assistantMaterialPolicy;if(value===undefined)return false;
 if(value?.version!==1||!keys.every(k=>typeof value.exclusions?.[k]==='boolean'))throw Object.assign(new Error('Die gespeicherten Materialregeln sind ungültig.'),{status:409,apiCode:'MATERIAL_POLICY_INVALID'});
 return true;
}
function effective(project={}){
 const old=project.assistantWorkflow?.excludeConsumables!==false;
 const exclusions=explicit(project)?Object.fromEntries(keys.map(k=>[k,project.assistantMaterialPolicy.exclusions[k]])):{connectionTerminals:old,cablesAndWires:false,fasteningMaterial:old};
 return {policy:POLICY,exclusions,excludedGroups:keys.filter(k=>exclusions[k]),origin:explicit(project)?'project_settings':'legacy_defaults',fileApproval:'manual_gui_per_file'};
}
function classify(row={}){
 const type=norm(row.typ),description=norm(row.beschreibung),category=norm(row.kategorie),brand=norm(row.hersteller);
 const text=[type,description,category];
 // Do not mistake technical support/firestop systems or terminal-based devices for loose hardware.
 if(/^(?:KTUM|HUF|HDUF|RLVC)(?:\b|(?=\d))/i.test(type)||text.some(v=>/^(?:Kabelrinne|Kabeltrasse|Kabelkanal|Ausleger|Hängestiel|Tragsystem|Montageschiene|Schienenhalter|Kabelschelle|Brandschutz|Kabelabschottung|Leitungsschutzschalter|Sicherungs|Reiheneinbaugerät|Klemmenkasten|Abzweigdose|Unterverteilung|Steuerung|SPS)\b/i.test(v)))return null;
 if(/^WAGO(?:\s|$)/i.test(brand)&&/^750[-\s]/.test(type))return null;
 if(/^WAGO(?:\s|$)/i.test(brand)&&/^(?:221|222|224|2273)[-\s]/.test(type))return 'connectionTerminals';
 if(text.some(v=>/^(?:(?:elektrische|isolierte)\s+)?(?:Verbindungs|Hebel|Steck|Leuchten|Dosen|Reihen|Durchgangs|Abzweig|Federzug|Federsteck|Installations)klemmen?\b/i.test(v)))return 'connectionTerminals';
 if(text.some(v=>/^(?:Kabel|Leitungen?|Datenkabel|Installations(?:kabel|leitung)|Energiekabel|Steuer(?:kabel|leitung)|Patchkabel|Netzwerkkabel|Netzwerkleitung|LWL[-\s]Kabel|Koaxialkabel|Gummischlauchleitung|Fernmeldeleitung)\b/i.test(v)))return 'cablesAndWires';
 if(/^(?:NYM|NYY|N2XH|N2XY)(?:[-\s]?[JO])?(?=\s|\d|$)/i.test(type)||/^H0[357](?:V|R|RN|VV|RR|BQ)[A-Z-]*(?:\s*\d|$)/i.test(type))return 'cablesAndWires';
 if(text.some(v=>/^(?:Befestigungsmaterial|Schrauben?|Blechschrauben?|Sechskantschrauben?|Senkkopfschrauben?|Montageschrauben?|Unterlegscheiben?|Dübel|Kabelbinder|Muttern?|Sechskantmuttern?|Gewindestangen?|Stockschrauben?)\b/i.test(v)))return 'fasteningMaterial';
 return null;
}
function excluded(row,project){const group=classify(row);return group&&effective(project).exclusions[group]?group:null;}
function projectLists(lists,project){
 if(!explicit(project))return lists;
 return lists.map(list=>({...list,positionen:(list.positionen||[]).filter(row=>!excluded(row,project))})).filter((list,index)=>!lists[index].positionen?.length||list.positionen.length);
}
function save(project,exclusions,{actor,source,evidence}){
 const before=effective(project).exclusions;if(keys.every(k=>before[k]===exclusions[k])&&explicit(project))return false;
 const history=project.assistantMaterialHistory||[];
 if(!Array.isArray(history)||history.length>=200)throw Object.assign(new Error('Die Materialregel-Historie ist ungültig oder voll.'),{status:409,apiCode:'MATERIAL_POLICY_HISTORY_LIMIT'});
 const at=new Date().toISOString();project.assistantMaterialPolicy={...project.assistantMaterialPolicy,version:1,exclusions:{...exclusions},updatedAt:at,updatedBy:actor};
 project.assistantMaterialHistory=[...history,{before,after:{...exclusions},actor,source,evidence,recordedAt:at}];return true;
}
function excludedRequirement(data,requirement){
 if(!explicit(data.projekt)||!['Datenblätter','Bedienungsanleitungen'].includes(requirement.category))return false;
 const refs=requirement.devices||(requirement.device?[requirement.device]:[]);
 return refs.length>0&&refs.every(ref=>{
  const list=data.geraetelisten.find(item=>item.id===ref.listId);
  const row=list?.positionen.find((r,i)=>Number(r.pos||i+1)===ref.position);
  return row&&excluded(row,data.projekt);
 });
}
function historicalRequirement(data,requirement){
 if(!['Datenblätter','Bedienungsanleitungen'].includes(requirement.category))return false;
 const refs=requirement.devices||(requirement.device?[requirement.device]:[]);
 return refs.length>0&&refs.every(ref=>{
  const list=data.geraetelisten.find(item=>item.id===ref.listId),row=list?.positionen.find((r,i)=>Number(r.pos||i+1)===ref.position);
  return row&&historicalSample(row);
 });
}
function assertIncluded(row,project){const group=explicit(project)&&excluded(row,project);if(group)throw Object.assign(new Error(`${labels[group]} sind im Doku-Assistenten ausgeschlossen. Projektregeln beachten.`),{status:409,apiCode:'DOCUMENTATION_MATERIAL_EXCLUDED'});}
module.exports={POLICY,keys,labels,newProjectExclusions,effective,explicit,classify,excluded,projectLists,save,excludedRequirement,assertIncluded,historicalSample,historicalRequirement};
