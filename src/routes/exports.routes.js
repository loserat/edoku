const express = require("express");
const { getStatus } = require("../controllers/exports.controller");

const router = express.Router();

router.get("/status", getStatus);

module.exports = router;
