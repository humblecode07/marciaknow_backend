const Building = require('../models/building.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

exports.add_building = asyncHandler(async (req, res) => {
   try {
      const newBuilding = await Building.create({
         name: req.body.name,
         description: req.body.description,
         path: req.body.path,
         numberOfFloor: req.body.numberOfFloor,
         existingRoom: req.body.existingRoom || {}, // Ensure existingRoom is initialized
         navigationPath: req.body.navigationPath || {}, // Ensure navigationPath is initialized
         navigationGuide: req.body.navigationGuide || {}, // Ensure navigationGuide is initialized
      });

      res.status(201).json({
         success: true,
         message: "Building added successfully!",
         data: newBuilding
      });
   } catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});