const { projects } = require("../data/demoStore");
const { normalizeId } = require("../utils/id");

// * INFO: Liefert neutrale Demo-Projekte fuer die API.
function listProjects() {
  return projects;
}

// * INFO: Sucht ein Demo-Projekt per stabiler ID.
function getProjectById(id) {
  return projects.find((project) => project.id === normalizeId(id)) || null;
}

module.exports = {
  getProjectById,
  listProjects
};
