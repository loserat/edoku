const { getDeviceListById, listDeviceLists } = require("../services/deviceLists.service");
const { failure, success } = require("../utils/apiResponse");

// * INFO: GET /api/device-lists
function getDeviceLists(req, res) {
  return success(res, listDeviceLists(), "Geraetelisten geladen");
}

// * INFO: GET /api/device-lists/:id
function getDeviceList(req, res) {
  const deviceList = getDeviceListById(req.params.id);
  if (!deviceList) return failure(res, "Geraeteliste nicht gefunden", "DEVICE_LIST_NOT_FOUND", 404);
  return success(res, deviceList, "Geraeteliste geladen");
}

module.exports = {
  getDeviceList,
  getDeviceLists
};
