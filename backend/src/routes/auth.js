const router = require('express').Router();
const controller = require('../controllers/auth-controller');
const { requireAuth, requireStudentAuth } = require('../middleware/auth');
const studentAuthController = require('../controllers/student-auth-controller');

router.post('/login', controller.login);
router.get('/me', requireAuth, controller.me);
router.patch('/password', requireAuth, controller.changePassword);
router.post('/student/register', studentAuthController.register);
router.post('/student/login', studentAuthController.login);
router.get('/student/me', requireStudentAuth, studentAuthController.me);
router.patch('/student/password', requireStudentAuth, studentAuthController.changePassword);

module.exports = router;
