const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const imageService = require('../services/image.service');

exports.get_buildings = asyncHandler(async (req, res) => {
   try {
      const buildings = await Building.find();
      res.json(buildings);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
});

exports.get_buildings_based_from_kiosk = asyncHandler(async (req, res) => {
  const { kioskID } = req.params;

  try {
    const buildings = await Building.find({
      $or: [
        { [`existingRoom.${kioskID}`]: { $exists: true } },
        { [`navigationPath.${kioskID}`]: { $exists: true } },
        { [`navigationGuide.${kioskID}`]: { $exists: true } }
      ]
    });

    res.json(buildings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unexpected error precedented: ' + error.message });
  }
});


exports.get_building = asyncHandler(async (req, res) => {
   const { buildingID } = req.params;

   try {
      const building = await Building.findById(buildingID);
      res.json(building);
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
   }
   catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});

exports.edit_building = asyncHandler(async (req, res) => {
   const { buildingId, kioskID } = req.params;

   try {
      const building = await Building.findById(buildingId);
      if (!building) throw new Error("Building not found");

      const { name, description, path, floor } = req.body;
      const files = req.files;

      // 🔹 Basic building info
      building.name = name || building.name;
      building.description = description || building.description;
      building.numberOfFloor = floor || building.numberOfFloor;

      // 🔹 Process uploaded images
      const newImages = files?.length ? await imageService.process_images(files) : [];

      // 🔹 Handle retained image IDs
      let retainedImageIDs = [];
      if (req.body.imageIDs) {
         retainedImageIDs = Array.isArray(req.body.imageIDs)
            ? req.body.imageIDs
            : JSON.parse(req.body.imageIDs);
      }

      // 🔹 Filter out deleted images
      const imagesToDelete = building.image?.filter(img =>
         !retainedImageIDs.includes(img._id.toString())
      ) || [];

      // 🔹 Delete unused images from GridFS
      if (imagesToDelete.length > 0) {
         try {
            await imageService.delete_images(imagesToDelete);
         } catch (deleteErr) {
            console.error('Error deleting images:', deleteErr);
         }
      }

      // 🔹 Retain selected images
      const retainedImages = building.image?.filter(img =>
         retainedImageIDs.includes(img._id.toString())
      ) || [];

      // 🔹 Final update to images
      building.image = [
         ...retainedImages,
         ...newImages
      ];

      // 🔹 Update navigationGuide for this kiosk
      if (req.body.navigationGuide) {
         const guideArray = JSON.parse(req.body.navigationGuide);

         if (!Array.isArray(guideArray)) {
            throw new Error("navigationGuide should be an array");
         }

         if (!building.navigationGuide) building.navigationGuide = new Map();

         // Set the entire guide array under this kioskID
         building.navigationGuide.set(kioskID, guideArray);
      }

      // 🔹 Update navigationPath for this kiosk
      if (path) {
         const pathCoords = JSON.parse(path);
         if (!building.navigationPath) building.navigationPath = new Map();

         // Ensure pathCoords is an array
         building.navigationPath.set(kioskID, Array.isArray(pathCoords) ? pathCoords : [pathCoords]);
      }

      console.log(building);

      const updatedBuilding = await building.save();

      res.status(200).json({
         success: true,
         message: "Building updated successfully!",
         data: updatedBuilding,
      });

   } catch (error) {
      console.error("Edit building error:", error);
      res.status(400).json({
         success: false,
         message: error.message,
      });
   }
});
