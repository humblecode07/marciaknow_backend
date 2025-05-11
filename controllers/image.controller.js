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

exports.add_images = asyncHandler(async (req, res) => {
   const { buildingID, type, roomID } = req.params; // Get ID and type (building/room) from the request parameters
   const files = req.files; // Get the array of files from the request

   // Define allowed formats
   const allowedFormats = ['image/jpeg', 'image/png'];

   if (!files || files.length === 0) {
      throw new Error("No files uploaded.");
   }

   // Loop through each file and validate its format
   for (const file of files) {
      if (!allowedFormats.includes(file.mimetype)) {
         throw new Error("Invalid file format. Only JPEG and PNG are allowed.");
      }

      // Process each image
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
         const building = await Building.findById(buildingID);
         if (!building) throw new Error("Building not found");

         // Process image for building
         const imageData = {
            file_path: imageUUID,
            aspect_ratio: width / height,
            height: height,
            width: width,
         };

         // Add image to the building
         building.image.push(imageData);
         await building.save();

         return res.status(201).json({
            success: true,
            message: "Image uploaded successfully to building!",
            data: imageData
         });
      }

      // If you're posting to a room
      else if (type === "room" && roomID) {
         const building = await Building.findById(buildingID);
         if (!building) throw new Error("Building not found");

         // Logic to find room in building
         let roomFound = false;
         let targetKioskID = null;
         let targetRoomIndex = null;

         for (const [kioskID, rooms] of building.existingRoom.entries()) {
            for (let i = 0; i < rooms.length; i++) {
               if (rooms[i]._id.toString() === roomID) {
                  targetKioskID = kioskID;
                  targetRoomIndex = i;
                  roomFound = true;
                  break;
               }
            }
            if (roomFound) break;
         }

         if (!roomFound) throw new Error("Room not found");

         const rooms = building.existingRoom.get(targetKioskID);

         // Add the image to the room
         if (!rooms[targetRoomIndex].image) {
            rooms[targetRoomIndex].image = [];
         }
         rooms[targetRoomIndex].image.push(imageData);

         // Update the rooms in the building
         building.existingRoom.set(targetKioskID, rooms);

         await building.save();

         return res.status(201).json({
            success: true,
            message: "Image uploaded successfully to room!",
            data: imageData
         });
      }
      else {
         throw new Error("Invalid type specified. Must be 'building' or 'room'.");
      }
   }
});
