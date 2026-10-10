const multer = require('multer');
const HttpError = require('../utils/http-error');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

function receiveSubmission(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (error) return next(error);
    if (!req.file) return next(new HttpError(400, 'Choose a file to submit'));
    next();
  });
}

module.exports = receiveSubmission;
