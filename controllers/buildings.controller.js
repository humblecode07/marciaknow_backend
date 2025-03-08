const Building = require('../models/buildings.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

exports.add_building = asyncHandler(async (req, res) => {
   const newBuilding = await Building.create({
      name: req.body.name,
      description: req.body.description,
      path: req.body.path,
      numberOfFloor: req.body.numberOfFloor,
      existingRoom: {
         
      }
   });
});