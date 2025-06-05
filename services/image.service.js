const Building = require('../models/building.model');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { Readable } = require('stream');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const { GridFSBucket } = require('mongodb');

const getBucket = () => {
   const db = mongoose.connection.db;
   if (!db) throw new Error("Database connection not yet established");

   return new GridFSBucket(db, { bucketName: 'fs' });
};

exports.process_images = asyncHandler(async (files) => {
   const allowedFormats = ['image/jpeg', 'image/png'];
   const results = [];

   if (!files || files.length === 0) {
      throw new Error("No files uploaded.");
   }

   for (const file of files) {
      if (!allowedFormats.includes(file.mimetype)) {
         throw new Error("Invalid file format. Only JPEG and PNG are allowed.");
      }

      const { width, height } = await sharp(file.buffer).metadata();

      const minWidth = 1280;
      const minHeight = 720;
      const maxWidth = 3840;
      const maxHeight = 2160;

      if (
         width < minWidth || height < minHeight ||
         width > maxWidth || height > maxHeight
      ) {
         throw new Error("Image dimensions are out of allowed range.");
      }

      // Allow approximate 16:9 aspect ratio within a 2% margin
      const aspectRatio = width / height;
      const targetRatio = 16 / 9;
      const tolerance = 0.02; // 2% margin

      if (
         aspectRatio < targetRatio * (1 - tolerance) ||
         aspectRatio > targetRatio * (1 + tolerance)
      ) {
         throw new Error("Image must be approximately 16:9 aspect ratio.");
      }

      const fileExtension = file.originalname.split('.').pop();
      const imageUUID = uuidv4() + '.' + fileExtension;
      const processedImage = await sharp(file.buffer).toBuffer();

      const readBufferStream = Readable.from(processedImage);
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
      const uploadStream = bucket.openUploadStream(imageUUID);

      await new Promise((resolve, reject) => {
         readBufferStream.pipe(uploadStream);
         uploadStream.on('error', reject);
         uploadStream.on('finish', resolve);
      });

      const fileId = uploadStream.id;

      const imageData = {
         _id: fileId,
         file_path: imageUUID,
         aspect_ratio: aspectRatio,
         height,
         width,
      };

      console.log(`Uploaded image to GridFS with ID: ${fileId}`);
      results.push(imageData);
   }

   return results;
});


exports.delete_images = async (imageIdsToDelete) => {
   if (!imageIdsToDelete || !Array.isArray(imageIdsToDelete) || imageIdsToDelete.length === 0) return;

   const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);

   console.log(`Attempting to delete ${imageIdsToDelete.length} images from GridFS`);

   // Find images by file name instead of ID
   for (const image of imageIdsToDelete) {
      try {
         // First, try to find the file by its file_path (filename)
         const files = await bucket.find({ filename: image.file_path }).toArray();

         if (files.length === 0) {
            console.log(`No file found with filename: ${image.file_path}`);
            continue;
         }

         // Delete each matching file
         for (const file of files) {
            await bucket.delete(file._id);
            console.log(`Successfully deleted image with filename: ${image.file_path} (ID: ${file._id})`);
         }
      } catch (error) {
         console.error(`Failed to delete image: ${image.file_path}`, error.message);
      }
   }
};