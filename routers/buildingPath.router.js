const express = require("express");
const router = express.Router();
const buildingPathController = require("../controllers/buildingPath.controller");

router.post("/", buildingPathController.createBuildingPath);

module.exports = router;
