const { exportStatus } = require("../data/demoStore");

// * INFO: Demo-Exportstatus fuer API-Checks, ohne echte PDF-Erzeugung auszufuehren.
function getExportStatus() {
  return {
    ...exportStatus,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  getExportStatus
};
