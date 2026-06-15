const { getServiceAreaById, listServiceAreas } = require("../services/serviceAreas.service");
const { failure, success } = require("../utils/apiResponse");

// * INFO: GET /api/service-areas
function getServiceAreas(req, res) {
  return success(res, listServiceAreas(), "Leistungsbereiche geladen");
}

// * INFO: GET /api/service-areas/:id
function getServiceArea(req, res) {
  const serviceArea = getServiceAreaById(req.params.id);
  if (!serviceArea) return failure(res, "Leistungsbereich nicht gefunden", "SERVICE_AREA_NOT_FOUND", 404);
  return success(res, serviceArea, "Leistungsbereich geladen");
}

module.exports = {
  getServiceArea,
  getServiceAreas
};
