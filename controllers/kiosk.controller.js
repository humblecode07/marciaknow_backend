const Kiosk = require('../models/kiosk.model');
const Building = require('../models/building.model');
const mongoose = require("mongoose");
const asyncHandler = require('express-async-handler');
const kiosk_service = require('../services/kiosk.service');

exports.get_kiosks = asyncHandler(async (req, res) => {
   try {
      const kiosks = await Kiosk.find();
      res.json(kiosks);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
})

exports.get_kiosk = asyncHandler(async (req, res) => {
   const { kioskID } = req.params;

   console.log(kioskID);

   try {
      const kiosk = await Kiosk.findOne({ kioskID }).exec();

      if (!kiosk) return res.status(404).json({ message: "Kiosk not found." });

      res.json(kiosk);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
})

exports.add_kiosk = asyncHandler(async (req, res) => {
   try {
      const newKiosk = await Kiosk.create({
         kioskID: kiosk_service.generateKioskId(),
         name: req.body.name,
         location: req.body.location,
         coordinates: {
            x: req.body.coordinates.x,
            y: req.body.coordinates.y
         },
      });

      const buildings = await Building.find();

      for (const building of buildings) {
         // Use proper Map methods for setting values
         // Initialize with an empty array since your schema expects an array of roomSchema
         building.existingRoom.set(newKiosk.kioskID, []);

         // For navigationPath, set an empty object that conforms to navigationPathSchema
         building.navigationPath.set(newKiosk.kioskID, {});

         // For navigationGuide, set an empty object that conforms to navigationGuideSchema
         building.navigationGuide.set(newKiosk.kioskID, {});

         await building.save();
      }

      res.status(201).json({
         success: true,
         message: "Kiosk added successfully!",
         data: newKiosk
      });
   }
   catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});