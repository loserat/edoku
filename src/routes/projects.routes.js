const express = require("express");
const { getProject, getProjects } = require("../controllers/projects.controller");

const router = express.Router();

router.get("/", getProjects);
router.get("/:id", getProject);

module.exports = router;
