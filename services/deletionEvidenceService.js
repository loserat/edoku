const crypto=require('node:crypto');
function archivedApproval(db,userId,projectId,jobId,proposalId){
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_item_deletions'").get())return null;
  for(const row of db.prepare("SELECT snapshot,snapshot_hash FROM project_item_deletions WHERE user_id=? AND project_id=? AND kind='job' AND state='deleted' AND json_extract(snapshot,'$.target.jobId')=? ORDER BY created_at DESC LIMIT 1").all(userId,projectId,jobId)){
    if(crypto.createHash('sha256').update(row.snapshot).digest('hex')!==row.snapshot_hash)continue;
    const value=JSON.parse(row.snapshot);
    if(value.target.jobId!==jobId)continue;
    return value.sql.proposals.find(p=>p.id===proposalId&&p.state==='approved')||null;
  }
  return null;
}
module.exports={archivedApproval};
