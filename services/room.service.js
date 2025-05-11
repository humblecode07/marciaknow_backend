const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { Readable } = require('stream');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');

exports.add_room = asyncHandler(async (buildingID, kioskID, files, roomData) => {
   try {
      const allowedFormats = ['image/jpeg', 'image/png'];
      // const minWidth = 1920;
      // const minHeight = 1080;
      // const maxWidth = 3840;
      // const maxHeight = 2160;

      const imageDataArray = await Promise.all(
         files.map(async (file) => {
            // Format validation
            if (!allowedFormats.includes(file.mimetype)) {
               throw new Error("Invalid file format. Only JPEG and PNG are allowed.");
            }

            console.log(file);

            // Extract metadata
            const { width, height } = await sharp(file.buffer).metadata();

            // Dimension validation
            // if (width < minWidth || height < minHeight || width > maxWidth || height > maxHeight) {
            //    throw new Error(`Image dimensions are out of range. Must be between ${minWidth}x${minHeight} and ${maxWidth}x${maxHeight}.`);
            // }

            // Generate a unique file name
            const originalFilename = file.originalname;
            const fileExtension = originalFilename.split('.').pop();
            const imageUUID = uuidv4() + '.' + fileExtension;

            // Process the image and upload to GridFS
            const processedImage = await sharp(file.buffer).toBuffer();
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

            // Return metadata for each image
            return {
               file_path: imageUUID,
               aspect_ratio: width / height,
               height: height,
               width: width,
            };
         })
      );

      const imageData = imageDataArray;

      const building = await Building.findById(buildingID);
      if (!building) throw new Error("Building not found");

      const kiosk = await Kiosk.findOne({ kioskID: kioskID });
      if (!kiosk) throw new Error("Kiosk not found");

      // Fetch existing rooms by kioskID
      let rooms = building.existingRoom.get(kioskID) || [];

      let navigationGuide = roomData.navigationGuide
         ? JSON.parse(roomData.navigationGuide)
         : [];

      navigationGuide = navigationGuide.map(guide => ({
         icon: guide.icon,
         text: guide.text
      }));

      let navigationPath = [];

      if (roomData.path) {
         try {
            navigationPath = JSON.parse(roomData.path);
         } catch (err) {
            console.error('Invalid navigation path JSON:', err);
         }
      }

      const newRoom = {
         name: roomData.name,
         description: roomData.description,
         floor: roomData.floor,
         navigationPath: navigationPath,
         navigationGuide: navigationGuide,
         image: imageData || []
      };

      // Push the new room to the existing array
      rooms.push(newRoom);
      building.existingRoom.set(kioskID, rooms);

      building.markModified('existingRoom');
      await building.save();

      return newRoom;
   }
   catch (error) {
      console.error("Error adding room:", error);
      throw error;
   }
});