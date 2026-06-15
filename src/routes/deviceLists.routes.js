const express = require("express");
const { getDeviceList, getDeviceLists } = require("../controllers/deviceLists.controller");

const router = express.Router();

router.get("/", getDeviceLists);
router.get("/:id", getDeviceList);

module.exports = router;
