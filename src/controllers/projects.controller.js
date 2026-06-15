const { getProjectById, listProjects } = require("../services/projects.service");
const { failure, success } = require("../utils/apiResponse");

// * INFO: GET /api/projects
function getProjects(req, res) {
  return success(res, listProjects(), "Projekte geladen");
}

// * INFO: GET /api/projects/:id
function getProject(req, res) {
  const project = getProjectById(req.params.id);
  if (!project) return failure(res, "Projekt nicht gefunden", "PROJECT_NOT_FOUND", 404);
  return success(res, project, "Projekt geladen");
}

module.exports = {
  getProject,
  getProjects
};
