const rules = [
  [/PDF_DIMENSION_LAYOUT_UNSUPPORTED|dimension_layout_unconfirmed/i,'PDF_DIMENSION_LAYOUT_UNSUPPORTED','technical','maintainer','Maßtabelle des artikelgebundenen Original-PDFs technisch prüfen; belegte Produktmaße nicht erneut erfragen.'],
  [/dimension_table_conflict|dimension_mismatch/i,'DOCUMENT_DIMENSION_CONFLICT','identity','user_or_source','Belegte Maße und widersprüchliche Originalangaben gezielt abgleichen; Gerätewerte nicht zur Umgehung ändern.'],
  [/document_article_conflict/i,'DOCUMENT_ARTICLE_CONFLICT','identity','agent','Original mit widerspruchsfreier Artikelzuordnung suchen; keine Maße fremder Produkte verwenden.'],
  [/manufacturer_(?:source|redirect|fragment_redirect)_unconfirmed/i,'MANUFACTURER_SOURCE_UNCONFIRMED','configuration','maintainer','Verifizierte Herstellerquelle registrieren oder eine neu belegte zulässige Quelle verwenden.'],
  [/SOURCE_(?:FILE|RESPONSE|SIZE)_LIMIT/i,'SOURCE_FILE_LIMIT','technical','maintainer','Kleinere passende Herstellerunterlage oder geprüft angepasste technische Grenze.'],
  [/SOURCE_HTTP_ERROR/i,'SOURCE_HTTP_ERROR','source','agent','Erreichbaren offiziellen Download belegen; HTTP-Sperren nicht umgehen.'],
  [/pdf_not_linked_by_manufacturer/i,'PDF_LINK_UNCONFIRMED','technical','maintainer','Veröffentlichte PDF-Verknüpfung prüfen oder unterstützten Originaldownload belegen.'],
  [/manufacturer_page_article_not_confirmed|no_bound_pdf_link/i,'ARTICLE_SOURCE_UNCONFIRMED','source','agent','Passende Herstellerseite mit Artikelbeleg und verlinktem Original suchen.'],
  [/PROPOSAL_(?:CONFLICT|STORAGE_UPGRADE_REQUIRED)/i,'PROPOSAL_CONFLICT','technical','maintainer','Vorhandenen Vorschlag und Zurückziehung prüfen; Bestandszuordnung nicht still überschreiben.'],
  [/SOURCE_(?:TIMEOUT|FETCH|NETWORK)|fetch_failed/i,'SOURCE_UNREACHABLE','source','agent','Neue Erreichbarkeit oder alternative offizielle Quelle nachweisen.'],
  [/variant|variante/i,'VARIANT_UNCONFIRMED','identity','user_or_source','Exakte Variante durch vorhandenen Beleg oder gezielte Antwort klären.'],
  [/article|artikel/i,'ARTICLE_UNCONFIRMED','identity','user_or_source','Exakte Artikelnummer in der Herstellerunterlage belegen.']
];
function classify(search) {
  if (!search || !['blocked','not_found'].includes(search.outcome)) return null;
  if (search.outcome === 'not_found') return {code:'DOCUMENT_NOT_FOUND',kind:'source',owner:'agent',resumeWhen:'Neue Quelle oder neue Artikelinformation liegt vor.',repeatWithoutNewEvidence:false};
  const text = [search.reason,search.evidence?.sourceQuote,search.blockerCode].filter(Boolean).join(' ').replace(/manufacturer_pdf_article_variant_v\d+/g,'');
  const rule = rules.find(([pattern])=>pattern.test(text));
  const [,code,kind,owner,resumeWhen] = rule || [null,'VERIFICATION_BLOCKED','technical','maintainer','Konkreten Prüfbefund beheben oder neue belegte Quelle liefern.'];
  return {code,kind,owner,resumeWhen,repeatWithoutNewEvidence:false,...(kind==='technical'?{askUser:false,missingFields:[]}: {})};
}
function summarize(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.code;
    if (!groups.has(key)) groups.set(key,{code:key,kind:item.kind,owner:item.owner,resumeWhen:item.resumeWhen,count:0});
    groups.get(key).count++;
  }
  return {total:items.length,groups:[...groups.values()].slice(0,3),groupCount:groups.size,
    details:{tool:'edoku_datasheet_coverage',status:'open',limit:3},repeatWithoutNewEvidence:false};
}
function verificationResolution(report) {
  if(report.state==='matched')return {kind:'none',owner:'none',missingFields:[],askUser:false};
  const reasons=[report.reason,...(report.targets||[]).filter(row=>row.state!=='matched').map(row=>row.reason)].filter(Boolean);
  const blockers=reasons.map(reason=>classify({outcome:'blocked',reason}));
  const blocker=blockers.find(row=>row.kind==='technical')||blockers[0]||classify({outcome:'blocked',reason:''});
  return {kind:blocker.kind,code:blocker.code,owner:blocker.owner,missingFields:[],askUser:false,
    nextAction:blocker.kind==='technical'?'fix_verification':'verify_source_or_identity',instructions:blocker.resumeWhen,continueIndependent:true};
}
module.exports = {classify,summarize,verificationResolution};
