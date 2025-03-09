const multer = require('multer');

const upload = multer({
   storage: multer.memoryStorage(),
   limits: {
       fileSize: 1024 * 1024 * 5 // 5 MB
   },
   fileFilter: function (req, file, cb) {
       if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
           cb(null, true);
       } else {
           cb(new Error('Only JPEG and PNG files are allowed'));
       }
   }
});

module.exports = upload;