const { getDocumentById, listDocuments } = require("../services/documents.service");
const { failure, success } = require("../utils/apiResponse");

// * INFO: GET /api/documents
function getDocuments(req, res) {
  return success(res, listDocuments(), "Dokumente geladen");
}

// * INFO: GET /api/documents/:id
function getDocument(req, res) {
  const document = getDocumentById(req.params.id);
  if (!document) return failure(res, "Dokument nicht gefunden", "DOCUMENT_NOT_FOUND", 404);
  return success(res, document, "Dokument geladen");
}

module.exports = {
  getDocument,
  getDocuments
};
