const BuildingPath = require("../models/buildingPath.model");
const asyncHandler = require('express-async-handler');

exports.createBuildingPath = asyncHandler(async (req, res) => {
   try {
      const { path } = req.body;

      if (!path) {
         return res.status(400).json({ error: "Path is required." });
      }

      const newPath = new BuildingPath({ path });
      await newPath.save();

      res.status(201).json(newPath);
   } catch (err) {
      console.error("Error creating building path:", err);
      res.status(500).json({ error: "Server error." });
   }
});
