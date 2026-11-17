const { isDeepStrictEqual } = require("node:util");

// Stufe 2 ist eine relationale Projektion des vollständigen Projektdatensatzes.
// SQLite-Trigger halten sie auch bei Schreibzugriffen älterer Stufe-1-Programme aktuell.
const TABLE = "project_device_storage";
const TRIGGERS = ["project_devices_insert", "project_devices_update"];
const error = message => new Error("Gerätedatenbank: " + message);
function enabled(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(TABLE)) return false;
  if (db.prepare("SELECT version FROM project_device_storage WHERE id=1").get()?.version !== 1) throw error("Speicherversion wird nicht unterstützt.");
  for (const name of TRIGGERS) if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?").get(name)) throw error("Synchronisierung ist unvollständig.");
  return true;
}

const populate = `
  INSERT INTO project_device_lists(project_id,user_id,list_order,positions_array,data_json)
  SELECT NEW.project_id,NEW.user_id,l.key,
    CASE WHEN l.type='object' THEN json_type(l.value,'$.positionen')='array' ELSE 0 END IS 1,
    CASE WHEN l.type='object' AND json_type(l.value,'$.positionen')='array'
      THEN json_remove(l.value,'$.positionen') ELSE NEW.payload -> ('$[' || l.key || ']') END
  FROM json_each(CASE WHEN json_type(NEW.payload)='array' THEN NEW.payload ELSE '[]' END) l;
  INSERT INTO project_device_positions(project_id,user_id,list_order,position_order,data_json)
  SELECT NEW.project_id,NEW.user_id,l.key,p.key,l.value -> ('$.positionen[' || p.key || ']')
  FROM json_each(CASE WHEN json_type(NEW.payload)='array' THEN NEW.payload ELSE '[]' END) l
  JOIN json_each(CASE WHEN l.type='object' THEN
    CASE WHEN json_type(l.value,'$.positionen')='array' THEN json_extract(l.value,'$.positionen') ELSE '[]' END ELSE '[]' END) p;
`;

function createSchema(db) {
  db.exec(`CREATE TABLE project_device_storage(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL CHECK(version=1));
    INSERT INTO project_device_storage VALUES(1,1);
    CREATE TABLE project_device_lists(
      project_id TEXT NOT NULL,user_id TEXT NOT NULL,
      document_name TEXT NOT NULL DEFAULT 'geraetelisten.json' CHECK(document_name='geraetelisten.json'),
      list_order INTEGER NOT NULL CHECK(list_order>=0),positions_array INTEGER NOT NULL CHECK(positions_array IN(0,1)),
      data_json TEXT NOT NULL CHECK(json_valid(data_json)),
      list_id GENERATED ALWAYS AS (json_extract(data_json,'$.id')) VIRTUAL,
      leistungsbereich GENERATED ALWAYS AS (json_extract(data_json,'$.leistungsbereich')) VIRTUAL,
      kapitel GENERATED ALWAYS AS (json_extract(data_json,'$.kapitel')) VIRTUAL,
      titel GENERATED ALWAYS AS (json_extract(data_json,'$.titel')) VIRTUAL,
      aktiv GENERATED ALWAYS AS (json_extract(data_json,'$.aktiv')) VIRTUAL,
      export GENERATED ALWAYS AS (json_extract(data_json,'$.export')) VIRTUAL,
      PRIMARY KEY(project_id,user_id,list_order),
      FOREIGN KEY(project_id,user_id,document_name) REFERENCES project_documents(project_id,user_id,name) ON DELETE CASCADE);
    CREATE TABLE project_device_positions(
      project_id TEXT NOT NULL,user_id TEXT NOT NULL,list_order INTEGER NOT NULL,
      position_order INTEGER NOT NULL CHECK(position_order>=0),data_json TEXT NOT NULL CHECK(json_valid(data_json)),
      pos GENERATED ALWAYS AS (json_extract(data_json,'$.pos')) VIRTUAL,
      hersteller GENERATED ALWAYS AS (json_extract(data_json,'$.hersteller')) VIRTUAL,
      system GENERATED ALWAYS AS (json_extract(data_json,'$.system')) VIRTUAL,
      typ GENERATED ALWAYS AS (json_extract(data_json,'$.typ')) VIRTUAL,
      beschreibung GENERATED ALWAYS AS (json_extract(data_json,'$.beschreibung')) VIRTUAL,
      lv_position GENERATED ALWAYS AS (json_extract(data_json,'$.lvPosition')) VIRTUAL,
      PRIMARY KEY(project_id,user_id,list_order,position_order),
      FOREIGN KEY(project_id,user_id,list_order) REFERENCES project_device_lists(project_id,user_id,list_order) ON DELETE CASCADE);
    CREATE INDEX project_device_lists_scope ON project_device_lists(user_id,project_id,leistungsbereich);
    CREATE INDEX project_device_positions_type ON project_device_positions(user_id,project_id,typ);
    CREATE TRIGGER project_devices_insert AFTER INSERT ON project_documents WHEN NEW.name='geraetelisten.json' BEGIN ${populate} END;
    CREATE TRIGGER project_devices_update AFTER UPDATE OF payload ON project_documents WHEN NEW.name='geraetelisten.json' BEGIN
      DELETE FROM project_device_lists WHERE project_id=OLD.project_id AND user_id=OLD.user_id;
      ${populate} END;`);
}

function assertProjection(db, user, project, payload) {
  if (!enabled(db)) return;
  const source = JSON.parse(payload);
  const lists = db.prepare("SELECT list_order,positions_array,data_json FROM project_device_lists WHERE user_id=? AND project_id=? ORDER BY list_order").all(user, project);
  const positions = db.prepare("SELECT list_order,position_order,data_json FROM project_device_positions WHERE user_id=? AND project_id=? ORDER BY list_order,position_order").all(user, project);
  const rebuilt = [];
  let cursor = 0;
  for (const [index, list] of lists.entries()) {
    if (list.list_order !== index) throw error("Listenreihenfolge ist unvollständig.");
    const value = JSON.parse(list.data_json);
    if (list.positions_array) {
      const values = [];
      while (positions[cursor]?.list_order === index) {
        const position = positions[cursor++];
        if (position.position_order !== values.length) throw error("Positionsreihenfolge ist unvollständig.");
        values.push(JSON.parse(position.data_json));
      }
      Object.defineProperty(value, "positionen", { value: values, enumerable: true, writable: true, configurable: true });
    }
    rebuilt.push(value);
  }
  if (cursor !== positions.length || !isDeepStrictEqual(rebuilt, Array.isArray(source) ? source : [])) throw error("Tabellen und Projektdatensatz stimmen nicht überein. Bitte Sicherung prüfen.");
}

function migrateDeviceData(db) {
  const active = db.prepare("SELECT version,active FROM project_storage WHERE id=1").get();
  if (active?.version !== 1 || active.active !== 1) throw error("Aktive SQLite-Projektdaten der ersten Stufe sind erforderlich.");
  const already = enabled(db);
  return db.transaction(() => {
    if (!already) {
      createSchema(db);
      // Der Trigger übernimmt die vorhandenen SQLite-Daten, ohne Revisionen,
      // Zeitstempel oder ursprüngliche JSON-Quelldateien umzuschreiben.
      db.exec("UPDATE project_documents SET payload=payload WHERE name='geraetelisten.json'");
    }
    for (const row of db.prepare("SELECT project_id,user_id,payload FROM project_documents WHERE name='geraetelisten.json'").all()) assertProjection(db, row.user_id, row.project_id, row.payload);
    if (db.pragma("foreign_key_check").length) throw error("Projektzuordnung ist fehlerhaft.");
    return status(db);
  })();
}

function status(db) {
  const active = enabled(db);
  return { active, version: active ? 1 : null,
    lists: active ? db.prepare("SELECT count(*) AS n FROM project_device_lists").get().n : 0,
    positions: active ? db.prepare("SELECT count(*) AS n FROM project_device_positions").get().n : 0 };
}

module.exports = { enabled, migrateDeviceData, assertProjection, status };
