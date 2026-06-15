const { deviceLists } = require("../data/demoStore");
const { normalizeId } = require("../utils/id");

// * INFO: Liefert Demo-Geraetelisten fuer Frontend- oder Integrationsprototypen.
function listDeviceLists() {
  return deviceLists;
}

function getDeviceListById(id) {
  return deviceLists.find((list) => list.id === normalizeId(id)) || null;
}

module.exports = {
  getDeviceListById,
  listDeviceLists
};
