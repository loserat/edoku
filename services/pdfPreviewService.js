const fs = require("fs/promises");
const path = require("path");
const { ensureInsideBase, assertSafePath, accessError } = require("./pathService");
const { getProjectPaths, readableProjectPaths } = require("./projectService");

const PREVIEW_FOLDERS = [
  { key: "generated", label: "Generiert", pathKey: "generatedPath" },
  { key: "final", label: "Final", pathKey: "finalPath" },
  { key: "config", label: "Externe Ablage", pathKey: "configPath" }
];

const DOWNLOAD_EXTENSIONS = new Set([".pdf", ".zip", ".txt"]);

function formatFileKind(fileName, extension) {
  if (/gesamtdokumentation\.pdf$/i.test(fileName)) return "gesamt-pdf";
  if (extension === ".zip") return "zip";
  if (/export_reihenfolge\.txt$/i.test(fileName)) return "reihenfolge";
  return extension.replace(".", "") || "datei";
}

function sortFinalExportFiles(files) {
  const priority = {
    "gesamt-pdf": 1,
    zip: 2,
    reihenfolge: 3,
    pdf: 4,
    txt: 5
  };

  return files.sort((a, b) => {
    const first = priority[a.kind] || 99;
    const second = priority[b.kind] || 99;
    if (first !== second) return first - second;
    return a.relativePath.localeCompare(b.relativePath, "de", { numeric: true });
  });
}

// * INFO: Sucht PDF-Dateien rekursiv und liefert relative Pfade für die Browser-Vorschau.
async function listPdfFiles(baseDir, rootDir, sourceLabel) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        files.push(...await listPdfFiles(fullPath, rootDir, sourceLabel));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        const relativePath = path.relative(rootDir, fullPath).replaceAll(path.sep, "/");
        files.push({
          id: relativePath,
          name: entry.name,
          source: sourceLabel,
          relativePath,
          updatedAt: (await fs.stat(fullPath)).mtime.toISOString()
        });
      }
    }

    return files;
  } catch (error) {
    return [];
  }
}

// * INFO: Listet alle PDFs, die im Projekt für eine Vorschau freigegeben sind.
async function listPdfPreviewFiles(rootDir, projekt) {
  const files = [];
  for (const paths of readableProjectPaths(rootDir, projekt)) {
    await assertSafePath(rootDir, paths.projectPath, { allowMissing: true });
    for (const folder of PREVIEW_FOLDERS) {
      await assertSafePath(rootDir, paths[folder.pathKey], { allowMissing: true });
      files.push(...await listPdfFiles(paths[folder.pathKey], paths.projectPath, folder.label));
    }
  }
  const seen = new Set();
  files.splice(0, files.length, ...files.filter(file => !seen.has(file.id) && seen.add(file.id)));

  return files.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source, "de");
    return a.relativePath.localeCompare(b.relativePath, "de", { numeric: true });
  });
}

// * INFO: Listet finale Export-Artefakte, die bewusst zum Download freigegeben sind.
async function listFinalExportFiles(rootDir, projekt) {
  const files=[], seen=new Set();
  for(const paths of readableProjectPaths(rootDir,projekt)) {
    await assertSafePath(rootDir,paths.finalPath,{allowMissing:true});
    let entries;try{entries=await fs.readdir(paths.finalPath,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')continue;throw error;}
    for(const entry of entries){
      const extension=path.extname(entry.name).toLowerCase();
      if(!entry.isFile()||!DOWNLOAD_EXTENSIONS.has(extension)||seen.has(entry.name))continue;
      const full=await assertSafePath(rootDir,path.join(paths.finalPath,entry.name),{type:'file'});
      const stat=await fs.stat(full), relativePath=path.relative(paths.projectPath,full).split(path.sep).join('/');
      seen.add(entry.name);files.push({id:relativePath,name:entry.name,extension,kind:formatFileKind(entry.name,extension),relativePath,size:stat.size,updatedAt:stat.mtime.toISOString()});
    }
  }
  return sortFinalExportFiles(files);
}

// * INFO: Löst eine Vorschau-Datei sicher auf und begrenzt den Zugriff auf Projektordner.
async function resolveOutputFile(rootDir,projekt,relativePath,preview) {
  if(typeof relativePath!=='string'||!relativePath||relativePath.includes('..')||path.isAbsolute(relativePath))throw accessError();
  const extension=path.extname(relativePath).toLowerCase();
  if(preview ? extension!=='.pdf' : !DOWNLOAD_EXTENSIONS.has(extension))throw accessError();
  for(const paths of readableProjectPaths(rootDir,projekt)){
    const target=ensureInsideBase(paths.projectPath,path.join(paths.projectPath,relativePath));
    const allowed=(preview?[paths.generatedPath,paths.finalPath,paths.configPath]:[paths.finalPath]).some(base=>{try{ensureInsideBase(base,target);return true;}catch{return false;}});
    if(!allowed)throw accessError();
    try{return await assertSafePath(rootDir,target,{type:'file'});}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  throw Object.assign(new Error('Datei nicht gefunden.'),{status:404});
}
async function resolvePdfPreviewFile(rootDir,projekt,relativePath){return resolveOutputFile(rootDir,projekt,relativePath,true);}
async function resolveExportDownloadFile(rootDir,projekt,relativePath){return resolveOutputFile(rootDir,projekt,relativePath,false);}

module.exports = {
  listPdfPreviewFiles,
  listFinalExportFiles,
  resolvePdfPreviewFile,
  resolveExportDownloadFile
};
