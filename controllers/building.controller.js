const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

exports.get_buildings = asyncHandler(async (req, res) => {
   try {
      const buildings = await Building.find(); 
      res.json(buildings);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
});

exports.add_building = asyncHandler(async (req, res) => {
   const kiosk = await Kiosk.findOne({ kioskID: req.body.kioskID });
   if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

   try {
      const navigationPath = {
         [req.body.kioskID]: {
            path: req.body.navigationPath || ""
         }
      };

      const navigationGuide = {
         [req.body.kioskID]: req.body.navigationGuide || []
      };

      const newBuilding = await Building.create({
         name: req.body.name,
         description: req.body.description,
         path: req.body.path,
         numberOfFloor: req.body.numberOfFloor,
         existingRoom: req.body.existingRoom || {}, 
         navigationPath: navigationPath, 
         navigationGuide: navigationGuide 
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


exports.edit_building = asyncHandler(async (req, res) => {
   const { buildingId } = req.params;
   try {
     const building = await Building.findById(buildingId);
     if (!building) throw new Error("Building not found");
     
     // Update building fields
     building.name = req.body.name || building.name;
     building.description = req.body.description || building.description;
     building.path = req.body.path || building.path;
     building.numberOfFloor = req.body.numberOfFloor || building.numberOfFloor;
     
     // Update nested objects if provided in the request
     if (req.body.existingRoom) {
       building.existingRoom = req.body.existingRoom;
     }
     
     if (req.body.navigationPath) {
       building.navigationPath = req.body.navigationPath;
     }
     
     if (req.body.navigationGuide) {
       building.navigationGuide = req.body.navigationGuide;
     }
     
     // Save the updated building
     const updatedBuilding = await building.save();
     
     res.status(200).json({
       success: true,
       message: "Building updated successfully!",
       data: updatedBuilding
     });
   } catch (error) {
     res.status(400).json({
       success: false,
       message: error.message
     });
   }
 });