const Admin = require('../models/admin.model');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const sharp = require('sharp');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { GridFSBucket } = require('mongodb');

const processProfileImage = asyncHandler(async (file) => {
   const allowedFormats = ['image/jpeg', 'image/png'];

   if (!allowedFormats.includes(file.mimetype)) {
      throw new Error("Invalid file format. Only JPEG and PNG are allowed for profile pictures.");
   }

   const { width, height } = await sharp(file.buffer).metadata();

   const minDimension = 100;
   const maxDimension = 2048;

   if (width < minDimension || height < minDimension || width > maxDimension || height > maxDimension) {
      throw new Error(`Profile picture dimensions must be between ${minDimension}x${minDimension} and ${maxDimension}x${maxDimension} pixels.`);
   }

   const fileExtension = file.originalname.split('.').pop();
   const imageUUID = `profile_${uuidv4()}.${fileExtension}`;

   const processedImage = await sharp(file.buffer)
      .resize(500, 500, {
         fit: 'cover',
         position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer();

   const readBufferStream = Readable.from(processedImage);
   const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'profiles' });
   const uploadStream = bucket.openUploadStream(imageUUID, {
      metadata: {
         type: 'profile_picture',
         originalName: file.originalname,
         uploadDate: new Date()
      }
   });

   await new Promise((resolve, reject) => {
      readBufferStream.pipe(uploadStream);
      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
   });

   return {
      _id: uploadStream.id,
      filename: imageUUID,
      originalName: file.originalname,
      size: processedImage.length
   };
});

exports.register = asyncHandler(async (req, res, next) => {
   const { full_name, email, password } = req.body;

   console.log('Request body:', req.body);
   console.log('Uploaded file:', req.file);
   console.log('All files:', req.files);
   console.log('Content-Type:', req.headers['content-type']);

   if (!req.file) {
      console.log('❌ No file received in req.file');
      console.log('Available fields in req:', Object.keys(req));
   } else {
      console.log('✅ File received:', {
         fieldname: req.file.fieldname,
         originalname: req.file.originalname,
         mimetype: req.file.mimetype,
         size: req.file.size
      });
   }

   const existingAdmin = await Admin.findOne({ email });
   if (existingAdmin) {
      return res.status(400).json({ message: 'E-mail already exists' });
   }

   if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
   }

   const salt = await bcrypt.genSalt(10);
   const hashedPassword = await bcrypt.hash(password, salt);

   let profileImageData = null;
   if (req.file) {
      try {
         profileImageData = await processProfileImage(req.file);
         console.log(`Profile image uploaded to GridFS with ID: ${profileImageData._id}`);
      } catch (error) {
         console.error('Profile image processing error:', error.message);
         return res.status(400).json({ message: error.message });
      }
   }

   const admin = new Admin({
      _id: new mongoose.Types.ObjectId(),
      full_name,
      email,
      password: hashedPassword,
      profile: profileImageData ? profileImageData.filename : null, // Just store the filename as string
      joined: Date.now(),
      status: 'offline',
      roles: [Number(process.env.ROLE_ADMIN) || 2]
   });

   try {
      await admin.save();
      console.log('Admin created successfully with profile:', profileImageData ? 'Yes' : 'No');

      return res.status(201).json({
         message: "Admin created successfully",
         profileUploaded: !!profileImageData
      });
   } catch (error) {
      if (profileImageData) {
         try {
            const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'profiles' });
            await bucket.delete(profileImageData._id);
            console.log('Cleaned up uploaded image due to admin creation failure');
         } catch (cleanupError) {
            console.error('Failed to cleanup uploaded image:', cleanupError.message);
         }
      }

      console.error('Admin creation error:', error.message);
      return res.status(500).json({ message: 'Failed to create admin account' });
   }
});

exports.getProfileImage = asyncHandler(async (req, res) => {
   const { filename } = req.params;

   try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'profiles' });
      const downloadStream = bucket.openDownloadStreamByName(filename);

      downloadStream.on('error', (error) => {
         console.error('Profile image download error:', error.message);
         return res.status(404).json({ message: 'Profile image not found' });
      });

      res.set('Content-Type', 'image/jpeg');
      downloadStream.pipe(res);
   } catch (error) {
      console.error('Profile image retrieval error:', error.message);
      return res.status(500).json({ message: 'Failed to retrieve profile image' });
   }
});