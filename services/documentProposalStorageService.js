// Explicit storage upgrade; never rebuild a retained table while serving requests.
const crypto=require('node:crypto');
const INDEX="CREATE UNIQUE INDEX IF NOT EXISTS document_proposals_active_content ON document_proposals(job_id,sha256) WHERE json_extract(metadata,'$.withdrawal') IS NULL";
function legacy(db){
 return db.prepare('PRAGMA index_list(document_proposals)').all().some(index=>index.unique&&index.origin==='u'&&JSON.stringify(db.prepare('PRAGMA index_info('+JSON.stringify(index.name)+')').all().map(row=>row.name))===JSON.stringify(['job_id','sha256']));
}
function upgrade(db,{apply=false}={}){
 const sql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='document_proposals'").get()?.sql;
 if(!sql||!legacy(db))return {required:false,applied:false};
 if(!apply)return {required:true,applied:false};
 if(db.inTransaction)throw Error('Vorschlagsspeicher nur bei angehaltener Anwendung außerhalb einer Transaktion aktualisieren.');
 const changed=sql.replace(/,\s*UNIQUE\s*\(\s*job_id\s*,\s*sha256\s*\)\s*(?=\))/i,'');
 if(changed===sql||db.prepare("SELECT 1 FROM sqlite_master WHERE name='document_proposals_upgrade'").get())throw Error('Unbekanntes Vorschlagsschema; keine Änderung.');
 const before=db.prepare('SELECT * FROM document_proposals ORDER BY id').all();
 const digest=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 const objects=db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='document_proposals' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
 const foreignKeys=db.pragma('foreign_keys',{simple:true});db.pragma('foreign_keys = OFF');
 try{
  db.transaction(()=>{
   db.exec(changed.replace(/^(CREATE TABLE\s+)(?:"document_proposals"|document_proposals)/i,'$1document_proposals_upgrade'));
   db.exec('INSERT INTO document_proposals_upgrade SELECT * FROM document_proposals');
   db.exec('DROP TABLE document_proposals; ALTER TABLE document_proposals_upgrade RENAME TO document_proposals');
   for(const row of objects)db.exec(row.sql);
   db.exec(INDEX);
   if(digest(before)!==digest(db.prepare('SELECT * FROM document_proposals ORDER BY id').all())||db.pragma('foreign_key_check').length)throw Error('Speicherprüfung fehlgeschlagen.');
  })();
 }finally{db.pragma('foreign_keys = '+(foreignKeys?'ON':'OFF'));}
 return {required:false,applied:true,rowsPreserved:before.length,sha256:digest(before)};
}
module.exports={legacy,upgrade,INDEX};
