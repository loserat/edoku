const { fault } = require("../src/api/validation");

const documentFields = { Bedienungsanleitungen: "bedienungsanleitungId", "Datenblätter": "datenblattId" };
const same = (a, b) => String(a || "").trim().toLocaleLowerCase("de") === String(b || "").trim().toLocaleLowerCase("de");
const referenceKey = reference => JSON.stringify([reference.listId, reference.position]);
const requirementDevices = requirement => requirement.devices || (requirement.device ? [requirement.device] : []);
const isTypeReference = row => /keine zusätzliche (?:dritte )?Verteilung|gemeinsame .*Typreferenz/i.test([row.typ, row.beschreibung].filter(Boolean).join(' '));

function referencesForDocument(document, requirements = []) {
  const references = [...(document.deviceReferences || [])];
  if (!documentFields[document.category]) return references;
  for (const requirement of requirements) {
    if (!document.requirementIds?.includes(requirement.id)) continue;
    for (const device of requirementDevices(requirement)) {
      const existing = references.find(reference => referenceKey(reference) === referenceKey(device));
      if (existing && (!same(existing.manufacturer, device.manufacturer) || !same(existing.model, device.model) || (existing.variant !== undefined && device.variant !== undefined && !same(existing.variant, device.variant)))) {
        throw fault("Dokument und Pflichtanforderung nennen unterschiedliche Geräte für dieselbe Position.", 409, "DEVICE_REFERENCE_CONFLICT");
      }
      if (!existing) references.push(device);
    }
  }
  return references;
}

function resolveDeviceReferences(lists, references, category, mimeType) {
  if (!Array.isArray(lists)) throw fault("Die Gerätelisten müssen zuerst geprüft werden.", 409, "LEGACY_DEVICE_FORMAT");
  if (references.length && (!documentFields[category] || mimeType !== "application/pdf")) {
    throw fault("Geräteunterlagen können nur als PDF in den Kategorien Datenblätter oder Bedienungsanleitungen verknüpft werden.", 400, "DEVICE_DOCUMENT_CATEGORY");
  }
  const seen = new Set();
  return references.map(reference => {
    const key = referenceKey(reference);
    if (seen.has(key)) throw fault("Eine Geräteposition wurde mehrfach zugeordnet.", 400, "DUPLICATE_DEVICE_REFERENCE");
    seen.add(key);
    const matches = lists.filter(list => list.id === reference.listId);
    const list = matches[0];
    const positions = matches.length === 1 && Array.isArray(list.positionen)
      ? list.positionen.filter((position, index) => Number(position.pos || index + 1) === reference.position) : [];
    if (positions.length !== 1 || list.aktiv === false
      || !same(positions[0].hersteller, reference.manufacturer) || !same(positions[0].typ, reference.model)
      || (reference.variant !== undefined && !same(reference.variant, [positions[0].abmessung, positions[0].farbe].filter(Boolean).join(' · ')))) {
      throw fault("Die Gerätezuordnung passt nicht zum aktuellen Projektstand. Liste, Position, Hersteller und Typ neu prüfen.", 409, "DEVICE_REFERENCE_CHANGED");
    }
    return { list, position: positions[0], reference };
  });
}

function linkDeviceDocuments(lists, references, category, mimeType, attachmentId) {
  const targets = resolveDeviceReferences(lists, references, category, mimeType);
  const field = documentFields[category];
  for (const { position } of targets) {
    if (position[field] && position[field] !== attachmentId) throw fault("Für diese Geräteposition ist bereits eine andere Unterlage verknüpft. Bestehende Zuordnung zuerst in der Geräteliste prüfen.", 409, "DEVICE_DOCUMENT_CONFLICT");
  }
  for (const { position } of targets) position[field] = attachmentId;
  return lists;
}

function deviceReferenceOptions(lists) {
  return (lists || []).filter(list => list.aktiv !== false)
    .flatMap(list => (Array.isArray(list.positionen) ? list.positionen : []).filter(position => Number.isSafeInteger(Number(position.pos)) && Number(position.pos) > 0 && String(position.hersteller || "").trim() && String(position.typ || "").trim())
      .map(position => ({ reference: { listId: list.id, position: Number(position.pos), manufacturer: String(position.hersteller).trim(), model: String(position.typ).trim(), revision: "", variant: [position.abmessung, position.farbe].filter(Boolean).join(" · ") },
        label: `${list.leistungsbereich || list.titel} · Pos. ${position.pos} · ${position.hersteller} · ${position.typ}${[position.abmessung, position.farbe].filter(Boolean).length ? " · " + [position.abmessung, position.farbe].filter(Boolean).join(" · ") : ""}` })));
}

module.exports = { documentFields, referencesForDocument, resolveDeviceReferences, linkDeviceDocuments, deviceReferenceOptions, referenceKey, requirementDevices, isTypeReference };
