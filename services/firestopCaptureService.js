const crypto = require('node:crypto');
const { emptyBrandschutzEintrag } = require('./brandschutzService');
const { parse, fault } = require('../src/api/validation');
const { input } = require('../src/api/firestopSchemas');
const { id } = require('../src/api/schemas');
const { writeJson } = require('./jsonService');

function createFirestopCaptureService(integration) {
  async function get(auth, projectId, entryId) {
    parse(id, entryId);
    const entries = await integration.read(auth, projectId, 'brandschutz');
    if (!Array.isArray(entries)) throw fault('Ungültige Schottliste.', 409, 'INVALID_FIRESTOPS');
    const matches = entries.filter(entry => entry?.id === entryId);
    if (matches.length !== 1) throw fault('Schott wurde nicht eindeutig gefunden.', 404, 'NOT_FOUND');
    return matches[0];
  }
  async function save(auth, projectId, entryId, etag, raw, options = {}) {
    const body = parse(input, raw);
    if (entryId !== null) parse(id, entryId);
    return integration.mutate(auth, projectId, etag, async files => {
      const areas = await integration.read(auth, projectId, 'leistungsbereiche');
      if (!areas?.aktiv?.includes('Brandschutzabschottungen')) throw fault('Leistungsbereich Brandschutzabschottungen zuerst aktivieren.', 409, 'INACTIVE_FIRESTOP_AREA');
      const entries = await integration.read(auth, projectId, 'brandschutz');
      if (!Array.isArray(entries)) throw fault('Ungültige Schottliste.', 409, 'INVALID_FIRESTOPS');
      const current = entryId === null ? null : await get(auth, projectId, entryId);
      if (!current && !Object.values(body.values).some(value => Array.isArray(value) ? value.length : value !== null && String(value).trim())) throw fault('Mindestens eine bekannte Einbauangabe ist erforderlich.', 400, 'EMPTY_FIRESTOP');
      if (current?.aktiv === false) throw fault('Inaktives Schott zuerst in der GUI prüfen.', 409, 'INACTIVE_FIRESTOP');
      const next = { ...(current || emptyBrandschutzEintrag()), ...body.values,
        id: current?.id || 'bs_' + crypto.randomBytes(12).toString('hex') };
      const changed = !current || Object.keys(body.values).some(key => JSON.stringify(current[key]) !== JSON.stringify(next[key]));
      if (!changed) return { changed: false, entry: current };
      const project = await integration.read(auth, projectId, 'projekt');
      const history = project.firestopChanges || [];
      if (!Array.isArray(history)) throw fault('Ungültige Schott-Änderungshistorie.', 409, 'INVALID_FIRESTOP_HISTORY');
      if (history.length >= 1000) throw fault('Schott-Änderungshistorie ist voll.', 409, 'FIRESTOP_HISTORY_LIMIT');
      history.push({ id: 'fsc_' + crypto.randomBytes(12).toString('hex'), entryId: next.id,
        operation: current ? 'patch' : 'create', recordedAt: new Date().toISOString(), recordedBy: auth.user.id,
        evidence: body.evidence, before: current ? Object.fromEntries(Object.keys(body.values).map(key => [key, current[key] ?? null])) : null,
        values: body.values });
      await writeJson(files.projekt, { ...project, firestopChanges: history });
      await writeJson(files.brandschutz, current ? entries.map(entry => entry.id === entryId ? next : entry) : [...entries, next]);
      return { changed: true, entry: next };
    }, { ...options, skipUnchanged: true });
  }
  return { get, save };
}
module.exports = { createFirestopCaptureService };
