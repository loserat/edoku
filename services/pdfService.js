const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const PDFDocument = require("pdfkit");
const { createProjectFolder, fileSafeName } = require("./projectService");
const { normalizeBrandschutz } = require("./brandschutzService");
const { deviceListFieldsForLeistungsbereich, normalizeGeraetelisten } = require("./geraetelistenService");
const { getLeistungsbereichConfig, selectedHerstellerConfig } = require("./systemService");
const { applyLogicalChapterNumbers } = require("./chapterNumberingService");
const { formEnabledForLeistungsbereiche, mergeFormTemplates, templateTitle, textForKonformitaet } = require("./formTemplateService");
const { resolveCreatorLogo, resolveProjectLogo } = require("./logoService");
const { buildDocumentationAttachmentEntries, defaultDocumentMetaForCategory, documentationAttachments } = require("./documentAttachmentService");

const BRAND_LINK_URL = "https://nickgm.de";
const BRAND_ICON_PATH = "M10 2h4M11 2v6.5l-5.2 9.2C4.6 19.8 6.1 22 8.5 22h7c2.4 0 3.9-2.2 2.7-4.3L13 8.5V2M8.2 15h7.6M9.2 19h5.6";
const PAGE_MARGIN = 48;
const FOOTER_Y_OFFSET = 60;
const BRAND_Y_OFFSET = 34;
const SIGNATURE_HEIGHT = 54;
const SIGNATURE_BOTTOM_OFFSET = 104;
const CM_TO_PT = 28.3464567;
const MM_TO_PT = CM_TO_PT / 10;
const TRENNSTREIFEN_WIDTH = 24 * CM_TO_PT;
const TRENNSTREIFEN_HEIGHT = 10.5 * CM_TO_PT;
const AVERY_ORDNER_RUECKEN_X = 9 * MM_TO_PT;
const AVERY_ORDNER_RUECKEN_WIDTH = 192 * MM_TO_PT;

// * INFO: Avery-Zweckform liefert A4-Bögen mit horizontal liegenden Ordnerrücken.
// ? WARUM: Die Positionen entsprechen den Kalibrierungsbögen 61x192-R und 38x192-R.
function buildAveryOrdnerRueckenRows(topMarginMm, labelHeightMm, rowsPerPage) {
  return Array.from({ length: rowsPerPage }, (_, index) => ({
    x: AVERY_ORDNER_RUECKEN_X,
    y: (topMarginMm + index * labelHeightMm) * MM_TO_PT,
    width: AVERY_ORDNER_RUECKEN_WIDTH,
    height: labelHeightMm * MM_TO_PT
  }));
}

const ORDNER_RUECKEN_FORMATS = {
  "38x192-r": {
    label: "Avery Zweckform 38x192-R",
    rowsPerPage: 7,
    positions: buildAveryOrdnerRueckenRows(15.5, 38, 7)
  },
  "61x192-r": {
    label: "Avery Zweckform 61x192-R",
    rowsPerPage: 4,
    positions: buildAveryOrdnerRueckenRows(26.5, 61, 4)
  },
  // ? WARUM: Alte gespeicherte Werte bleiben gültig und werden intern auf die neuen Avery-Profile gemappt.
  schmal: { alias: "38x192-r" },
  breit: { alias: "61x192-r" }
};

// * INFO: Vollversionen koennen das sichtbare edoku/nickgm-Branding zentral deaktivieren.
function isBrandingEnabled(systemSettings = {}) {
  return !systemSettings.lizenz || systemSettings.lizenz.brandingAktiv !== false;
}

// * INFO: Seitengeometrie-Helfer für einheitliche PDF-Abstände.
function pageLeft(doc) {
  return doc.page.margins.left || PAGE_MARGIN;
}

function pageRight(doc) {
  return doc.page.margins.right || PAGE_MARGIN;
}

function pageContentWidth(doc) {
  return doc.page.width - pageLeft(doc) - pageRight(doc);
}

// * INFO: Filtert die aktivierten und exportierbaren Matrixeinträge.
function activeExportDocs(matrix) {
  return matrix
    .filter((doc) => doc.aktiv && doc.export)
    .sort((a, b) => a.sortierung - b.sortierung);
}

// * INFO: Import-Platzhalter werden im Inhaltsverzeichnis durch echte Anhänge ersetzt.
function isImportedDocumentPlaceholder(entry) {
  const dokumenttyp = String(entry.dokumenttyp || "");
  const formularart = String(entry.formularart || "");
  return dokumenttyp === "Plan" && formularart === "Dateiliste" && Number(entry.ebene || 1) >= 2;
}

// * INFO: Numerischer Sortierwert aus Kapitelnummern für künstlich ergänzte Einträge.
function chapterSortValue(kapitel, fallback = 999000) {
  const parts = String(kapitel || "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

  if (!parts.length) return fallback;

  return parts.reduce((sum, part, index) => {
    const weight = index === 0 ? 1000 : 10 ** Math.max(0, 2 - index);
    return sum + part * weight;
  }, 0);
}

// * INFO: Aktive Leistungsbereiche als Set für Gerätelisten- und Exportfilter.
function activeLeistungsbereicheSet(leistungsbereiche = {}) {
  return new Set(Array.isArray(leistungsbereiche.aktiv) ? leistungsbereiche.aktiv : []);
}

// * INFO: Gerätelisten erscheinen nur im Export, wenn sie aktiv und exportierbar sind.
function filterExportGeraetelisten(geraetelisten = [], leistungsbereiche = {}) {
  const activeSet = activeLeistungsbereicheSet(leistungsbereiche);
  return normalizeGeraetelisten(geraetelisten).filter((liste) => {
    if (!liste.aktiv || !liste.export) return false;
    return !activeSet.size || activeSet.has(liste.leistungsbereich);
  });
}

/**
 * * INFO: Baut das Inhaltsverzeichnis aus Matrix, aktiven Gerätelisten und importierten PDFs.
 * ? WARUM: Ergänzt fehlende Elternkapitel, damit Gerätelisten logisch einsortiert werden.
 */
function buildInhaltsverzeichnisEntries(matrix, geraetelisten = [], anhaenge = [], leistungsbereiche = {}, projekt = {}) {
  const activeLists = filterExportGeraetelisten(geraetelisten, leistungsbereiche);
  const matrixByKapitel = new Map((matrix || []).map((entry) => [String(entry.kapitel || ""), entry]));
  const tocBaseById = new Map();

  (matrix || [])
    .filter((entry) => entry.aktiv && entry.export && !isImportedDocumentPlaceholder(entry))
    .forEach((entry) => tocBaseById.set(entry.id || `matrix-${entry.kapitel}`, entry));

  function ensureTocParent(kapitel, fallbackListe) {
    const normalizedKapitel = String(kapitel || "");
    if (!normalizedKapitel) return;
    const parentAlreadyVisible = [...tocBaseById.values()].some((entry) => String(entry.kapitel || "") === normalizedKapitel);
    if (parentAlreadyVisible) return;

    const matrixParent = matrixByKapitel.get(normalizedKapitel);
    tocBaseById.set(`toc-parent-${normalizedKapitel}`, {
      ...(matrixParent || {}),
      id: matrixParent ? matrixParent.id : `toc-parent-${normalizedKapitel}`,
      kapitel: normalizedKapitel,
      titel: matrixParent ? matrixParent.titel : fallbackListe.titel.replace(/^Geräteliste\s*/i, ""),
      ebene: matrixParent ? matrixParent.ebene : normalizedKapitel.includes(".") ? 2 : 1,
      aktiv: true,
      export: true,
      pflicht: Boolean(matrixParent && matrixParent.pflicht),
      leistungsbereich: matrixParent ? matrixParent.leistungsbereich : fallbackListe.leistungsbereich,
      dokumenttyp: matrixParent ? matrixParent.dokumenttyp : "Geräteliste",
      formularart: matrixParent ? matrixParent.formularart : "Tabelle",
      quelle: matrixParent ? matrixParent.quelle : "data/geraetelisten.json",
      sortierung: matrixParent && Number.isFinite(matrixParent.sortierung)
        ? matrixParent.sortierung
        : chapterSortValue(normalizedKapitel)
    });
  }

  activeLists.forEach((liste) => {
    const kapitel = String(liste.kapitel || "");
    const parts = kapitel.split(".").filter(Boolean);
    parts.forEach((_, index) => {
      ensureTocParent(parts.slice(0, index + 1).join("."), liste);
    });
  });

  // * INFO: Importierte PDFs brauchen ihr Kategorie-Elternkapitel im Inhaltsverzeichnis.
  // ? WARUM: Sonst kann z. B. ein Stromlaufplan als 12.1.1 erscheinen, waehrend 12.1 fehlt.
  documentationAttachments(anhaenge)
    .filter((entry) => entry.export !== false)
    .forEach((entry) => {
      const meta = defaultDocumentMetaForCategory(entry.category);
      const kapitel = String(entry.kapitel || meta.kapitel || "");
      const parts = kapitel.split(".").filter(Boolean);
      parts.forEach((_, index) => {
        ensureTocParent(parts.slice(0, index + 1).join("."), {
          titel: meta.title || entry.category || "Dokumentation",
          leistungsbereich: "Dokumentation"
        });
      });
    });

  const docs = activeExportDocs(applyLogicalChapterNumbers([...tocBaseById.values()], { exportOnly: true }));
  const docsByOriginalKapitel = new Map(
    docs.map((entry) => [String(entry.originalKapitel || entry.kapitel), entry])
  );
  const listCountersByKapitel = new Map();
  const listEntries = activeLists.map((liste) => {
      const parent = docsByOriginalKapitel.get(String(liste.kapitel || ""));
      const counterKey = String(liste.kapitel || "");
      const next = (listCountersByKapitel.get(counterKey) || 0) + 1;
      listCountersByKapitel.set(counterKey, next);

      return {
        id: `toc-${liste.id}`,
        kapitel: liste.kapitel,
        originalKapitel: liste.kapitel,
        displayKapitel: `${parent ? parent.displayKapitel || parent.kapitel : liste.kapitel}.${next}`,
        titel: `${liste.titel} - ${liste.leistungsbereich}`,
        ebene: 3,
        aktiv: true,
        export: true,
        sortierung: (parent ? parent.sortierung : chapterSortValue(liste.kapitel)) + next / 100
      };
    });

  const attachmentEntries = buildDocumentationAttachmentEntries([...tocBaseById.values()], anhaenge, projekt, activeLists);

  return [...docs, ...listEntries, ...attachmentEntries].sort((a, b) => {
    const sortA = Number.isFinite(a.sortierung) ? a.sortierung : 0;
    const sortB = Number.isFinite(b.sortierung) ? b.sortierung : 0;
    if (sortA !== sortB) return sortA - sortB;
    return String(a.displayKapitel || a.kapitel || "").localeCompare(String(b.displayKapitel || b.kapitel || ""), "de", { numeric: true });
  });
}

// * INFO: Map Gerätelisten-ID -> logische Kapitelnummer für PDF-Dateinamen und Überschriften.
function logicalDeviceListNumbers(matrix, geraetelisten = [], leistungsbereiche = {}) {
  return new Map(
    buildInhaltsverzeichnisEntries(matrix, geraetelisten, [], leistungsbereiche)
      .filter((entry) => String(entry.id || "").startsWith("toc-"))
      .map((entry) => [String(entry.id).replace(/^toc-/, ""), entry.displayKapitel || entry.kapitel])
  );
}

// * INFO: Verweist Gerätepositionen auf Kapitel der optional hinterlegten Bedienungsanleitungen.
function manualChapterNumbers(matrix, geraetelisten = [], anhaenge = [], leistungsbereiche = {}, projekt = {}) {
  return new Map(
    buildInhaltsverzeichnisEntries(matrix, geraetelisten, anhaenge, leistungsbereiche, projekt)
      .filter((entry) => entry.attachmentId)
      .map((entry) => [entry.attachmentId, entry.displayKapitel || entry.kapitel])
  );
}

// * INFO: Map Originalkapitel -> logische Anzeige-Kapitelnummer für Formular-PDFs.
function logicalDocumentNumbers(matrix, geraetelisten = [], leistungsbereiche = {}) {
  return new Map(
    buildInhaltsverzeichnisEntries(matrix, geraetelisten, [], leistungsbereiche)
      .filter((entry) => !String(entry.id || "").startsWith("toc-"))
      .map((entry) => [String(entry.originalKapitel || entry.kapitel), entry.displayKapitel || entry.kapitel])
  );
}

// * INFO: Löscht alte generierte PDFs eines Bereichs, bevor neue PDFs erzeugt werden.
async function clearGeneratedPdfs(folderPath) {
  try {
    const entries = await fsp.readdir(folderPath, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf")
      .map((entry) => fsp.unlink(path.join(folderPath, entry.name))));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

// * INFO: Löscht Formular-PDFs im Generiert-Root, lässt das Inhaltsverzeichnis aber stehen.
async function clearGeneratedRootFormPdfs(folderPath) {
  try {
    const entries = await fsp.readdir(folderPath, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.isFile()
        && path.extname(entry.name).toLowerCase() === ".pdf"
        && entry.name !== "Inhaltsverzeichnis.pdf")
      .map((entry) => fsp.unlink(path.join(folderPath, entry.name))));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

// * INFO: Zeichnet bevorzugt das zentrale Erstellerlogo, alternativ ein Projektlogo.
function writeProjectLogo(doc, projekt, rootDir, systemSettings = {}, options = {}) {
  if (!rootDir) return;

  const logoCandidates = [
    {
      baseDir: path.join(rootDir, "storage"),
      logoPath: systemSettings.ersteller ? systemSettings.ersteller.logoPfad : "",
      resolver: resolveCreatorLogo
    },
    {
      baseDir: rootDir,
      logoPath: projekt.logoPfad,
      resolver: resolveProjectLogo
    }
  ].filter((candidate) => candidate.logoPath);

  if (!logoCandidates.length) return;

  try {
    const logoPath = logoCandidates
      .map((candidate) => {
        try {
          return candidate.resolver(candidate.baseDir, candidate.logoPath);
        } catch {
          return "";
        }
      })
      .find((candidatePath) => candidatePath && fs.existsSync(candidatePath));

    if (!logoPath) return;

    const boxX = options.x || doc.page.width - doc.page.margins.right - 92;
    const boxY = options.y ?? doc.y;
    const boxWidth = options.width || 92;
    const boxHeight = options.height || 34;

    if (options.centerInBox) {
      const image = doc.openImage(logoPath);
      const imageRatio = image.width / image.height;
      const boxRatio = boxWidth / boxHeight;
      const drawWidth = imageRatio > boxRatio ? boxWidth : boxHeight * imageRatio;
      const drawHeight = imageRatio > boxRatio ? boxWidth / imageRatio : boxHeight;
      doc.image(logoPath, boxX + (boxWidth - drawWidth) / 2, boxY + (boxHeight - drawHeight) / 2, {
        width: drawWidth,
        height: drawHeight
      });
      return;
    }

    doc.image(logoPath, boxX, boxY, {
      fit: [boxWidth, boxHeight],
      align: "right"
    });
  } catch (error) {
    console.error("Logo konnte nicht in PDF eingefügt werden:", error.message);
  }
}

// * INFO: Einzelzelle des kompakten Projektkopfs im PDF.
function drawCompactHeaderCell(doc, x, y, width, height, label, value) {
  doc.save();
  doc.strokeColor("#cbd5e1").lineWidth(0.45).rect(x, y, width, height).stroke();
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(5.8).text(label, x + 4, y + 4, {
    width: width - 8,
    height: 8,
    lineBreak: false
  });
  doc.fillColor("#111827").font("Helvetica").fontSize(7.2).text(value || "-", x + 4, y + 13, {
    width: width - 8,
    height: height - 15,
    ellipsis: true
  });
  doc.restore();
}

// * INFO: Einheitlicher PDF-Kopf mit Projektstammdaten und Logo.
function writeProjectHeader(doc, projekt, rootDir, systemSettings = {}) {
  const startX = pageLeft(doc);
  const startY = doc.y;
  const width = pageContentWidth(doc);
  const rowHeight = 25;
  const logoWidth = 98;
  const logoGap = 12;
  const dataWidth = width - logoWidth - logoGap;
  const columns = [
    Math.floor(dataWidth * 0.38),
    Math.floor(dataWidth * 0.22),
    dataWidth - Math.floor(dataWidth * 0.38) - Math.floor(dataWidth * 0.22)
  ];
  const rows = [
    [
      ["Projekt", projekt.projektname],
      ["Projekt-Nr.", projekt.projektnummer],
      ["Auftraggeber", projekt.auftraggeber]
    ],
    [
      ["Liegenschaft", projekt.liegenschaft],
      ["Baumaßnahme", projekt.baumassnahme],
      ["Maßnahme / Auftrag", [projekt.massnahmeNr, projekt.auftragsNr].filter(Boolean).join(" / ")]
    ]
  ];

  doc.save();
  doc.fillColor("#f8fafc").rect(startX, startY, dataWidth, rowHeight).fill();
  doc.restore();

  rows.forEach((row, rowIndex) => {
    let cellX = startX;
    row.forEach(([label, value], columnIndex) => {
      drawCompactHeaderCell(doc, cellX, startY + rowIndex * rowHeight, columns[columnIndex], rowHeight, label, value);
      cellX += columns[columnIndex];
    });
  });

  doc.x = startX;
  doc.y = startY;
  writeProjectLogo(doc, projekt, rootDir, systemSettings, {
    x: startX + dataWidth + logoGap,
    y: startY + 2,
    width: logoWidth,
    height: rowHeight * rows.length - 4,
    centerInBox: true
  });
  doc.x = startX;
  doc.y = startY + rows.length * rowHeight + 12;
}

// * INFO: Dokumenttitel unterhalb des Projektkopfs.
function writeDocumentTitle(doc, title, subtitle = "") {
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(title, pageLeft(doc), doc.y, {
    width: pageContentWidth(doc)
  });
  if (subtitle) {
    doc.font("Helvetica").fontSize(9).fillColor("#374151").text(subtitle, pageLeft(doc), doc.y + 2, {
      width: pageContentWidth(doc)
    });
  }
  doc.moveDown(0.7);
  doc.fillColor("#000");
}

function writeCoverPage(doc, projekt, rootDir, systemSettings, entry) {
  writeProjectHeader(doc, projekt, rootDir, systemSettings);
  doc.moveDown(1.4);
  doc.font("Helvetica-Bold").fontSize(52).fillColor("#111827").text(entry.displayKapitel || entry.kapitel, pageLeft(doc), doc.y, {
    width: pageContentWidth(doc),
    align: "center"
  });
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text(entry.titel || "Kapitel", pageLeft(doc), doc.y, {
    width: pageContentWidth(doc),
    align: "center"
  });
  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text("Deckblatt Hauptkategorie", pageLeft(doc), doc.y, {
    width: pageContentWidth(doc),
    align: "center"
  });
  writeFooter(doc, projekt);
}

function writeSeparatorPage(doc, projekt, entry, options = {}) {
  const width = doc.page.width;
  const height = doc.page.height;
  const margin = 18;
  const registerWidth = 86;
  const chapter = entry.displayKapitel || entry.kapitel || "";
  const title = entry.titel || "Unterkategorie";
  const showInnenText = options.showInnenText === true;
  const showRegisterTitel = options.showRegisterTitel === true;
  const registerLabel = showRegisterTitel ? `${chapter}  ${title}` : chapter;
  // * INFO: Der linke Bereich bleibt wegen Lochung frei; Text beginnt bewusst weiter rechts.
  const punchSafeLeft = margin + 54;

  doc.save();
  doc.fillColor("#ffffff").rect(0, 0, width, height).fill();
  doc.strokeColor("#cbd5e1").lineWidth(0.8).rect(margin, margin, width - margin * 2, height - margin * 2).stroke();
  // * INFO: Nur eine gestrichelte Falz-/Registerlinie, kein farbiger Kasten. Das spart Toner/Tinte.
  doc.strokeColor("#cbd5e1").dash(4, { space: 4 }).moveTo(width - margin - registerWidth, margin).lineTo(width - margin - registerWidth, height - margin).stroke().undash();

  if (showInnenText) {
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(22).text(chapter, punchSafeLeft, margin + 34, {
      width: width - registerWidth - punchSafeLeft - margin,
      lineBreak: false
    });
    doc.font("Helvetica-Bold").fontSize(15).text(title, punchSafeLeft, margin + 72, {
      width: width - registerWidth - punchSafeLeft - margin,
      height: 70,
      ellipsis: true
    });
  } else {
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(30).text(chapter, punchSafeLeft, margin + 42, {
      width: width - registerWidth - punchSafeLeft - margin,
      lineBreak: false
    });
  }

  doc.save();
  doc.translate(width - margin - registerWidth / 2, height / 2);
  doc.rotate(-90);
  // * INFO: Standard ist nur die Kapitelnummer am Registerrand; Titel wird nur optional ergänzt.
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(showRegisterTitel ? 10 : 17).text(registerLabel, -((height - margin * 3) / 2), showRegisterTitel ? -7 : -11, {
    width: height - margin * 3,
    align: "center",
    ellipsis: true
  });
  doc.restore();
  doc.restore();
}

function writeConfirmationMeta(doc, rows = []) {
  const x = pageLeft(doc);
  const width = pageContentWidth(doc);
  const rowHeight = 18;
  const labelWidth = 104;
  const valueWidth = width - labelWidth;
  const startY = doc.y;

  rows.filter(([, value]) => String(value || "").trim()).forEach(([label, value], index) => {
    const y = startY + index * rowHeight;
    doc.save();
    doc.strokeColor("#d1d5db").lineWidth(0.45).rect(x, y, labelWidth, rowHeight).stroke();
    doc.rect(x + labelWidth, y, valueWidth, rowHeight).stroke();
    doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(7).text(label, x + 5, y + 5, {
      width: labelWidth - 10,
      height: rowHeight - 7
    });
    doc.fillColor("#111827").font("Helvetica").fontSize(8).text(String(value || "-"), x + labelWidth + 5, y + 5, {
      width: valueWidth - 10,
      height: rowHeight - 7,
      ellipsis: true
    });
    doc.restore();
  });

  doc.y = startY + rows.filter(([, value]) => String(value || "").trim()).length * rowHeight + 12;
}

function writeConfirmationSubject(doc, title, subtitle = "") {
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(title, pageLeft(doc), doc.y, {
    width: pageContentWidth(doc)
  });
  if (subtitle) {
    doc.font("Helvetica").fontSize(9).fillColor("#374151").text(subtitle, pageLeft(doc), doc.y + 2, {
      width: pageContentWidth(doc)
    });
  }
  doc.moveDown(0.8);
  doc.fillColor("#000");
}

function writeConfirmationBody(doc, text, options = {}) {
  doc.font("Helvetica").fontSize(options.fontSize || 10).fillColor("#111827").text(text || "", pageLeft(doc), doc.y, {
    width: pageContentWidth(doc),
    align: "left",
    lineGap: 2
  });
  doc.moveDown(1);
}

// * INFO: Grundlayout für formularartige Bestätigungen und Konformitätserklärungen.
function writeConfirmationDocument(doc, projekt, rootDir, systemSettings, template, title, options = {}) {
  if (template.showProjectHeader) writeProjectHeader(doc, projekt, rootDir, systemSettings);
  writeConfirmationSubject(doc, title, options.subject || "Bestätigung / Erklärung");
  writeConfirmationMeta(doc, [
    ["Projekt", projekt.projektname],
    ["Projekt-Nr.", projekt.projektnummer],
    ["Auftraggeber", projekt.auftraggeber],
    ["Liegenschaft", projekt.liegenschaft],
    ["Baumaßnahme", projekt.baumassnahme],
    ["Auftrag / Gewerk", projekt.auftragGewerk],
    ["Ausführung", projekt.ortDerAusfuehrung],
    ["Ausführende Firma", projekt.ausfuehrendeFirma]
  ]);
}

// * INFO: Fußzeile der PDFs. Projektbezogene Orts-/Datumsangaben bleiben optional.
function writeFooter(doc, projekt) {
  const bottom = doc.page.height - FOOTER_Y_OFFSET;
  const footerParts = [
    projekt.bearbeiter ? `Bearbeiter: ${projekt.bearbeiter}` : "",
    projekt.ortDatum || ""
  ].filter(Boolean);

  if (!footerParts.length) return;

  doc.font("Helvetica").fontSize(8).fillColor("#666");
  doc.text(footerParts.join(" | "), pageLeft(doc), bottom, {
    width: pageContentWidth(doc),
    align: "center"
  });
  doc.fillColor("#000");
}

// * INFO: Kleines Branding mit Link im PDF-Fußbereich.
function writeFooterBranding(doc, systemSettings = {}) {
  if (!isBrandingEnabled(systemSettings)) {
    return;
  }

  if (!doc._footerBrandingPages) {
    doc._footerBrandingPages = new WeakSet();
  }

  if (doc._footerBrandingPages.has(doc.page)) {
    return;
  }

  doc._footerBrandingPages.add(doc.page);

  const previousX = doc.x;
  const previousY = doc.y;
  const x = doc.page.margins.left || PAGE_MARGIN;
  const iconSize = 18;
  const y = doc.page.height - BRAND_Y_OFFSET - iconSize / 2;

  doc.save();
  doc.translate(x, y).scale(iconSize / 24);
  doc.path(BRAND_ICON_PATH).lineWidth(1.8).lineCap("round").lineJoin("round").stroke("#4b5563");
  doc.restore();
  doc.link(x - 2, y - 2, iconSize + 4, iconSize + 4, BRAND_LINK_URL);

  doc.x = previousX;
  doc.y = previousY;
}

// * INFO: Signaturbereich für Bestätigungsformulare.
function writeSignature(doc, label = "Firmenstempel / Unterschrift:") {
  const x = pageLeft(doc);
  const width = pageContentWidth(doc);
  const top = doc.page.height - SIGNATURE_BOTTOM_OFFSET - SIGNATURE_HEIGHT;
  const lineY = top + 35;

  if (doc.y > top - 12) {
    doc.addPage();
  }

  doc.save();
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(label, x, top, {
    width
  });
  doc.strokeColor("#111827").lineWidth(0.8).moveTo(x, lineY).lineTo(x + 230, lineY).stroke();
  doc.fillColor("#6b7280").font("Helvetica").fontSize(7).text("Ort, Datum, Firmenstempel und Unterschrift", x, lineY + 5, {
    width: 230
  });
  doc.restore();
  doc.x = x;
  doc.y = top + SIGNATURE_HEIGHT;
}

// * INFO: Gemeinsamer PDF-Wrapper: Datei anlegen, Writer ausführen und Stream abschließen.
async function writePdf(filePath, title, writer, options = {}) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: options.margin ?? 48,
      size: options.size || "A4",
      layout: options.layout || "portrait",
      bufferPages: true
    });
    const stream = fs.createWriteStream(filePath);
    doc._systemSettings = options.systemSettings || {};
    doc.pipe(stream);
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
    writer(doc, { title });
    const pageRange = doc.bufferedPageRange();
    // ! WICHTIG: Trennstreifen deaktivieren Footer-Branding explizit, weil Registerdruck ohne Fußlogo erfolgen soll.
    if (options.includeFooterBranding !== false && isBrandingEnabled(options.systemSettings || {})) {
      for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        writeFooterBranding(doc, options.systemSettings || {});
      }
    }
    doc.end();
  });
}

// * INFO: Ermittelt Normen aus Projekt-Systemauswahl oder Systemdefaults.
function selectedSystemNormen(leistungsbereich, leistungsbereiche, systeme, projektSysteme = []) {
  const entries = Array.isArray(leistungsbereich) ? leistungsbereich : [leistungsbereich];
  const normen = entries.flatMap((entryLeistungsbereich) => {
    const projektSelection = (projektSysteme || []).find((entry) => entry.leistungsbereich === entryLeistungsbereich);
    if (projektSelection && Array.isArray(projektSelection.normen) && projektSelection.normen.length) {
      return projektSelection.normen;
    }

    if (systeme && Array.isArray(systeme.leistungsbereiche)) {
      const configEntry = getLeistungsbereichConfig(systeme, entryLeistungsbereich);
      const hersteller = selectedHerstellerConfig(configEntry || {}, projektSelection ? projektSelection.hersteller : "");
      return hersteller.normen || hersteller.dokumentarten || [];
    }

    if (projektSelection && projektSelection.dokumentarten) {
      return projektSelection.dokumentarten;
    }

    const selectedId = (leistungsbereiche.systemAuswahl || {})[entryLeistungsbereich];
    const direct = Array.isArray(systeme) ? systeme.find((system) => system.id === selectedId) : null;
    const fallback = Array.isArray(systeme) ? systeme.find((system) => system.leistungsbereich === entryLeistungsbereich) : null;
    const system = direct || fallback;
    return system ? system.normen || [] : [];
  });

  return [...new Set(normen.filter(Boolean))];
}

const ANLAGENBESCHREIBUNG_TEXTE = {
  "Elektroinstallation / DIN VDE 0100": {
    titel: "Elektroinstallation und Niederspannungsinstallation",
    text: "Die Elektroinstallation bildet die grundlegende technische Infrastruktur der dokumentierten Liegenschaft. Sie umfasst die installierten Stromkreise, Betriebsmittel, Leitungsanlagen und zugehörigen Schutzmaßnahmen, die für eine sichere, nachvollziehbare und dauerhaft betreibbare Nutzung der elektrischen Anlage erforderlich sind. Die Ausführung ist als wesentlicher Bestandteil der Gebäudetechnik zu betrachten und dient sowohl der täglichen Nutzung als auch dem zuverlässigen Betrieb der angeschlossenen Verbraucher. Die installierte Anlage ist so zu betrachten, dass Stromkreisstruktur, Schutzmaßnahmen, Leitungsführung und angeschlossene Verbraucher im Betrieb eindeutig nachvollzogen werden können. Für Wartung, Erweiterung, Prüfung und Störungsbearbeitung ist eine klare technische Zuordnung der Anlagenteile erforderlich."
  },
  "Sicherheitsbeleuchtung": {
    titel: "Sicherheitsbeleuchtungsanlage",
    text: "Die Sicherheitsbeleuchtungsanlage unterstützt die sichere Orientierung und Evakuierung im Ereignisfall. Sie stellt sicher, dass relevante Rettungswege, Ausgänge, Richtungsänderungen und sicherheitsrelevante Bereiche auch bei Ausfall der Allgemeinbeleuchtung erkennbar bleiben. Die Anlage ist damit ein wichtiger Bestandteil des organisatorischen und baulichen Sicherheitskonzeptes. Die Anlage umfasst die jeweils zugeordneten Sicherheitsleuchten, Versorgungs- und Überwachungskomponenten sowie die relevanten Schalt- und Betriebszustände. Für den Betrieb sind die eindeutige Zuordnung der Leuchten, die Erkennbarkeit der Versorgungsbereiche und die Nachvollziehbarkeit der Prüf- und Wartungsanforderungen wesentlich."
  },
  "Beleuchtungsanlage": {
    titel: "Beleuchtungsanlage",
    text: "Die Beleuchtungsanlage stellt die nutzungsgerechte Ausleuchtung der dokumentierten Bereiche sicher. Sie trägt wesentlich zu Komfort, Orientierung, Arbeitssicherheit und Wahrnehmungsqualität innerhalb der Liegenschaft bei. Die Anlage umfasst die installierten Leuchten, Schaltstellen, Steuerungskomponenten und zugeordneten Versorgungsbereiche. Für den technischen Betrieb sind insbesondere Leuchtentypen, Montageorte, Steuerungsprinzipien und Wartungszugänglichkeit maßgeblich."
  },
  "Kabeltragsysteme / Verlegesysteme": {
    titel: "Kabeltragsysteme und Verlegesysteme",
    text: "Die Kabeltragsysteme und Verlegesysteme bilden die mechanische Grundlage für eine geordnete, zugängliche und betriebssichere Leitungsführung. Sie stellen sicher, dass Energie-, Kommunikations- und Steuerleitungen nachvollziehbar geführt, geschützt und für spätere Arbeiten auffindbar bleiben. Eine sauber dokumentierte Leitungsführung verbessert die Übersicht im Gebäudebetrieb erheblich und reduziert den Aufwand bei Fehlersuche, Erweiterung oder Rückbau. Die vorhandenen Systeme sind als tragende Infrastruktur für die elektrische und informationstechnische Versorgung einzuordnen und müssen hinsichtlich Verlauf, Systemart, Belegung und Zugänglichkeit eindeutig nachvollziehbar bleiben."
  },
  "Kabeltragsysteme / Verlegesysteme mit Funktionserhalt": {
    titel: "Kabeltragsysteme mit Funktionserhalt",
    text: "Kabeltragsysteme mit Funktionserhalt dienen der sicheren Leitungsführung für Anlagen, deren Funktion im Brandfall für einen definierten Zeitraum erhalten bleiben muss. Diese Systeme stellen besondere Anforderungen an Befestigung, Montage, Systemzulassung und Nachweisführung. Die Anlagenbestandteile sind für sicherheitsrelevante Funktionen von besonderer Bedeutung. Verwendete Tragsysteme, Befestigungsart, Leitungswege und Systemnachweise müssen deshalb eindeutig zugeordnet und im technischen Zusammenhang mit den versorgten Anlagen betrachtet werden."
  },
  "Niederspannungsschaltanlagen / Verteilungen": {
    titel: "Niederspannungsschaltanlagen und Verteilungen",
    text: "Die Niederspannungsschaltanlagen und Verteilungen stellen die zentrale Energieverteilung innerhalb der Anlage sicher. Sie bündeln Schutz-, Schalt- und Verteilfunktionen und sind damit für Versorgungssicherheit, Bedienbarkeit und Fehlereingrenzung besonders wichtig. Die Verteilungen sind als zentrale Knotenpunkte der Elektroinstallation zu verstehen. Abgänge, Einspeisungen, Schutzorgane, Beschriftungen und zugehörige Stromkreise müssen für Betrieb, Wartung, Prüfung und spätere Anpassungen eindeutig erkennbar sein."
  },
  "Erdung / Potentialausgleich": {
    titel: "Erdung und Potentialausgleich",
    text: "Die Erdungs- und Potentialausgleichsanlage ist ein zentraler Bestandteil des Schutzkonzeptes der elektrischen Anlage. Sie unterstützt den Schutz gegen elektrischen Schlag, den sicheren Fehlerstrompfad und die Reduzierung gefährlicher Potentialunterschiede. Die technischen Bestandteile sind hinsichtlich Lage, Funktion und Zuordnung der Schutzmaßnahmen zu betrachten. Besonders wichtig sind die Verbindungspunkte, Leiterquerschnitte, Haupterdungsschienen, Schutzleiter, Potentialausgleichsleiter und Schnittstellen zu Blitzschutz-, Kommunikations- und Gebäudetechniksystemen."
  },
  "Blitzschutzanlage": {
    titel: "Blitzschutzanlage",
    text: "Die Blitzschutzanlage dient dem Schutz der baulichen Anlage und der technischen Infrastruktur vor den Auswirkungen direkter und indirekter Blitzeinwirkungen. Sie ist in Verbindung mit Erdung, Potentialausgleich und Überspannungsschutz als Teil eines abgestimmten Schutzsystems zu betrachten. Die vorhandenen Komponenten sind im Zusammenhang mit Fangeinrichtungen, Ableitungen, Erdungsanlage, Potentialausgleich und Überspannungsschutz zu bewerten. Für Prüfung und Instandhaltung sind Lage, Zustand, Anschlussstellen und Systemgrenzen der Anlage technisch nachvollziehbar zu halten."
  },
  "Datentechnik / Kommunikationsverkabelung": {
    titel: "Datentechnik und Kommunikationsverkabelung",
    text: "Die Datentechnik und Kommunikationsverkabelung bildet die Grundlage für digitale Dienste, Gebäudekommunikation und netzwerkbasierte Anwendungen. Die Anlage umfasst Verkabelungsstrecken, Anschlussdosen, Patchfelder, Verteilerbereiche und gegebenenfalls aktive Übergabepunkte. Da Erweiterungen, Fehlersuche und Umzüge häufig im laufenden Betrieb erfolgen, sind Kabelwege, Portzuordnungen, Kategorien und Verteilerstrukturen technisch eindeutig zu erfassen."
  },
  "Telekommunikation": {
    titel: "Telekommunikationsanlage",
    text: "Die Telekommunikationsanlage stellt die Sprach- und Kommunikationsschnittstellen der Liegenschaft bereit. Sie kann klassische Anschlusspunkte, Verteilerstrukturen und Übergänge zu modernen Kommunikationsdiensten umfassen. Die Anlage umfasst Anschlusspunkte, Verteilerstrukturen, Übergänge und gegebenenfalls Endgeräte oder Übergabeschnittstellen. Gerade bei gewachsenen Bestandsanlagen sind Leitungswege, Anschlussarten und Schnittstellen technisch eindeutig zu beschreiben, damit Betrieb, Erweiterung und Störungsbearbeitung zielgerichtet erfolgen können."
  },
  "Breitbandkommunikationsanlage": {
    titel: "Breitbandkommunikationsanlage",
    text: "Die Breitbandkommunikationsanlage unterstützt die Verteilung von Medien- und Kommunikationssignalen innerhalb der Liegenschaft. Sie ist für die Versorgung relevanter Nutzungseinheiten und technischer Bereiche von Bedeutung. Die Anlage umfasst Übergabepunkte, Verstärker- oder Verteilerstrukturen, Leitungswege und Anschlussstellen. Für einen stabilen Betrieb sind Signalwege, Komponenten, Dämpfungs- und Verteilkonzept sowie die Zuordnung der versorgten Bereiche technisch nachvollziehbar zu halten."
  },
  "Rauchwarnmelderanlage": {
    titel: "Rauchwarnmelderanlage",
    text: "Die Rauchwarnmelderanlage unterstützt die frühzeitige Erkennung von Rauchereignissen in den dokumentierten Bereichen. Sie ist ein wichtiger Bestandteil des vorbeugenden Schutzkonzeptes und erhöht die Aufmerksamkeit im Ereignisfall. Die Anlage umfasst die installierten Melder, deren Montagebereiche und die zugehörigen Wartungs- und Austauschzyklen. Für den Betrieb sind Standort, Funktion, Zuordnung und Erreichbarkeit der Melder technisch eindeutig zu erfassen."
  },
  "Brandmeldeanlage": {
    titel: "Brandmeldeanlage",
    text: "Die Brandmeldeanlage dient der frühzeitigen Detektion und Meldung von Brandereignissen und ist damit ein sicherheitsrelevanter Bestandteil der technischen Gebäudeausrüstung. Sie kann Melder, Zentralen, Alarmierungseinrichtungen, Schnittstellen und Übertragungswege umfassen. Die Anlage umfasst Melder, Zentralen, Signalgeber, Übertragungseinrichtungen und Schnittstellen zu weiteren gebäudetechnischen Systemen. Für einen zuverlässigen Betrieb sind Meldergruppen, Überwachungsbereiche, Alarmierungswege, Steuerfunktionen und technische Schnittstellen klar zu beschreiben."
  },
  "Gefahrenmelde- / Alarmanlage": {
    titel: "Gefahrenmelde- und Alarmanlage",
    text: "Die Gefahrenmelde- und Alarmanlage dient der Überwachung definierter Zustände und der Weitergabe relevanter Meldungen. Sie unterstützt damit Sicherheit, Reaktion und Betriebstransparenz innerhalb der Liegenschaft. Die Anlage umfasst die installierten Melde-, Bedien-, Übertragungs- und Alarmierungskomponenten sowie deren technische Schnittstellen. Für den Betrieb sind überwachte Bereiche, Signalwege, Zuständigkeiten und Reaktionsketten eindeutig zuzuordnen."
  },
  "Präsenzmelder": {
    titel: "Präsenzmelder und Steuerungskomponenten",
    text: "Präsenzmelder und zugehörige Steuerungskomponenten unterstützen die bedarfsgerechte Nutzung von Beleuchtung und weiteren Funktionen. Sie verbessern Komfort, Bedienbarkeit und Energieeffizienz, indem Schalt- und Regelvorgänge an die tatsächliche Nutzung angepasst werden. Die Komponenten sind als Teil der Steuerungs- und Automationsstruktur zu betrachten. Erfassungsbereiche, Montageorte, Schaltlogik, Betriebsarten und Zuordnung zu Leuchten oder weiteren Funktionen sind für Betrieb, Fehlersuche und Optimierung technisch relevant."
  },
  "Brandschutzabschottungen": {
    titel: "Brandschutzabschottungen",
    text: "Brandschutzabschottungen sichern Leitungsdurchführungen in raumabschließenden Bauteilen und tragen dazu bei, die brandschutztechnische Qualität der betroffenen Bauteile zu erhalten. Die Abschottungen sind hinsichtlich Lage, Bauteil, Feuerwiderstand, eingesetztem System, Zulassung und durchgeführten Medien technisch zu beschreiben. Für spätere Nachbelegung oder Kontrolle sind eindeutige Raum- und Geschosszuordnungen, Ausführungsdaten und Fotobelege besonders wichtig."
  },
  "Bestandspläne": {
    titel: "Bestandspläne und Planunterlagen",
    text: "Bestandspläne und Planunterlagen stellen die räumliche Lage der installierten elektrotechnischen Anlagen dar. Sie umfassen je nach Projekt Stromlaufpläne, Schaltpläne, Installationspläne, Schemata, Verteilerpläne und Übersichtspläne. Technisch relevant sind Lagebezüge, Leitungswege, Betriebsmittel, Verteilerzuordnungen, Stromkreiskennzeichnungen und Geschossbezüge."
  },
  "Bilddokumentation": {
    titel: "Bilddokumentation",
    text: "Die Bilddokumentation zeigt Einbausituationen, Anlagenkomponenten, Typenschilder, Verteiler, Leitungsführungen, Brandschutzdetails und besondere Ausführungszustände. Technisch sinnvoll zugeordnete Bilder unterstützen die Bewertung des Bestands, weil sie räumliche Situationen und Ausführungsdetails sichtbar machen, die in Tabellen nur eingeschränkt abgebildet werden können."
  }
};

// * INFO: Aktive Leistungsbereiche als sortierte Liste für Textgeneratoren.
function activeLeistungsbereiche(leistungsbereiche) {
  if (Array.isArray(leistungsbereiche)) return leistungsbereiche;
  return Array.isArray(leistungsbereiche && leistungsbereiche.aktiv) ? leistungsbereiche.aktiv : [];
}

// * INFO: Schreibt längere Fließtexte mit automatischen Seitenumbrüchen.
function writeParagraphWithPageBreaks(doc, text, projekt, rootDir, systemSettings, title) {
  const paragraphs = String(text || "").split(/\n{2,}/).filter(Boolean);
  paragraphs.forEach((paragraph) => {
    const availableWidth = pageContentWidth(doc);
    const neededHeight = doc.heightOfString(paragraph, {
      width: availableWidth,
      align: "justify",
      lineGap: 2
    }) + 10;
    if (doc.y + neededHeight > doc.page.height - FOOTER_Y_OFFSET - 12) {
      writeFooter(doc, projekt);
      doc.addPage();
      writeProjectHeader(doc, projekt, rootDir, systemSettings);
      writeDocumentTitle(doc, title, "Fortsetzung");
    }
    doc.font("Helvetica").fontSize(9.2).fillColor("#111827").text(paragraph, pageLeft(doc), doc.y, {
      width: availableWidth,
      align: "justify",
      lineGap: 2
    });
    doc.moveDown(0.7);
  });
}

// * INFO: Baut den vordefinierten Beschreibungstext der dokumentierten Elektroanlage.
function anlagenbeschreibungText(projekt, leistungsbereiche) {
  const aktive = activeLeistungsbereiche(leistungsbereiche);
  const intro = [
    `Die installierte elektrotechnische Anlage des Projekts "${projekt.projektname || "Bestandsdokumentation Elektro"}" umfasst die im Objekt vorhandenen elektrischen Energieversorgungs-, Verteilungs-, Schutz-, Beleuchtungs-, Kommunikations- und Sicherheitssysteme. Die Anlage dient der sicheren Versorgung der Nutzungseinheiten, der technischen Betriebsbereiche und der angeschlossenen Verbraucher. Sie ist als zusammenhängendes gebäudetechnisches System zu betrachten, bei dem Einspeisung, Verteilung, Leitungsführung, Schutzmaßnahmen, Steuerungsfunktionen und nachgeordnete Betriebsmittel technisch aufeinander abgestimmt sind.`,
    "Die Anlagenstruktur setzt sich aus zentralen und dezentralen Komponenten zusammen. Dazu gehören je nach Leistungsumfang Niederspannungsverteilungen, Stromkreise, Leitungsanlagen, Kabeltragsysteme, Beleuchtungs- und Sicherheitsanlagen, Kommunikationsverkabelungen, Erdungs- und Potentialausgleichsanlagen sowie brandschutztechnisch relevante Durchführungen. Für den Betrieb ist wesentlich, dass diese Bestandteile eindeutig ihren Bereichen, Geschossen, Räumen, Stromkreisen und technischen Funktionen zugeordnet werden können.",
    "Die technische Beschreibung richtet den Blick auf den installierten Bestand und seine spätere Nutzbarkeit im Betrieb. Im Vordergrund stehen die eindeutige Identifikation der Anlagenbereiche, die Zuordnung der Betriebsmittel, die Nachvollziehbarkeit der Schutz- und Versorgungsstruktur sowie die Möglichkeit, Wartung, Prüfung, Störungsbearbeitung und Erweiterungen fachgerecht vorzubereiten. Die Anlage wird deshalb nicht als lose Sammlung einzelner Komponenten betrachtet, sondern als geordnetes elektrotechnisches Gesamtsystem innerhalb der Liegenschaft."
  ];

  const projectContext = [
    projekt.auftraggeber ? `Auftraggeber: ${projekt.auftraggeber}` : "",
    projekt.liegenschaft ? `Liegenschaft: ${projekt.liegenschaft}` : "",
    projekt.baumassnahme ? `Baumaßnahme: ${projekt.baumassnahme}` : "",
    projekt.auftragGewerk ? `Auftrag / Gewerk: ${projekt.auftragGewerk}` : "",
    projekt.ortDerAusfuehrung ? `Ort der Ausführung: ${projekt.ortDerAusfuehrung}` : ""
  ].filter(Boolean);

  const scope = projectContext.length
    ? `Die technische Zuordnung erfolgt auf Grundlage der hinterlegten Projektdaten: ${projectContext.join("; ")}. Diese Angaben beschreiben den räumlichen und organisatorischen Bezug der Anlage und bilden den Rahmen für die Einordnung der installierten elektrotechnischen Systeme.`
    : "Die technische Zuordnung erfolgt auf Grundlage der im Projekt hinterlegten Stammdaten. Diese Angaben beschreiben den räumlichen und organisatorischen Bezug der Anlage und bilden den Rahmen für die Einordnung der installierten elektrotechnischen Systeme.";

  const sections = aktive
    .map((name) => ANLAGENBESCHREIBUNG_TEXTE[name])
    .filter(Boolean)
    .map((entry) => `${entry.titel}\n${entry.text}`);

  const fallback = sections.length ? [] : [
    "Für das Projekt sind aktuell noch keine spezifischen Leistungsbereiche aktiviert. Die technische Anlagenbeschreibung beschreibt daher zunächst den allgemeinen elektrotechnischen Anlagenrahmen. Nach Auswahl der ausgeführten Leistungsbereiche wird die Beschreibung automatisch um die zugehörigen Anlagenbestandteile erweitert."
  ];

  const closing = [
    "Die elektrotechnische Anlage ist in ihrer Gesamtheit auf sicheren Betrieb, eindeutige Zuordnung und langfristige Instandhaltbarkeit auszurichten. Besonders relevant sind klare Kennzeichnungen, nachvollziehbare Stromkreis- und Anlagenbezüge, zugängliche Verteiler- und Leitungswege sowie die fachgerechte Einbindung sicherheitsrelevanter Funktionen.",
    "Für spätere Prüfungen, Wartungen, Umbauten und Erweiterungen ist eine technisch geordnete Betrachtung des Bestands entscheidend. Je präziser Anlagenbereiche, Betriebsmittel, Planunterlagen, Messprotokolle, Nachweise und Fotobelege den installierten Systemen zugeordnet sind, desto effizienter können Betreiber und Fachunternehmen den Bestand bewerten und fortführen.",
    "Die beschriebene Anlage stellt damit einen strukturierten elektrotechnischen Bestand dar, dessen wesentliche Komponenten und Funktionen nachvollziehbar zusammenwirken. Die Zuordnung der Teilanlagen schafft eine belastbare Grundlage für Betriebssicherheit, technische Transparenz und spätere fachgerechte Bearbeitung."
  ];

  return [...intro, scope, ...sections, ...fallback, ...closing].join("\n\n");
}

// * INFO: Generiert die zentrale Anlagenbeschreibung als eigenes PDF.
async function generateAnlagenbeschreibungPdf(rootDir, projekt, entry, leistungsbereiche, systemSettings = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const displayKapitel = entry.displayKapitel || entry.kapitel;
  const filePath = path.join(paths.generatedPath, `${String(displayKapitel).replaceAll(".", "_")}_${fileSafeName(entry.titel)}.pdf`);
  const title = entry.titel || "Anlagenbeschreibung";
  const text = anlagenbeschreibungText(projekt, leistungsbereiche);

  await writePdf(filePath, title, (doc) => {
    writeProjectHeader(doc, projekt, rootDir, systemSettings);
    writeDocumentTitle(doc, title, `Kapitel ${displayKapitel} - Übersicht der installierten Anlagenbereiche`);
    writeParagraphWithPageBreaks(doc, text, projekt, rootDir, systemSettings, title);
    writeFooter(doc, projekt);
  }, { systemSettings });

  return filePath;
}

// * INFO: Generiert das Inhaltsverzeichnis aus Matrix, Gerätelisten und importierten PDFs.
async function generateInhaltsverzeichnis(rootDir, projekt, matrix, systemSettings = {}, geraetelisten = [], anhaenge = [], leistungsbereiche = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const filePath = path.join(paths.generatedPath, "Inhaltsverzeichnis.pdf");
  const docs = buildInhaltsverzeichnisEntries(matrix, geraetelisten, anhaenge, leistungsbereiche, projekt);

  await writePdf(filePath, "Inhaltsverzeichnis", (doc) => {
    writeProjectHeader(doc, projekt, rootDir, systemSettings);
    writeDocumentTitle(doc, "Inhaltsverzeichnis");
    docs.forEach((entry) => {
      if (doc.y > 745) {
        writeFooter(doc, projekt);
        doc.addPage();
        writeProjectHeader(doc, projekt, rootDir, systemSettings);
        writeDocumentTitle(doc, "Inhaltsverzeichnis", "Fortsetzung");
      }
      const indent = (entry.ebene - 1) * 14;
      doc.font(entry.ebene === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(entry.ebene === 1 ? 12 : 10);
      doc.text(`${entry.displayKapitel || entry.kapitel}  ${entry.titel}`, 48 + indent, doc.y, { width: 500 - indent });
      doc.moveDown(0.25);
    });
    writeFooter(doc, projekt);
  }, { systemSettings });

  return [filePath];
}

// * INFO: Generiert Deckblätter für Hauptkapitel. Diese PDFs laufen im normalen Export mit.
async function generateDeckblaetter(rootDir, projekt, matrix, systemSettings = {}, geraetelisten = [], anhaenge = [], leistungsbereiche = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const docs = buildInhaltsverzeichnisEntries(matrix, geraetelisten, anhaenge, leistungsbereiche, projekt)
    .filter((entry) => Number(entry.ebene || 1) === 1)
    .filter((entry) => String(entry.displayKapitel || entry.kapitel || "") !== "0");
  const generated = [];

  for (const entry of docs) {
    const displayKapitel = entry.displayKapitel || entry.kapitel;
    const filePath = path.join(paths.generatedPath, `${String(displayKapitel).replaceAll(".", "_")}_${fileSafeName(entry.titel || "Deckblatt")}.pdf`);
    await writePdf(filePath, entry.titel || "Deckblatt", (doc) => {
      writeCoverPage(doc, projekt, rootDir, systemSettings, entry);
    }, { systemSettings });
    generated.push(filePath);
  }

  return generated;
}

// * INFO: Generiert separat druckbare Register-/Trennstreifen für Unterkategorien.
async function generateTrennstreifen(rootDir, projekt, matrix, systemSettings = {}, geraetelisten = [], anhaenge = [], leistungsbereiche = {}, options = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const generatedDir = path.join(paths.generatedPath, "Trennstreifen");
  await clearGeneratedPdfs(generatedDir);
  const filePath = path.join(generatedDir, "Trennstreifen_Unterkategorien_24x10_5cm.pdf");
  const docs = buildInhaltsverzeichnisEntries(matrix, geraetelisten, anhaenge, leistungsbereiche, projekt)
    .filter((entry) => Number(entry.ebene || 1) === 2);
  const entries = docs.length ? docs : [{ kapitel: "", displayKapitel: "", titel: "Keine Unterkategorien vorhanden" }];

  await writePdf(filePath, "Trennstreifen Unterkategorien", (doc) => {
    entries.forEach((entry, index) => {
      if (index > 0) doc.addPage();
      writeSeparatorPage(doc, projekt, entry, options);
    });
  }, {
    size: [TRENNSTREIFEN_WIDTH, TRENNSTREIFEN_HEIGHT],
    margin: 0,
    // ! WICHTIG: Auf Trennstreifen generell kein Footer-Branding ausgeben.
    includeFooterBranding: false
  });

  return [filePath];
}

function normalizeOrdnerRueckenFormatKey(value) {
  if (value === "schmal") return "38x192-r";
  if (value === "breit") return "61x192-r";
  return ORDNER_RUECKEN_FORMATS[value] ? value : "61x192-r";
}

function normalizeOrdnerRueckenPrintOptions(options = {}) {
  return {
    showProjektname: options.showProjektname !== false,
    showProjektnummer: options.showProjektnummer !== false,
    showAuftraggeber: options.showAuftraggeber === true,
    showLiegenschaft: options.showLiegenschaft !== false,
    showBaumassnahme: options.showBaumassnahme === true,
    showOrdnernummer: options.showOrdnernummer !== false,
    showFormatHint: options.showFormatHint === true
  };
}

function drawOrdnerRueckenLabel(doc, projekt, index, count, x, y, width, height, formatLabel, options = {}) {
  const print = normalizeOrdnerRueckenPrintOptions(options);
  const title = projekt.projektname || "Bestandsdokumentation Elektro";
  const number = projekt.projektnummer || "";
  const client = projekt.auftraggeber || "";
  const property = projekt.liegenschaft || "";
  const measure = projekt.baumassnahme || "";
  const label = count > 1 ? `Ordner ${index + 1} / ${count}` : "Dokumentationsordner";
  const projectDetails = [
    print.showProjektnummer ? number : "",
    print.showAuftraggeber ? client : "",
    print.showLiegenschaft ? property : "",
    print.showBaumassnahme ? measure : ""
  ].filter(Boolean);
  const mainTitle = print.showProjektname ? title : (number || client || property || "Dokumentation");
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const readableWidth = Math.max(80, width - 54);
  const titleSize = height > 150 ? 18 : 14;
  const detailSize = height > 150 ? 9.5 : 7.5;
  const labelSize = height > 150 ? 7.5 : 6.5;

  doc.save();
  doc.strokeColor("#cbd5e1").lineWidth(0.7).rect(x, y, width, height).stroke();

  // * INFO: Avery-Bögen liegen quer auf A4. Der Inhalt wird gedreht, damit er im Ordner lesbar sitzt.
  doc.save();
  doc.translate(centerX, centerY);
  doc.rotate(180);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(titleSize).text(mainTitle, -readableWidth / 2, -height / 2 + 11, {
    width: readableWidth,
    align: "center",
    ellipsis: true
  });

  if (projectDetails.length) {
    doc.fillColor("#374151").font("Helvetica").fontSize(detailSize).text(projectDetails.join(" | "), -readableWidth / 2, -height / 2 + (height > 150 ? 38 : 31), {
      width: readableWidth,
      align: "center",
      ellipsis: true
    });
  }

  if (print.showOrdnernummer) {
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(labelSize).text(label, -readableWidth / 2, height / 2 - 26, {
      width: readableWidth,
      align: "center",
      ellipsis: true
    });
  }
  if (print.showFormatHint) {
    doc.fillColor("#6b7280").font("Helvetica").fontSize(5.5).text(formatLabel, -readableWidth / 2, height / 2 - 13, {
      width: readableWidth,
      align: "center",
      ellipsis: true
    });
  }
  doc.restore();
  doc.restore();
}

// * INFO: Generiert separat druckbare Ordnerrücken für Dokumentationsordner.
async function generateOrdnerruecken(rootDir, projekt, systemSettings = {}, options = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const generatedDir = path.join(paths.generatedPath, "Ordnerruecken");
  await clearGeneratedPdfs(generatedDir);
  const formatKey = normalizeOrdnerRueckenFormatKey(options.format);
  const format = ORDNER_RUECKEN_FORMATS[formatKey] || ORDNER_RUECKEN_FORMATS["61x192-r"];
  const count = Math.max(1, Math.min(20, Number(options.ordnerAnzahl) || 1));
  const filePath = path.join(generatedDir, `Ordnerruecken_Avery_Zweckform_${formatKey.toUpperCase()}_${count}x.pdf`);

  await writePdf(filePath, "Ordnerrücken", (doc) => {
    const positions = format.positions || ORDNER_RUECKEN_FORMATS["61x192-r"].positions;
    const perPage = positions.length;

    for (let index = 0; index < count; index += 1) {
      if (index > 0 && index % perPage === 0) doc.addPage();
      const position = positions[index % perPage];
      drawOrdnerRueckenLabel(doc, projekt, index, count, position.x, position.y, position.width, position.height, format.label, options);
    }
  }, {
    size: "A4",
    margin: 0,
    includeFooterBranding: false,
    systemSettings
  });

  return [filePath];
}

// * INFO: Generiert Formular-PDFs wie Konformitäts- und Errichterbestätigungen.
async function generateFormularPdfs(rootDir, projekt, matrix, leistungsbereiche, systeme, projektSysteme = [], formTemplates = {}, systemSettings = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const generated = [];
  const docs = activeExportDocs(applyLogicalChapterNumbers(matrix, { exportOnly: true }));
  const templates = mergeFormTemplates(formTemplates);
  await clearGeneratedRootFormPdfs(paths.generatedPath);

  const anlagenbeschreibung = docs.find((entry) => entry.dokumenttyp === "Anlagenbeschreibung" && /Anlagenbeschreibung/i.test(entry.titel || ""));
  if (anlagenbeschreibung) {
    generated.push(await generateAnlagenbeschreibungPdf(rootDir, projekt, anlagenbeschreibung, leistungsbereiche, systemSettings));
  }

  const konformitaet = docs.filter((entry) => entry.kapitel.startsWith("2.") && entry.dokumenttyp === "Konformitätserklärung");
  for (const entry of konformitaet) {
    const displayKapitel = entry.displayKapitel || entry.kapitel;
    const filePath = path.join(paths.generatedPath, `${String(displayKapitel).replaceAll(".", "_")}_${fileSafeName(entry.titel)}.pdf`);
    const entryLeistungsbereiche = [
      entry.leistungsbereich,
      ...(Array.isArray(entry.leistungsbereiche) ? entry.leistungsbereiche : [])
    ].filter(Boolean);
    const normen = selectedSystemNormen(entryLeistungsbereiche, leistungsbereiche, systeme, projektSysteme);
    const template = templates.konformitaet;
    if (!formEnabledForLeistungsbereiche(template, entryLeistungsbereiche)) continue;
    const title = templateTitle(template, entry.titel);
    await writePdf(filePath, title, (doc) => {
      doc.fontSize(template.fontSizeBody);
      writeConfirmationDocument(doc, projekt, rootDir, systemSettings, template, title, {
        subject: "Konformitätserklärung"
      });
      if (template.showLeistungsbereich) {
        doc.font("Helvetica-Bold").text(`Leistungsbereich: ${entryLeistungsbereiche.join(", ")}`);
        doc.moveDown(template.spacing);
      }
      if (template.showNormen) {
        doc.font("Helvetica-Bold").text("Normen / Grundlagen:");
        doc.font("Helvetica").text(normen.length ? normen.join(", ") : template.normenFallback);
        doc.moveDown(template.spacing);
      }
      writeConfirmationBody(doc, textForKonformitaet(template, entryLeistungsbereiche), {
        fontSize: template.fontSizeBody
      });
      if (projekt.ortDatum) {
        doc.moveDown();
        doc.text(projekt.ortDatum);
      }
      if (template.showSignature) writeSignature(doc, template.signatureLabel);
      if (template.showFooter) writeFooter(doc, projekt);
    }, { ...template, systemSettings });
    generated.push(filePath);
  }

  const ceDocs = docs.filter((entry) => entry.dokumenttyp === "CE-Bestätigung");
  for (const entry of ceDocs) {
    const displayKapitel = entry.displayKapitel || entry.kapitel;
    const filePath = path.join(paths.generatedPath, `${String(displayKapitel).replaceAll(".", "_")}_${fileSafeName(entry.titel)}.pdf`);
    const template = templates.ceBestaetigung;
    const title = templateTitle(template, entry.titel);
    await writePdf(filePath, title, (doc) => {
      doc.fontSize(template.fontSizeBody);
      writeConfirmationDocument(doc, projekt, rootDir, systemSettings, template, title, {
        subject: "CE-Bestätigung"
      });
      doc.font("Helvetica-Bold").text("Kurzbeschreibung");
      doc.font("Helvetica").text(entry.titel);
      doc.moveDown(template.spacing);
      writeConfirmationBody(doc, template.bodyText || "", { fontSize: template.fontSizeBody });
      if (template.showSignature) writeSignature(doc, template.signatureLabel);
      if (template.showFooter) writeFooter(doc, projekt);
    }, { ...template, systemSettings });
    generated.push(filePath);
  }

  const dguv = docs.find((entry) => entry.kapitel === "11.1");
  if (dguv) {
    const displayKapitel = dguv.displayKapitel || dguv.kapitel;
    const filePath = path.join(paths.generatedPath, `${String(displayKapitel).replaceAll(".", "_")}_DGUV_Bestaetigung.pdf`);
    const template = templates.dguv;
    const title = templateTitle(template, dguv.titel);
    await writePdf(filePath, title, (doc) => {
      doc.fontSize(template.fontSizeBody);
      writeConfirmationDocument(doc, projekt, rootDir, systemSettings, template, title, {
        subject: "Prüf- / Bestätigungsnachweis"
      });
      writeConfirmationBody(doc, template.bodyText || "", { fontSize: template.fontSizeBody });
      if (projekt.ortDatum) {
        doc.moveDown();
        doc.text(projekt.ortDatum);
      }
      if (template.showSignature) writeSignature(doc, template.signatureLabel);
      if (template.showFooter) writeFooter(doc, projekt);
    }, { ...template, systemSettings });
    generated.push(filePath);
  }

  const errichter = docs.find((entry) => entry.kapitel === "11.2");
  if (errichter) {
    const displayKapitel = errichter.displayKapitel || errichter.kapitel;
    const filePath = path.join(paths.generatedPath, `${String(displayKapitel).replaceAll(".", "_")}_Errichterbestaetigung.pdf`);
    const template = templates.errichter;
    const title = templateTitle(template, errichter.titel);
    await writePdf(filePath, title, (doc) => {
      doc.fontSize(template.fontSizeBody);
      writeConfirmationDocument(doc, projekt, rootDir, systemSettings, template, title, {
        subject: "Errichterbestätigung"
      });
      writeConfirmationBody(doc, template.bodyText || "", { fontSize: template.fontSizeBody });
      if (projekt.ortDatum) {
        doc.moveDown();
        doc.text(projekt.ortDatum);
      }
      if (template.showSignature) writeSignature(doc, template.signatureLabel);
      if (template.showFooter) writeFooter(doc, projekt);
    }, { ...template, systemSettings });
    generated.push(filePath);
  }

  return generated;
}

// * INFO: Tabellenkopf für Gerätelisten und ähnliche Listen-PDFs.
function drawTableHeader(doc, columns, y) {
  const height = 18;
  const tableX = columns[0].x;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);

  doc.save();
  doc.fillColor("#e8eef7").strokeColor("#9ca3af").lineWidth(0.6);
  doc.rect(tableX, y, tableWidth, height).fillAndStroke("#e8eef7", "#9ca3af");
  let x = tableX;
  columns.slice(0, -1).forEach((column) => {
    x += column.width;
    doc.moveTo(x, y).lineTo(x, y + height).stroke();
  });
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(7).fillColor("#111827");
  columns.forEach((column) => {
    doc.text(column.label, column.x + 3, y + 5, { width: column.width - 6, height: height - 6 });
  });
  doc.font("Helvetica").fontSize(7).fillColor("#111827");
  return y + height;
}

// * INFO: Tabellenzeile mit automatischer Höhe für mehrzeilige Inhalte.
function drawTableRow(doc, columns, values, y) {
  doc.font("Helvetica").fontSize(7);
  const padding = 3;
  const minHeight = 20;
  const tableX = columns[0].x;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const textHeights = columns.map((column, index) => doc.heightOfString(String(values[index] || ""), {
    width: column.width - padding * 2
  }));
  const height = Math.max(minHeight, Math.ceil(Math.max(...textHeights) + padding * 2));

  doc.save();
  doc.strokeColor("#cbd5e1").lineWidth(0.45);
  doc.rect(tableX, y, tableWidth, height).stroke();
  let x = tableX;
  columns.slice(0, -1).forEach((column) => {
    x += column.width;
    doc.moveTo(x, y).lineTo(x, y + height).stroke();
  });
  doc.restore();

  doc.fillColor("#111827");
  columns.forEach((column, index) => {
    doc.text(String(values[index] || ""), column.x + padding, y + padding, {
      width: column.width - padding * 2,
      height: height - padding * 2
    });
  });
  return y + height;
}

// * INFO: Skaliert Spaltenbreiten auf die verfügbare Seitenbreite.
function buildFullWidthColumns(doc, rawColumns) {
  const maxTableWidth = pageContentWidth(doc);
  const totalWidth = rawColumns.reduce((sum, column) => sum + column.width, 0);
  const scale = totalWidth ? maxTableWidth / totalWidth : 1;
  let nextColumnX = pageLeft(doc);

  return rawColumns.map((rawColumn, index) => {
    const remainingColumns = rawColumns.length - index - 1;
    const remainingMinWidth = remainingColumns * 24;
    const isLast = index === rawColumns.length - 1;
    const width = isLast
      ? Math.max(24, pageLeft(doc) + maxTableWidth - nextColumnX)
      : Math.max(24, Math.min(Math.floor(rawColumn.width * scale), pageLeft(doc) + maxTableWidth - nextColumnX - remainingMinWidth));
    const column = { ...rawColumn, x: nextColumnX, width };
    nextColumnX += width;
    return column;
  });
}

// * INFO: Löst Bildpfade für Brandschutzseiten sicher innerhalb des Projektordners auf.
function resolvePdfImagePath(rootDir, candidatePath) {
  const value = String(candidatePath || "").trim();
  if (!value) return "";
  const candidates = [];

  if (path.isAbsolute(value)) {
    candidates.push(value);
  } else {
    candidates.push(path.join(rootDir, value));
    candidates.push(path.join(rootDir, "storage", value));
    candidates.push(path.join(rootDir, "output", value));
  }

  return candidates.find((candidate) => {
    try {
      const normalized = path.normalize(candidate);
      const extension = path.extname(normalized).toLowerCase();
      return [".png", ".jpg", ".jpeg", ".webp"].includes(extension) && fs.existsSync(normalized);
    } catch {
      return false;
    }
  }) || "";
}

// * INFO: Zeichnet Foto-Platzhalter oder vorhandene Bilder auf Brandschutzseiten.
function drawImageSlot(doc, x, y, width, height, label, candidatePath, rootDir) {
  doc.save();
  doc.strokeColor("#cbd5e1").lineWidth(0.65).rect(x, y, width, height).stroke();
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(8).text(label, x + 8, y + 8, {
    width: width - 16,
    height: 12
  });

  const imagePath = resolvePdfImagePath(rootDir, candidatePath);
  if (imagePath) {
    try {
      doc.image(imagePath, x + 8, y + 24, {
        fit: [width - 16, height - 34],
        align: "center",
        valign: "center"
      });
      doc.restore();
      return;
    } catch (error) {
      console.error("Brandschutzbild konnte nicht eingefügt werden:", error.message);
    }
  }

  doc.fillColor("#9ca3af").font("Helvetica").fontSize(8).text(candidatePath || "Kein Bild hinterlegt", x + 8, y + height / 2 - 5, {
    width: width - 16,
    align: "center"
  });
  doc.restore();
}

// * INFO: Mehrspaltige Infofläche für strukturierte PDF-Angaben.
function drawInfoGrid(doc, x, y, width, rows) {
  const labelWidth = 94;
  const valueWidth = width - labelWidth;
  const rowHeight = 18;
  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    doc.save();
    doc.strokeColor("#d1d5db").lineWidth(0.45).rect(x, rowY, labelWidth, rowHeight).stroke();
    doc.rect(x + labelWidth, rowY, valueWidth, rowHeight).stroke();
    doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(7).text(label, x + 5, rowY + 5, {
      width: labelWidth - 10,
      height: rowHeight - 7
    });
    doc.fillColor("#111827").font("Helvetica").fontSize(8).text(String(value || "-"), x + labelWidth + 5, rowY + 5, {
      width: valueWidth - 10,
      height: rowHeight - 7,
      ellipsis: true
    });
    doc.restore();
  });
  return y + rows.length * rowHeight;
}

// * INFO: Kompaktere Infofläche für Brandschottungen mit mehr Platz für Fotos.
function drawCompactInfoGrid(doc, x, y, width, rows, columns = 3) {
  const gap = 0;
  const rowGap = 0;
  const cellWidth = (width - gap * (columns - 1)) / columns;
  let cursorY = y;
  let columnIndex = 0;
  let rowHeight = 0;

  rows.forEach((row) => {
    const span = Math.min(row.span || 1, columns);
    if (columnIndex + span > columns) {
      cursorY += rowHeight + rowGap;
      columnIndex = 0;
      rowHeight = 0;
    }

    const cellX = x + columnIndex * (cellWidth + gap);
    const cellSpanWidth = cellWidth * span + gap * (span - 1);
    const labelHeight = 9;
    const valueHeight = row.height || 17;
    const cellHeight = row.cellHeight || labelHeight + valueHeight + 8;

    doc.save();
    doc.strokeColor("#d1d5db").lineWidth(0.45).rect(cellX, cursorY, cellSpanWidth, cellHeight).stroke();
    doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(6.5).text(row.label, cellX + 5, cursorY + 4, {
      width: cellSpanWidth - 12,
      height: labelHeight
    });
    doc.fillColor("#111827").font("Helvetica").fontSize(7.5).text(String(row.value || "-"), cellX + 5, cursorY + 15, {
      width: cellSpanWidth - 10,
      height: valueHeight,
      ellipsis: true
    });
    doc.restore();

    columnIndex += span;
    rowHeight = Math.max(rowHeight, cellHeight);
    if (columnIndex >= columns) {
      cursorY += rowHeight + rowGap;
      columnIndex = 0;
      rowHeight = 0;
    }
  });

  return columnIndex > 0 ? cursorY + rowHeight : cursorY;
}

// * INFO: Generiert pro aktiver Geräteliste ein Tabellen-PDF.
async function generateGeraetelisten(rootDir, projekt, geraetelisten, systemSettings = {}, matrix = [], leistungsbereiche = {}, anhaenge = []) {
  const paths = await createProjectFolder(rootDir, projekt);
  const generated = [];
  const listen = filterExportGeraetelisten(geraetelisten, leistungsbereiche);
  const logicalNumbers = logicalDeviceListNumbers(matrix, listen, leistungsbereiche);
  const manualNumbers = manualChapterNumbers(matrix, listen, anhaenge, leistungsbereiche, projekt);
  const generatedDir = path.join(paths.generatedPath, "Geraetelisten");
  await clearGeneratedPdfs(generatedDir);

  for (const liste of listen) {
    const displayKapitel = logicalNumbers.get(liste.id) || liste.kapitel;
    const filePath = path.join(generatedDir, `${String(displayKapitel).replaceAll(".", "_")}_${fileSafeName(liste.leistungsbereich)}_${fileSafeName(liste.titel)}.pdf`);
    const rows = liste.positionen || [];
    const printableRows = rows.length ? rows : Array.from({ length: 10 }, (_, index) => ({
      pos: index + 1,
      hersteller: "",
      system: "",
      typ: "",
      artikelTyp: "",
      beschreibung: "",
      abmessung: "",
      farbe: "",
      spannung: "",
      leistung: "",
      kategorie: "",
      funktionserhalt: "",
      lvPosition: "",
      bedienungsanleitungId: "",
      bemerkung: ""
    }));

    await writePdf(filePath, "Geräteliste", (doc) => {
      writeProjectHeader(doc, projekt, rootDir, systemSettings);
      writeDocumentTitle(doc, "Geräteliste", `Kapitel ${displayKapitel} - ${liste.titel} | ${liste.leistungsbereich}`);
      const fields = deviceListFieldsForLeistungsbereich(liste.leistungsbereich);
      const showManualColumn = liste.leistungsbereich !== "Brandschutzabschottungen"
        && printableRows.some((row) => row.bedienungsanleitungId && manualNumbers.has(row.bedienungsanleitungId));
      const rawColumns = [
        { name: "pos", label: "Pos.", width: 26 },
        ...fields.map((field) => ({
          name: field.name,
          label: field.pdfLabel || field.label.replace(" (optional)", ""),
          width: field.pdfWidth || 54
        })),
        ...(showManualColumn ? [{ name: "bedienungsanleitungId", label: "Anleitung", width: 46 }] : [])
      ];
      const columns = buildFullWidthColumns(doc, rawColumns);
      const tableBottom = doc.page.height - 78;
      let tableY = drawTableHeader(doc, columns, doc.y);
      printableRows.forEach((row) => {
        const values = [
          row.pos,
          ...fields.map((field) => row[field.name]),
          ...(showManualColumn ? [row.bedienungsanleitungId ? `Kap. ${manualNumbers.get(row.bedienungsanleitungId) || "-"}` : ""] : [])
        ];
        const estimatedHeight = Math.max(20, Math.ceil(Math.max(...columns.map((column, index) => doc.heightOfString(String(values[index] || ""), {
          width: column.width - 6
        }))) + 6));
        if (tableY + estimatedHeight > tableBottom) {
          writeFooter(doc, projekt);
          doc.addPage();
          writeProjectHeader(doc, projekt, rootDir, systemSettings);
          writeDocumentTitle(doc, "Geräteliste", `Kapitel ${displayKapitel} - ${liste.titel} | ${liste.leistungsbereich}`);
          tableY = drawTableHeader(doc, columns, doc.y);
        }
        tableY = drawTableRow(doc, columns, values, tableY);
      });
      doc.y = tableY + 8;
      writeFooter(doc, projekt);
    }, { layout: "landscape", margin: 36, systemSettings });
    generated.push(filePath);
  }

  return generated;
}

// * INFO: Generiert Brandschutzseiten: eine Seite pro aktiver Brandschottung mit Foto 1/2.
async function generateBrandschutzPdf(rootDir, projekt, brandschutz, systemSettings = {}, matrix = [], geraetelisten = [], leistungsbereiche = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const generatedDir = path.join(paths.generatedPath, "Brandschutz");
  await clearGeneratedPdfs(generatedDir);
  const displayKapitel = logicalDocumentNumbers(matrix, geraetelisten, leistungsbereiche).get("13.5") || "13.5";
  const filePath = path.join(generatedDir, `${String(displayKapitel).replaceAll(".", "_")}_Bilddokumentation_Brandschottungen.pdf`);
  const entries = normalizeBrandschutz(brandschutz).filter((entry) => entry.aktiv);

  await writePdf(filePath, "Bilddokumentation Brandschottungen", (doc) => {
    const printableEntries = entries.length ? entries : [normalizeBrandschutz([{}])[0]];

    printableEntries.forEach((entry, index) => {
      if (index > 0) {
        writeFooter(doc, projekt);
        doc.addPage();
      }

      writeProjectHeader(doc, projekt, rootDir, systemSettings);
      writeDocumentTitle(doc, `Brandschottung ${index + 1}`, `Kapitel ${displayKapitel} - ${entry.geschoss || "-"} / ${entry.raum || "-"}`);

      const contentX = pageLeft(doc);
      const contentWidth = pageContentWidth(doc);
      const topY = doc.y;
      const infoRows = [
        { label: "Geschoss", value: entry.geschoss },
        { label: "Raum", value: entry.raum },
        { label: "Feuerwiderstand", value: entry.feuerwiderstand },
        { label: "Kabelanzahl (optional)", value: entry.anzahl_kabel },
        { label: "Bauteil", value: entry.bauteil, span: 2 },
        { label: "Hersteller / System", value: [entry.hersteller, entry.system].filter(Boolean).join(" / "), span: 2 },
        { label: "Abschottung", value: entry.abschottungssystem },
        { label: "Zulassung", value: entry.zulassung },
        { label: "Abmessung", value: entry.durchmesser },
        { label: "Datum / Monteur", value: [entry.ausfuehrungsdatum, entry.monteur].filter(Boolean).join(" / ") },
        { label: "Medium (optional)", value: entry.medium, span: 2 },
        { label: "Bemerkung (optional)", value: entry.bemerkung, span: 2 }
      ];
      const infoBottom = drawCompactInfoGrid(doc, contentX, topY, contentWidth, infoRows, 4);

      const imageGap = 14;
      const imageY = infoBottom + 12;
      const imageWidth = (contentWidth - imageGap) / 2;
      const maxImageHeight = doc.page.height - FOOTER_Y_OFFSET - imageY - 18;
      const imageHeight = Math.max(190, Math.min(300, maxImageHeight));
      drawImageSlot(doc, contentX, imageY, imageWidth, imageHeight, "Foto 1", entry.foto_vorher, rootDir);
      drawImageSlot(doc, contentX + imageWidth + imageGap, imageY, imageWidth, imageHeight, "Foto 2", entry.foto_nachher, rootDir);

      doc.y = imageY + imageHeight + 10;
    });
    writeFooter(doc, projekt);
  }, { layout: "landscape", margin: 36, systemSettings });

  return [filePath];
}

module.exports = {
  buildInhaltsverzeichnisEntries,
  generateBrandschutzPdf,
  generateDeckblaetter,
  generateFormularPdfs,
  generateGeraetelisten,
  generateInhaltsverzeichnis,
  generateOrdnerruecken,
  generateTrennstreifen
};
