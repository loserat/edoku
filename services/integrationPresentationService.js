// Nur Darstellung und lesende Diagnose. Keine Schlüssel- oder Projekteinstellungen ändern.
const { HTTP_API_VERSION, MCP_VERSION } = require('./interfaceVersions');
const published = require('../docs/api/mcp-tools.json');
const scopes = require('../src/api/schemas').scopes;
const readScopes = scopes.filter(value => value.endsWith(':read'));
const profiles = [
  { id: 'read', label: 'Nur lesen', scopes: readScopes },
  { id: 'research', label: 'Unterlagen vorbereiten', scopes: [...readScopes, 'assistant:write'] },
  { id: 'full', label: 'Projekt vollständig bearbeiten', scopes }
];
const groupLabels = { workflow: 'Aufgaben & Rückfragen', material: 'Material & Artikel', devices: 'Geräte & Struktur', documents: 'Dateien & Unterlagen', fire: 'Brandschutz', exports: 'Export', recovery: 'Löschen & Wiederherstellen', connection: 'Verbindung & Projekte' };
function groupFor(name) {
  if (/delet|restore|reset/.test(name)) return 'recovery';
  if (/firestop|fire_protection/.test(name)) return 'fire';
  if (/export/.test(name)) return 'exports';
  if (/material|research|manufacturer/.test(name)) return 'material';
  if (/device|select_service|select_system/.test(name)) return 'devices';
  if (/document|attachment|datasheet/.test(name) && !/status|job|work/.test(name)) return 'documents';
  if (/identity|project$|projects$|get_section/.test(name)) return 'connection';
  return 'workflow';
}
function catalog() {
  if (published.server.version !== MCP_VERSION) throw Error('Werkzeugkatalog ist nicht aktuell.');
  return published.tools.map(tool => ({ name: tool.name, group: groupFor(tool.name),
    readOnly: tool.annotations.readOnlyHint === true,
    sensitive: /delete|reset_project|restore_deleted|remove_internal/.test(tool.name),
    description: tool.description.length > 220 ? tool.description.slice(0, 217) + '…' : tool.description }));
}
function summary() {
  const tools = catalog();
  return { apiVersion: HTTP_API_VERSION, mcpVersion: MCP_VERSION, total: tools.length,
    read: tools.filter(tool => tool.readOnly).length, write: tools.filter(tool => !tool.readOnly).length,
    groups: Object.entries(groupLabels).map(([id,label]) => ({ id,label,count:tools.filter(tool=>tool.group===id).length })),
    profiles, clientStatus: 'unknown', fileApproval: 'manual_gui_per_file' };
}
function toolPage({ search = '', group = 'all', mode = 'all', offset = 0, limit = 12 } = {}) {
  const query = search.toLocaleLowerCase('de');
  const tools = catalog().filter(tool => (group === 'all' || tool.group === group) &&
    (mode === 'all' || (mode === 'read' ? tool.readOnly : mode === 'write' ? !tool.readOnly : tool.sensitive)) &&
    (tool.name + ' ' + tool.description).toLocaleLowerCase('de').includes(query));
  return { items: tools.slice(offset, offset + limit), total: tools.length, offset, limit };
}
function diagnose({ settings, keys, keyId, projectId, profile = 'read', projects, role }) {
  const selected = profiles.find(item => item.id === profile);
  const checks = [{ id: 'server', state: 'ok', label: 'edoku-Server erreichbar' },
    { id: 'api', state: settings.apiEnabled ? 'ok' : 'error', label: settings.apiEnabled ? 'API eingeschaltet' : 'API ausgeschaltet – Serverzugang prüfen' }];
  const key = keyId ? keys.find(item => item.id === keyId) : null;
  if (keyId && !key) throw Object.assign(Error('Schlüssel wurde nicht gefunden.'), { status: 404 });
  if (projectId && !projects.some(project => project.id === projectId)) throw Object.assign(Error('Projekt wurde nicht gefunden.'), { status: 404 });
  if (key) {
    checks.push({ id: 'key', state: key.state === 'active' ? 'ok' : 'error', label: key.state === 'active' ? 'Schlüssel aktiv' : 'Schlüssel nicht aktiv – Gültigkeit und Konto prüfen' });
    const missing = selected.scopes.filter(scope => !key.scopes.includes(scope));
    checks.push({ id: 'rights', state: missing.length ? 'warning' : 'ok', label: missing.length ? 'Für das gewählte Profil fehlen Rechte' : 'Rechte passen zum Profil', missingScopes: missing });
    if (projectId) checks.push({ id: 'project', state: key.projectIds === null || key.projectIds.includes(projectId) ? 'ok' : 'error', label: key.projectIds === null || key.projectIds.includes(projectId) ? 'Projekt für diesen Schlüssel freigegeben' : 'Projekt für diesen Schlüssel nicht freigegeben' });
  } else checks.push({ id: 'key', state: 'unknown', label: 'Für die Rechteprüfung einen eigenen Schlüssel auswählen' });
  if (selected.scopes.some(scope => scope.endsWith(':write'))) checks.push({ id: 'writes', state: settings.allowWrites && role !== 'viewer' ? 'ok' : 'error', label: settings.allowWrites && role !== 'viewer' ? 'Server erlaubt Änderungen' : 'Änderungen durch Server oder Kontorolle gesperrt' });
  checks.push({ id: 'client', state: 'unknown', label: 'Externer MCP-Client von hier nicht prüfbar' });
  return { checks, catalog: { version: MCP_VERSION, total: catalog().length }, fileApproval: 'manual_gui_per_file' };
}
module.exports = { summary, toolPage, diagnose, profiles, groupLabels };
