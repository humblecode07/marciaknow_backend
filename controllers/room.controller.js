const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const room_service = require('../services/room.service');

exports.get_all_rooms = asyncHandler(async (req, res) => {
   try {
      const buildings = await Building.find().lean(); // Using lean() to get plain JS objects
      let allRooms = [];

      buildings.forEach(building => {
         const existingRoom = building.existingRoom;

         // Check if existingRoom exists and is an object
         if (existingRoom && typeof existingRoom === 'object') {
            // Get all kiosk IDs
            const kioskIDs = Object.keys(existingRoom);

            kioskIDs.forEach(kioskID => {
               const roomsForKiosk = existingRoom[kioskID];

               // Check if roomsForKiosk is an array
               if (Array.isArray(roomsForKiosk)) {
                  roomsForKiosk.forEach(room => {
                     allRooms.push({
                        ...room,
                        kioskID,
                        buildingID: building._id,
                        buildingName: building.name
                     });
                  });
               }
            });
         }
      });

      res.json(allRooms);
   }
   catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ message: 'Unexpected error: ' + error.message });
   }
});

exports.get_room_from_building = asyncHandler(async (req, res) => {
   try {
      const { buildingID, roomID } = req.params;

      const building = await Building.findById(buildingID).lean();

      if (!building) {
         return res.status(404).json({ message: 'Building not found' });
      }

      let foundRoom = null;
      const roomsByKiosk = building.existingRoom;

      for (const [kioskID, roomList] of Object.entries(roomsByKiosk || {})) {
         const room = roomList.find(r => r._id?.toString() === roomID);
         if (room) {
            foundRoom = {
               ...room,
               kioskID,
               buildingID: building._id,
               buildingName: building.name
            };
            break;
         }
      }

      if (!foundRoom) {
         return res.status(404).json({ message: 'Room not found in this building' });
      }

      res.json(foundRoom);
   }
   catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ message: 'Unexpected error: ' + error.message });
   }
});

exports.add_room = asyncHandler(async (req, res) => {
   try {
      const { buildingID, kioskID } = req.params;
      const files = req.files;

      const room = await room_service.add_room(buildingID, kioskID, files, req.body);

      return res.status(201).json({
         success: true,
         message: "Room added successfully",
         data: room
      });
   }
   catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});