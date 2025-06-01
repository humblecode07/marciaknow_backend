const Kiosk = require('../models/kiosk.model');
const Building = require('../models/building.model');
const mongoose = require("mongoose");
const asyncHandler = require('express-async-handler');
const kiosk_service = require('../services/kiosk.service');
const systemLogService = require('../services/systemLog.service');

const extractAdminId = (req) => {
   return req.user?.id || req.adminId;
};

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
         const existingKioskIDs = Array.from(building.existingRoom.keys());
         let inheritedRooms = [];

         if (existingKioskIDs.length > 0) {
            const refRooms = building.existingRoom.get(existingKioskIDs[0]) || [];
            inheritedRooms = refRooms.map(room => ({
               name: room.name,
               description: room.description,
               floor: room.floor,
               image: room.image || []
            }));
         }

         building.existingRoom.set(newKiosk.kioskID, inheritedRooms);
         building.navigationPath.set(newKiosk.kioskID, {});
         building.navigationGuide.set(newKiosk.kioskID, {});

         await building.save();
      }

      const adminId = extractAdminId(req);

      if (adminId) {
         systemLogService.logKioskActivity(adminId, newKiosk, 'create');
      }

      res.status(201).json({
         success: true,
         message: "Kiosk added successfully and room data inherited.",
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


exports.edit_kiosk = asyncHandler(async (req, res) => {
   const { kioskID } = req.params;

   try {
      const kiosk = await Kiosk.findOne({ kioskID });

      if (!kiosk) return res.status(404).json({ message: "Kiosk not found." });

      const changes = {};

      if (req.body.name && req.body.name !== kiosk.name) {
         changes.name = { old: kiosk.name, new: req.body.name };
         kiosk.name = req.body.name;
      }
      if (req.body.location && req.body.location !== kiosk.location) {
         changes.location = { old: kiosk.location, new: req.body.location };
         kiosk.location = req.body.location;
      }
      if (req.body.coordinates) {
         const coords = {};
         if (req.body.coordinates.x && req.body.coordinates.x !== kiosk.coordinates.x) {
            coords.x = { old: kiosk.coordinates.x, new: req.body.coordinates.x };
            kiosk.coordinates.x = req.body.coordinates.x;
         }
         if (req.body.coordinates.y && req.body.coordinates.y !== kiosk.coordinates.y) {
            coords.y = { old: kiosk.coordinates.y, new: req.body.coordinates.y };
            kiosk.coordinates.y = req.body.coordinates.y;
         }
         if (Object.keys(coords).length > 0) {
            changes.coordinates = coords;
         }
      }

      await kiosk.save();

      const adminId = extractAdminId(req);

      if (adminId) {
         systemLogService.logKioskActivity(adminId, kiosk, 'edit', Object.keys(changes).length > 0 ? changes : null);
      }

      res.status(200).json({
         success: true,
         message: "Kiosk updated successfully!",
         data: kiosk
      });
   } catch (error) {
      res.status(400).json({
         success: false,
         message: "Error updating kiosk: " + error.message
      });
   }
});


exports.delete_kiosk = asyncHandler(async (req, res) => {
   const { kioskID } = req.params;

   try {
      const deletedKiosk = await Kiosk.findOneAndDelete({ kioskID });

      if (!deletedKiosk) {
         return res.status(404).json({ success: false, message: "Kiosk not found." });
      }

      // Step 2: Remove the kioskID from each building
      const buildings = await Building.find();

      for (const building of buildings) {
         building.existingRoom.delete(kioskID);

         building.navigationPath.delete(kioskID);

         building.navigationGuide.delete(kioskID);

         await building.save();
      }

      const adminId = extractAdminId(req);
      if (adminId) {
         systemLogService.logKioskActivity(adminId, deletedKiosk, 'delete');
      }

      res.status(200).json({
         success: true,
         message: "Kiosk deleted successfully!"
      });
   }
   catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});

exports.ping_kiosk = asyncHandler(async (req, res) => {
   try {
      const kiosk = await Kiosk.findOneAndUpdate(
         { kioskID: req.params.kioskID },
         {
            $set: {
               lastCheckIn: new Date(),
               status: 'online'
            }
         },
         { new: true }
      );

      if (!kiosk) {
         return res.status(404).json({ success: false, message: 'Kiosk not found' });
      }

      res.json({ success: true, message: 'Ping successful', kiosk });
   } catch (error) {
      res.status(500).json({ success: false, message: error.message });
   }
})