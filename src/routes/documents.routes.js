const express = require("express");
const { getDocument, getDocuments } = require("../controllers/documents.controller");

const router = express.Router();

router.get("/", getDocuments);
router.get("/:id", getDocument);

module.exports = router;
