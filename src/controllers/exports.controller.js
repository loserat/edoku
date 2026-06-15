const { getExportStatus } = require("../services/exports.service");
const { success } = require("../utils/apiResponse");

// * INFO: GET /api/exports/status
function getStatus(req, res) {
  return success(res, getExportStatus(), "Exportstatus geladen");
}

module.exports = {
  getStatus
};
