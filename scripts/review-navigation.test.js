const test=require('node:test'),assert=require('node:assert/strict');
const {PDFDocument}=require('pdf-lib');
const {fixture}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {createDocumentAssistantService}=require('../services/documentAssistantService');

test('Prüfreihenfolge bleibt nach Statusänderungen stabil und springt am Ende nicht zurück',()=>{
 const {compareReviewDocuments,reviewNavigation}=require('../services/assistantReviewNavigation');
 const docs=[{id:'a',title:'GIRA offen',category:'Datenblätter',state:'pending'},{id:'b',title:'NIEDAX aktuell',category:'Datenblätter',state:'approved'},{id:'c',title:'OBO 10',category:'Datenblätter',state:'withdrawn'},{id:'d',title:'OBO 2',category:'Datenblätter',state:'pending'}];
 assert.deepEqual([...docs].sort(compareReviewDocuments).map(x=>x.id),['a','b','d','c']);
 const nav=reviewNavigation(docs,'b');assert.equal(nav.next.id,'d');assert.equal(nav.earlierPending,1);assert.equal(nav.remainingPending,2);
 const end=reviewNavigation(docs.map(x=>x.id==='d'?{...x,state:'approved'}:x),'d');assert.equal(end.next,null);assert.equal(end.earlierPending,1);assert.equal(end.remainingPending,1);
 assert.equal(reviewNavigation(docs,'missing').next,null);
});

test('GUI: nach Freigabe in der Mitte weiter, auch ohne JavaScript; frühere Gira-Datei bleibt offen',async()=>{
 const f=await fixture();try{
  const token=f.makeToken('alice',{scopes}).token,req=(url,options={})=>f.request(url,{token,...options});
  const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  const job=service.create('alice','same',{instruction:'Synthetische Prüfung: frühere Datei überspringen und in sichtbarer Reihenfolge weiterprüfen.'});
  const docs={};
  for(const title of ['GIRA offen','OBO nächstes','NIEDAX aktuell','TRILUX letztes']){
   const pdf=await PDFDocument.create();pdf.addPage().drawText('Test '+title.replace(/[^a-zA-Z ]/g,''));
   docs[title]=await service.propose('alice',job.id,{title,category:'Nachweise',sourceLabel:'Synthetischer Test',reason:'Reihenfolge prüfen; keine echten Projektdateien.'},{buffer:Buffer.from(await pdf.save()),originalName:'test.pdf'});
  }
  const cookies=new Map();const browser=async(url,options={})=>{const response=await fetch(f.base+url,{redirect:'manual',...options,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}return response;};
  let html=await(await browser('/login')).text(),csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  assert.equal((await browser('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);
  const base='/assistent/auftraege/'+job.id;
  html=await(await browser(base+'?ansicht=dateien')).text();csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  const links=Object.values(docs).map(d=>({title:d.title,index:html.indexOf('href="'+base+'/dateien/'+d.id+'"')})).sort((a,b)=>a.index-b.index);
  assert.deepEqual(links.map(x=>x.title),['GIRA offen','NIEDAX aktuell','OBO nächstes','TRILUX letztes']);
  async function approve(title,json=true){
   const d=docs[title];await(await browser(base+'/dateien/'+d.id+'/inhalt')).arrayBuffer();
   const revision=(await req('/projects/same')).etag.slice(1,-1);
   return browser(base+'/dateien/'+d.id+'/uebernehmen',{method:'POST',headers:json?{Accept:'application/json'}:{},body:new URLSearchParams({_csrf:csrf,_projectRevision:revision,title:d.title,category:d.category,sha256:d.sha256,revision,reviewed:'on',continueReview:'1',panel:'1'})});
  }
  let response=await approve('NIEDAX aktuell');assert.equal(response.status,200);let value=await response.json();
  assert.equal(value.nextUrl,base+'/dateien/'+docs['OBO nächstes'].id);assert.equal(value.earlierPending,1);
  response=await approve('OBO nächstes',false);assert.equal(response.status,302);assert.ok(response.headers.get('location').startsWith(base+'/dateien/'+docs['TRILUX letztes'].id+'?panel=1&'));
  response=await approve('TRILUX letztes');assert.equal(response.status,200);value=await response.json();assert.equal(value.nextUrl,null);assert.equal(value.earlierPending,1);assert.equal(value.remainingPending,1);
  const current=service.get('alice',job.id);assert.equal(current.documents.filter(x=>x.state==='approved').length,3);assert.equal(current.documents.find(x=>x.title==='GIRA offen').state,'pending');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views WHERE proposal_id=?').get(docs['GIRA offen'].id).n,0);
 }finally{await f.cleanup();}
});
