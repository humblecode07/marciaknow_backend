const NavigationIcon = require('../models/navigationIcon.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

exports.get_icons = asyncHandler(async (req, res) => {
   try {
      const icons = await NavigationIcon.find();
      res.status(200).json({
         success: true,
         message: "Icons retrieved successfully!",
         data: icons
      });
   } 
   catch (error) {
      res.status(500).json({
         success: false,
         message: 'Unexpected error: ' + error.message
      });
   }
});


exports.add_icon = asyncHandler(async (req, res) => {
   try {
      const newIcon = await NavigationIcon.create({
         icon: req.body.icon
      });

      res.status(201).json({
         success: true,
         message: "Icon added successfully!",
         data: newIcon
      });
   }
   catch (error) {
      res.status(500).json({
         success: false,
         message: 'Unexpected error: ' + error.message
      });
   }
});
