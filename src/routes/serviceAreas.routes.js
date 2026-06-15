const express = require("express");
const { getServiceArea, getServiceAreas } = require("../controllers/serviceAreas.controller");

const router = express.Router();

router.get("/", getServiceAreas);
router.get("/:id", getServiceArea);

module.exports = router;
