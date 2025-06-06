const express = require('express');
const feedbackController = require('../controllers/feedback.controller'); // Adjust path as needed
const router = express.Router();
const upload = require('../middleware/imageUpload'); // Assuming you want to handle file uploads for attachments

// const { authenticateToken, verifyNotDisabled } = require('../middleware/auth');

/* GET requests */

// Get all feedback entries (consider adding pagination and filtering for large datasets)
router.get('/', feedbackController.getAllFeedback);

// Get a specific feedback entry by ID
router.get('/:feedbackId', feedbackController.getFeedbackById);

/* POST requests */

// Submit new feedback (publicly accessible, no authentication needed usually for submitting)
// If you want to allow attachments, include your upload middleware here
router.post('/submit', upload.array('attachments', 5), feedbackController.submitFeedback); // Allow up to 5 attachments

/* PATCH requests */

// Update specific fields of a feedback entry (e.g., status, priority, admin notes)
// This would typically require authentication for admin users
// router.patch('/:feedbackId/status', authenticateToken, verifyNotDisabled, feedbackController.updateFeedbackStatus);
router.patch('/:feedbackId', feedbackController.updateFeedback); // More general update

/* DELETE requests */

// Delete a feedback entry (requires admin privileges)
// router.delete('/:feedbackId', authenticateToken, verifyNotDisabled, feedbackController.deleteFeedback);

module.exports = router;