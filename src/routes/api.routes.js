const express = require("express");
const packageInfo = require("../../package.json");
const projectsRouter = require("./projects.routes");
const serviceAreasRouter = require("./serviceAreas.routes");
const deviceListsRouter = require("./deviceLists.routes");
const documentsRouter = require("./documents.routes");
const exportsRouter = require("./exports.routes");
const errorHandler = require("../middleware/errorHandler");
const notFoundHandler = require("../middleware/notFoundHandler");
const { success } = require("../utils/apiResponse");

const router = express.Router();

// * INFO: Oeffentlicher Healthcheck fuer Deployment- und Monitoring-Tests.
router.get("/health", (req, res) => success(res, {
  app: "eDoku",
  version: packageInfo.version || "0.0.0",
  status: "ok",
  mode: "demo",
  database: "demoStore",
  timestamp: new Date().toISOString()
}, "Backend erreichbar"));

router.use("/projects", projectsRouter);
router.use("/service-areas", serviceAreasRouter);
router.use("/device-lists", deviceListsRouter);
router.use("/documents", documentsRouter);
router.use("/exports", exportsRouter);

router.use(notFoundHandler);
router.use(errorHandler);

module.exports = router;
