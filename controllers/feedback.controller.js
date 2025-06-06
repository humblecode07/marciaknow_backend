const Feedback = require('../models/feedback.model');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');

let gfs;
mongoose.connection.once('open', () => {
   gfs = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
   });
});

exports.submitFeedback = asyncHandler(async (req, res) => {
   const {
      message,
      category,
      kioskLocation,
      pageSection,
      userEmail,
      userPhone
   } = req.body;

   if (!message || !category) {
      res.status(400);
      throw new Error('Message and category are required fields.');
   }

   const validCategories = ['Bug', 'Suggestion', 'Complaint', 'Praise'];
   if (!validCategories.includes(category)) {
      res.status(400);
      throw new Error('Invalid category. Must be one of: Bug, Suggestion, Complaint, Praise');
   }

   console.log(req.body.attachmentMetadata);

   let attachments = [];
   if (req.files && req.files.length > 0) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);

      let attachmentMetadata = [];
      if (req.body.attachmentMetadata) {
         try {
            attachmentMetadata = JSON.parse(req.body.attachmentMetadata);
         } catch (error) {
            console.warn('Failed to parse attachment metadata:', error);
         }
      }

      for (let i = 0; i < req.files.length; i++) {
         const file = req.files[i];
         const meta = attachmentMetadata[i] || {};

         const { width, height } = await sharp(file.buffer).metadata();
         const aspectRatio = width / height;

         const fileExtension = file.originalname.split('.').pop();
         const uniqueName = uuidv4() + '.' + fileExtension;
         const processedImage = await sharp(file.buffer).toBuffer();
         const readBufferStream = Readable.from(processedImage);
         const uploadStream = bucket.openUploadStream(uniqueName);

         await new Promise((resolve, reject) => {
            readBufferStream.pipe(uploadStream);
            uploadStream.on('error', reject);
            uploadStream.on('finish', resolve);
         });

         attachments.push({
            _id: uploadStream.id,
            file_path: uniqueName,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            width,
            height,
            aspect_ratio: aspectRatio
         });
      }
   }


   // Capture request metadata
   const ipAddress = req.ip || req.connection.remoteAddress;
   const userAgent = req.headers['user-agent'];
   const sessionId = req.sessionID || req.session?.id || null;

   try {
      const feedback = await Feedback.create({
         message,
         category,
         kioskLocation,
         pageSection,
         userEmail,
         userPhone,
         attachments,
         ipAddress,
         userAgent,
         sessionId,
         status: 'New',
         priority: 'Medium'
      });

      res.status(201).json({
         success: true,
         message: 'Feedback submitted successfully!',
         data: {
            id: feedback._id,
            message: feedback.message,
            category: feedback.category,
            status: feedback.status,
            createdAt: feedback.createdAt
         }
      });
   } catch (error) {
      res.status(500);
      throw new Error('Failed to submit feedback: ' + error.message);
   }
});

exports.getAllFeedback = asyncHandler(async (req, res) => {
   try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Build filter object
      const filter = {};
      if (req.query.category) filter.category = req.query.category;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.priority) filter.priority = req.query.priority;
      if (req.query.kioskLocation) filter.kioskLocation = new RegExp(req.query.kioskLocation, 'i');

      // Date range filtering
      if (req.query.startDate || req.query.endDate) {
         filter.createdAt = {};
         if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
         if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
      }

      const totalCount = await Feedback.countDocuments(filter);
      const feedback = await Feedback.find(filter)
         .populate('assignedTo', 'name email')
         .sort({ createdAt: -1 })
         .skip(skip)
         .limit(limit);

      res.status(200).json({
         success: true,
         data: feedback,
         pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
         }
      });
   } catch (error) {
      res.status(500);
      throw new Error('Failed to retrieve feedback: ' + error.message);
   }
});

exports.getFeedbackStats = asyncHandler(async (req, res) => {
   try {
      const stats = await Feedback.aggregate([
         {
            $group: {
               _id: null,
               totalFeedback: { $sum: 1 },
               byCategory: {
                  $push: {
                     category: '$category',
                     count: 1
                  }
               },
               byStatus: {
                  $push: {
                     status: '$status',
                     count: 1
                  }
               },
               byPriority: {
                  $push: {
                     priority: '$priority',
                     count: 1
                  }
               }
            }
         }
      ]);

      // Get category breakdown
      const categoryStats = await Feedback.aggregate([
         { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      // Get status breakdown
      const statusStats = await Feedback.aggregate([
         { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Get priority breakdown
      const priorityStats = await Feedback.aggregate([
         { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]);

      res.status(200).json({
         success: true,
         data: {
            total: stats[0]?.totalFeedback || 0,
            byCategory: categoryStats,
            byStatus: statusStats,
            byPriority: priorityStats
         }
      });
   } catch (error) {
      res.status(500);
      throw new Error('Failed to retrieve feedback statistics: ' + error.message);
   }
});

exports.getFeedbackById = asyncHandler(async (req, res) => {
   try {
      const feedback = await Feedback.findById(req.params.feedbackId)
         .populate('assignedTo', 'name email role');

      if (!feedback) {
         res.status(404);
         throw new Error('Feedback not found.');
      }

      res.status(200).json({
         success: true,
         data: feedback
      });
   } catch (error) {
      if (error instanceof mongoose.CastError && error.path === '_id') {
         res.status(400);
         throw new Error('Invalid Feedback ID format.');
      }
      res.status(500);
      throw new Error('Failed to retrieve feedback: ' + error.message);
   }
});

exports.updateFeedback = asyncHandler(async (req, res) => {
   const { feedbackId } = req.params;
   const allowedUpdates = [
      'status',
      'priority',
      'assignedTo',
      'adminNotes',
      'message',
      'category',
      'kioskLocation',
      'pageSection',
      'userEmail',
      'userPhone'
   ];

   try {
      const feedback = await Feedback.findById(feedbackId);
      if (!feedback) {
         res.status(404);
         throw new Error('Feedback not found.');
      }

      // Validate enum values if they're being updated
      if (req.body.status && !['New', 'Reviewed', 'In Progress', 'Resolved'].includes(req.body.status)) {
         res.status(400);
         throw new Error('Invalid status value.');
      }

      if (req.body.priority && !['Low', 'Medium', 'High', 'Critical'].includes(req.body.priority)) {
         res.status(400);
         throw new Error('Invalid priority value.');
      }

      if (req.body.category && !['Bug', 'Suggestion', 'Complaint', 'Praise'].includes(req.body.category)) {
         res.status(400);
         throw new Error('Invalid category value.');
      }

      // Validate assignedTo is a valid ObjectId if provided
      if (req.body.assignedTo && !mongoose.Types.ObjectId.isValid(req.body.assignedTo)) {
         res.status(400);
         throw new Error('Invalid assignedTo user ID.');
      }

      // Update only allowed fields
      const updates = Object.keys(req.body)
         .filter(key => allowedUpdates.includes(key))
         .reduce((obj, key) => {
            obj[key] = req.body[key];
            return obj;
         }, {});

      const updatedFeedback = await Feedback.findByIdAndUpdate(
         feedbackId,
         updates,
         { new: true, runValidators: true }
      ).populate('assignedTo', 'name email');

      res.status(200).json({
         success: true,
         message: 'Feedback updated successfully!',
         data: updatedFeedback
      });
   } catch (error) {
      if (error instanceof mongoose.CastError && error.path === '_id') {
         res.status(400);
         throw new Error('Invalid Feedback ID format.');
      }
      res.status(500);
      throw new Error('Failed to update feedback: ' + error.message);
   }
});

/**
 * @desc Delete a feedback entry
 * @route DELETE /api/feedback/:feedbackId
 * @access Private (Admin)
 */
exports.deleteFeedback = asyncHandler(async (req, res) => {
   try {
      const feedback = await Feedback.findById(req.params.feedbackId);
      if (!feedback) {
         res.status(404);
         throw new Error('Feedback not found.');
      }

      // Delete associated attachments from GridFS if they exist
      if (feedback.attachments && feedback.attachments.length > 0) {
         for (const attachment of feedback.attachments) {
            try {
               if (mongoose.Types.ObjectId.isValid(attachment.path)) {
                  await gfs.delete(new mongoose.Types.ObjectId(attachment.path));
               }
            } catch (attachmentError) {
               console.error('Error deleting attachment from GridFS:', attachmentError);
               // Continue with deletion even if attachment cleanup fails
            }
         }
      }

      await Feedback.findByIdAndDelete(req.params.feedbackId);

      res.status(200).json({
         success: true,
         message: 'Feedback deleted successfully!'
      });
   } catch (error) {
      if (error instanceof mongoose.CastError && error.path === '_id') {
         res.status(400);
         throw new Error('Invalid Feedback ID format.');
      }
      res.status(500);
      throw new Error('Failed to delete feedback: ' + error.message);
   }
});

/**
 * @desc Bulk update feedback status
 * @route PATCH /api/feedback/bulk-update
 * @access Private (Admin)
 */
exports.bulkUpdateFeedback = asyncHandler(async (req, res) => {
   const { feedbackIds, updates } = req.body;

   if (!feedbackIds || !Array.isArray(feedbackIds) || feedbackIds.length === 0) {
      res.status(400);
      throw new Error('Please provide an array of feedback IDs.');
   }

   if (!updates || Object.keys(updates).length === 0) {
      res.status(400);
      throw new Error('Please provide updates to apply.');
   }

   // Validate all IDs are valid ObjectIds
   const invalidIds = feedbackIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
   if (invalidIds.length > 0) {
      res.status(400);
      throw new Error(`Invalid feedback IDs: ${invalidIds.join(', ')}`);
   }

   try {
      const result = await Feedback.updateMany(
         { _id: { $in: feedbackIds } },
         updates,
         { runValidators: true }
      );

      res.status(200).json({
         success: true,
         message: `${result.modifiedCount} feedback entries updated successfully!`,
         data: {
            matched: result.matchedCount,
            modified: result.modifiedCount
         }
      });
   } catch (error) {
      res.status(500);
      throw new Error('Failed to bulk update feedback: ' + error.message);
   }
});