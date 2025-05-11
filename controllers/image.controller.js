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
