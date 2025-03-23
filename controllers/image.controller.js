const Building = require('../models/building.model');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { Readable } = require('stream');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');

exports.get_image = asyncHandler(async (req, res) => {
   const { filename } = req.params;
   const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);

   const downloadStream = bucket.openDownloadStreamByName(filename);

   downloadStream.on('error', (error) => {
      console.error('Error downloading file:', error);
      res.status(404).send("Image not found");
   });

   downloadStream.on('file', (file) => {
      res.setHeader('Content-Type', file.contentType || 'image/jpeg');
   });

   downloadStream.pipe(res);
});

exports.add_image = asyncHandler(async (req, res) => {
   const { id, type } = req.params; // Get ID and type (building/room) from the request parameters
   const file = req.file;

   if (!file) throw new Error("No image provided");

   const allowedFormats = ['image/jpeg', 'image/png'];
   if (!allowedFormats.includes(file.mimetype)) {
      throw new Error("Invalid file format. Only JPEG and PNG are allowed.");
   }

   console.log(req.body.kioskID);

   // Process the image first
   const { width, height } = await sharp(file.buffer).metadata();
   const minWidth = 1920;
   const minHeight = 1080;
   const maxWidth = 3840;
   const maxHeight = 2160;

   if ((width < minWidth || height < minHeight || width > maxWidth || height > maxHeight)) {
      throw new Error(`Image dimensions are out of range. Must be between ${minWidth}x${minHeight} and ${maxWidth}x${maxHeight}.`);
   }

   const originalFilename = file.originalname;
   const fileExtension = originalFilename.split('.').pop();
   const imageUUID = uuidv4() + '.' + fileExtension;

   const processedImage = await sharp(file.buffer).toBuffer(); // Process the image

   const readBufferStream = Readable.from(processedImage);
   const uploadStream = new mongoose.mongo.GridFSBucket(mongoose.connection.db).openUploadStream(imageUUID);

   await new Promise((resolve, reject) => {
      readBufferStream.pipe(uploadStream);
      uploadStream.on('error', (error) => {
         console.error('Error uploading file:', error);
         reject(new Error("Failed to upload file"));
      });
      uploadStream.on('finish', resolve);
   });

   console.log('Processed image uploaded successfully');

   // Create image data once
   const imageData = {
      file_path: imageUUID,
      aspect_ratio: width / height,
      height: height,
      width: width,
   };

   // Check whether to add the image to a building or a room
   if (type === "building") {
      const entity = await Building.findById(id);
      if (!entity) throw new Error("Building not found");

      // Add image to building
      entity.image.push(imageData);
      await entity.save();

      res.status(201).json({
         success: true,
         message: "Image uploaded successfully to building!",
         data: imageData
      });
   }
   else if (type === "room") {
      const building = await Building.findOne();

      if (!building) throw new Error("No buildings found");

      let roomFound = false;
      let targetKioskID = null;
      let targetRoomIndex = null;

      for (const [kioskID, rooms] of building.existingRoom.entries()) {
         for (let i = 0; i < rooms.length; i++) {
            if (rooms[i]._id.toString() === id) {
               targetKioskID = kioskID;
               targetRoomIndex = i;
               roomFound = true;
               break;
            }
         }
         if (roomFound) break;
      }

      if (!roomFound) throw new Error("Room not found");

      // Get the rooms array for the kiosk
      const rooms = building.existingRoom.get(targetKioskID);

      // Add the image to the specific room
      if (!rooms[targetRoomIndex].image) {
         rooms[targetRoomIndex].image = [];
      }
      rooms[targetRoomIndex].image.push(imageData);

      // Update the Map in the building
      building.existingRoom.set(targetKioskID, rooms);

      // Save the building document
      await building.save();

      res.status(201).json({
         success: true,
         message: "Image uploaded successfully to room!",
         data: imageData
      });
   }
   else {
      throw new Error("Invalid type specified. Must be 'building' or 'room'.");
   }
});