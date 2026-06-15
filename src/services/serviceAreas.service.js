const { serviceAreas } = require("../data/demoStore");
const { normalizeId } = require("../utils/id");

// * INFO: Liefert Demo-Leistungsbereiche ohne Zugriff auf produktive Projektdateien.
function listServiceAreas() {
  return serviceAreas;
}

function getServiceAreaById(id) {
  return serviceAreas.find((area) => area.id === normalizeId(id)) || null;
}

module.exports = {
  getServiceAreaById,
  listServiceAreas
};
