const Building = require('../models/building.model');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { Readable } = require('stream');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');

exports.process_images = asyncHandler(async (files) => {
   const allowedFormats = ['image/jpeg', 'image/png'];
   const results = [];

   console.log(files);

   if (!files || files.length === 0) {
      throw new Error("No files uploaded.");
   }

   for (const file of files) {
      if (!allowedFormats.includes(file.mimetype)) {
         throw new Error("Invalid file format. Only JPEG and PNG are allowed.");
      }

      const { width, height } = await sharp(file.buffer).metadata();
      const minWidth = 1920;
      const minHeight = 1080;
      const maxWidth = 3840;
      const maxHeight = 2160;

      if (width < minWidth || height < minHeight || width > maxWidth || height > maxHeight) {
         throw new Error(`Image dimensions are out of range.`);
      }

      const fileExtension = file.originalname.split('.').pop();
      const imageUUID = uuidv4() + '.' + fileExtension;
      const processedImage = await sharp(file.buffer).toBuffer();

      const readBufferStream = Readable.from(processedImage);
      const uploadStream = new mongoose.mongo.GridFSBucket(mongoose.connection.db)
         .openUploadStream(imageUUID);

      await new Promise((resolve, reject) => {
         readBufferStream.pipe(uploadStream);
         uploadStream.on('error', reject);
         uploadStream.on('finish', resolve);
      });

      const imageData = {
         file_path: imageUUID,
         aspect_ratio: width / height,
         height,
         width,
      };

      results.push(imageData);
   }

   return results;
});
