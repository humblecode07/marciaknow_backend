const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const room_service = require('../services/room.service');

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