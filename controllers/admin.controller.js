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

exports.getAdmins = asyncHandler(async (req, res, next) => {
   try {
      const admins = await Admin.find();
      res.json(admins);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
})

exports.getAdmin = asyncHandler(async (req, res, next) => {
   const { adminID } = req.params;

   try {
      const admin = await Admin.findById(adminID);
      res.json(admin);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
})

exports.register = asyncHandler(async (req, res, next) => {
   const { full_name, email, password, contact } = req.body;

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
      contact,
      password: hashedPassword,
      profile: profileImageData ? profileImageData.filename : null,
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

exports.updateAdmin = asyncHandler(async (req, res, next) => {
   const { adminId } = req.params;
   const { full_name, email, password, contact, about_me, username } = req.body;

   console.log('Update request body:', req.body);
   console.log('Admin ID:', adminId);
   console.log('Uploaded file:', req.file);

   try {
      const existingAdmin = await Admin.findById(adminId);
      if (!existingAdmin) {
         return res.status(404).json({ message: 'Admin not found' });
      }

      if (email && email !== existingAdmin.email) {
         const emailExists = await Admin.findOne({ email, _id: { $ne: adminId } });
         if (emailExists) {
            return res.status(400).json({ message: 'Email already exists' });
         }
      }

      if (username && username !== existingAdmin.username) {
         const usernameExists = await Admin.findOne({ username, _id: { $ne: adminId } });
         if (usernameExists) {
            return res.status(400).json({ message: 'Username already exists' });
         }
      }

      const updateData = {};

      if (full_name) updateData.full_name = full_name;
      if (email) updateData.email = email;
      if (contact) updateData.contact = contact;
      if (about_me !== undefined) updateData.about_me = about_me; // Allow empty string
      if (username) updateData.username = username;

      if (password) {
         if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
         }
         const salt = await bcrypt.genSalt(10);
         updateData.password = await bcrypt.hash(password, salt);
      }

      let newProfileImageData = null;
      if (req.file) {
         try {
            newProfileImageData = await processProfileImage(req.file);
            console.log(`New profile image uploaded to GridFS with ID: ${newProfileImageData._id}`);

            if (existingAdmin.profile) {
               try {
                  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'profiles' });

                  const oldImageCursor = bucket.find({ filename: existingAdmin.profile });
                  const oldImages = await oldImageCursor.toArray();

                  if (oldImages.length > 0) {
                     await bucket.delete(oldImages[0]._id);
                     console.log('Deleted old profile image:', existingAdmin.profile);
                  }
               } catch (deleteError) {
                  console.error('Failed to delete old profile image:', deleteError.message);
               }
            }

            updateData.profile = newProfileImageData.filename;

         } catch (error) {
            console.error('Profile image processing error:', error.message);
            return res.status(400).json({ message: error.message });
         }
      }

      updateData.updated_at = Date.now();

      const updatedAdmin = await Admin.findByIdAndUpdate(
         adminId,
         { $set: updateData },
         { new: true, runValidators: true }
      ).select('-password'); 

      if (!updatedAdmin) {
         if (newProfileImageData) {
            try {
               const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'profiles' });
               await bucket.delete(newProfileImageData._id);
               console.log('Cleaned up new image due to update failure');
            } catch (cleanupError) {
               console.error('Failed to cleanup new image:', cleanupError.message);
            }
         }
         return res.status(500).json({ message: 'Failed to update admin' });
      }

      console.log('Admin updated successfully');

      return res.status(200).json({
         message: "Admin updated successfully",
         admin: updatedAdmin,
         profileUpdated: !!newProfileImageData
      });

   } catch (error) {
      if (newProfileImageData) {
         try {
            const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'profiles' });
            await bucket.delete(newProfileImageData._id);
            console.log('Cleaned up new image due to error');
         } catch (cleanupError) {
            console.error('Failed to cleanup new image:', cleanupError.message);
         }
      }

      console.error('Admin update error:', error.message);
      return res.status(500).json({ message: 'Failed to update admin account' });
   }
});

exports.updateAdminField = asyncHandler(async (req, res, next) => {
   const { adminId } = req.params;
   const { field, value } = req.body;

   console.log(`Updating field: ${field} for admin: ${adminId}`);

   const allowedFields = ['full_name', 'email', 'contact', 'about_me', 'username'];

   if (!allowedFields.includes(field)) {
      return res.status(400).json({ message: 'Invalid field specified' });
   }

   try {
      const existingAdmin = await Admin.findById(adminId);
      if (!existingAdmin) {
         return res.status(404).json({ message: 'Admin not found' });
      }

      if (field === 'email' && value !== existingAdmin.email) {
         const emailExists = await Admin.findOne({ email: value, _id: { $ne: adminId } });
         if (emailExists) {
            return res.status(400).json({ message: 'Email already exists' });
         }
      }

      if (field === 'username' && value !== existingAdmin.username) {
         const usernameExists = await Admin.findOne({ username: value, _id: { $ne: adminId } });
         if (usernameExists) {
            return res.status(400).json({ message: 'Username already exists' });
         }
      }

      const updateData = {
         [field]: value,
         updated_at: Date.now()
      };

      const updatedAdmin = await Admin.findByIdAndUpdate(
         adminId,
         { $set: updateData },
         { new: true, runValidators: true }
      ).select('-password');

      return res.status(200).json({
         message: `${field} updated successfully`,
         admin: updatedAdmin
      });

   } 
   catch (error) {
      console.error(`Error updating ${field}:`, error.message);
      return res.status(500).json({ message: `Failed to update ${field}` });
   }
});

exports.updateAdminPassword = asyncHandler(async (req, res, next) => {
   const { adminId } = req.params;
   const { currentPassword, newPassword } = req.body;

   console.log(`Password update request for admin: ${adminId}`);

   try {
      const admin = await Admin.findById(adminId);
      if (!admin) {
         return res.status(404).json({ message: 'Admin not found' });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isCurrentPasswordValid) {
         return res.status(400).json({ message: 'Current password is incorrect' });
      }

      if (!newPassword || newPassword.length < 8) {
         return res.status(400).json({ message: 'New password must be at least 8 characters long' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedNewPassword = await bcrypt.hash(newPassword, salt);

      await Admin.findByIdAndUpdate(adminId, {
         $set: {
            password: hashedNewPassword,
            updated_at: Date.now()
         }
      });

      console.log('Password updated successfully');

      return res.status(200).json({
         message: "Password updated successfully"
      });

   } 
   catch (error) {
      console.error('Password update error:', error.message);
      return res.status(500).json({ message: 'Failed to update password' });
   }
});