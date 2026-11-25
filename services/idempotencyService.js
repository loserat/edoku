const crypto = require("node:crypto");
const { fault } = require("../src/api/validation");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function createIdempotencyService(db, { now = Date.now, leaseMs = 30000 } = {}) {
  function schema() {
    db.exec(`CREATE TABLE IF NOT EXISTS integration_operations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), operation TEXT NOT NULL,
      key_hash TEXT NOT NULL, request_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('pending','done')),
      result TEXT CHECK(result IS NULL OR json_valid(result)), lease_owner TEXT, lease_until INTEGER NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(user_id,operation,key_hash));`);
  }
  async function run({ userId, key, operation, request }, work) {
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw fault("Ein Idempotency-Key mit 8–128 Buchstaben, Zahlen, Bindestrichen oder Unterstrichen ist erforderlich.", 428, "IDEMPOTENCY_KEY_REQUIRED");
    schema();
    const projectId=request?.projectId;
    const epoch=operation!=='project.reset'&&!operation.startsWith('item.')&&projectId?projectResetGeneration(db,userId,projectId):0;
    const owner = crypto.randomUUID(), requestHash = digest(JSON.stringify(canonical(request))), keyHash = digest(epoch?JSON.stringify([key,projectId,epoch]):key);
    const record = db.transaction(() => {
      let row = db.prepare("SELECT * FROM integration_operations WHERE user_id=? AND operation=? AND key_hash=?").get(userId, operation, keyHash);
      if (!row) {
        const id = "op_" + crypto.randomBytes(12).toString("hex");
        db.prepare("INSERT INTO integration_operations(id,user_id,operation,key_hash,request_hash,state,lease_until,created_at) VALUES(?,?,?,?,?,'pending',0,?)").run(id, userId, operation, keyHash, requestHash, new Date(now()).toISOString());
        row = db.prepare("SELECT * FROM integration_operations WHERE id=?").get(id);
      }
      if (row.request_hash !== requestHash) throw fault("Dieser Idempotency-Key wurde bereits für einen anderen Anfrageinhalt verwendet.", 409, "IDEMPOTENCY_CONFLICT");
      if (row.state === "done") return row;
      if (row.lease_until > now()) throw fault("Dieselbe Anlage wird bereits verarbeitet. Bitte denselben Schlüssel später erneut verwenden.", 409, "OPERATION_IN_PROGRESS");
      db.prepare("UPDATE integration_operations SET lease_owner=?,lease_until=? WHERE id=?").run(owner, now() + leaseMs, row.id);
      return row;
    })();
    if (record.state === "done") {
      const value=JSON.parse(record.result);
      if(operation==='assistant.create'&&!db.prepare('SELECT 1 FROM documentation_jobs WHERE id=? AND user_id=? AND project_id=?').get(value.id,userId,projectId))throw fault('Der frühere Auftrag wurde gelöscht. Wiederherstellen oder bewusst einen neuen Auftrag anlegen.',409,'RESOURCE_DELETED');
      if(operation==='device.position.create'&&!db.prepare('SELECT 1 FROM project_device_positions WHERE user_id=? AND project_id=? AND json_extract(data_json,\'$.pos\')=? AND list_order IN(SELECT list_order FROM project_device_lists WHERE user_id=? AND project_id=? AND json_extract(data_json,\'$.id\')=?)').get(userId,projectId,value.pos,userId,projectId,request.listId))throw fault('Die frühere Geräteposition wurde gelöscht. Wiederherstellen oder bewusst neu anlegen.',409,'RESOURCE_DELETED');
      return { value, replayed: true };
    }
    const heartbeat = setInterval(() => {
      try { db.prepare("UPDATE integration_operations SET lease_until=? WHERE id=? AND lease_owner=? AND state='pending'").run(now() + leaseMs, record.id, owner); } catch { /* Abschluss prüft den Besitz erneut. */ }
    }, Math.max(100, Math.floor(leaseMs / 3)));
    heartbeat.unref();
    const complete = value => {
      if (!db.prepare("UPDATE integration_operations SET state='done',result=?,lease_owner=NULL,lease_until=0 WHERE id=? AND lease_owner=? AND state='pending'").run(JSON.stringify(value), record.id, owner).changes) throw fault("Die Verarbeitung muss mit demselben Schlüssel erneut abgefragt werden.", 409, "OPERATION_LEASE_LOST");
    };
    try {
      const value = await work(record.id, complete);
      const current = db.prepare("SELECT state FROM integration_operations WHERE id=?").get(record.id);
      if (current.state !== "done") complete(value);
      return { value, replayed: false };
    } finally {
      clearInterval(heartbeat);
      db.prepare("UPDATE integration_operations SET lease_owner=NULL,lease_until=0 WHERE id=? AND lease_owner=? AND state='pending'").run(record.id, owner);
    }
  }
  return { run };
}
function projectResetGeneration(db,userId,projectId){return db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_reset_generations'").get()?db.prepare('SELECT generation FROM project_reset_generations WHERE user_id=? AND project_id=?').get(userId,projectId)?.generation||0:0;}
module.exports = { createIdempotencyService,projectResetGeneration };
