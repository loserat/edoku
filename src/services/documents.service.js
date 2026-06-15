const { documents, explanationTexts, normHints } = require("../data/demoStore");
const { normalizeId } = require("../utils/id");

// * INFO: Dokumente werden um Erklaertexte und Normhinweise ergaenzt.
function listDocuments() {
  return {
    documents,
    explanationTexts,
    normHints
  };
}

function getDocumentById(id) {
  return documents.find((document) => document.id === normalizeId(id)) || null;
}

module.exports = {
  getDocumentById,
  listDocuments
};
