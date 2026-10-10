const router = require('express').Router();
const controller = require('../controllers/student-controller');
const { requireStudentAuth } = require('../middleware/auth');
const receiveSubmission = require('../middleware/submission-upload');

router.use(requireStudentAuth);
router.get('/courses', controller.courses);
router.post('/enrollments', controller.enroll);
router.get('/assignments', controller.assignments);
router.get('/assignments/:id', controller.assignment);
router.post('/assignments/:id/submission', receiveSubmission, controller.submitAssignment);

module.exports = router;
