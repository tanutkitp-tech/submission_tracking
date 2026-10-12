const router = require('express').Router();
const controller = require('../controllers/auth-controller');
const { requireAuth, requireStudentAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rate-limit');
const rateLimitStore = require('../services/rate-limit-store');
const studentAuthController = require('../controllers/student-auth-controller');

function accountKey(field, normalize = (value) => value.toLowerCase()) {
  return (req, clientIp) => {
    const identifier = typeof req.body?.[field] === 'string' ? normalize(req.body[field].trim()) : '';
    return `${clientIp}\0${identifier || 'missing-account'}`;
  };
}

const teacherLoginLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, scope: 'teacher-login', store: rateLimitStore, keyGenerator: accountKey('email') });
const teacherRegistrationLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, scope: 'teacher-register', store: rateLimitStore, keyGenerator: accountKey('email') });
const studentLoginLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, scope: 'student-login', store: rateLimitStore, keyGenerator: accountKey('student_code', (value) => value.toUpperCase()) });
const studentRegistrationLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, scope: 'student-register', store: rateLimitStore, keyGenerator: accountKey('student_code', (value) => value.toUpperCase()) });

router.post('/login', teacherLoginLimit, controller.login);
router.post('/register', teacherRegistrationLimit, controller.register);
router.get('/me', requireAuth, controller.me);
router.patch('/password', requireAuth, controller.changePassword);
router.post('/student/register', studentRegistrationLimit, studentAuthController.register);
router.post('/student/login', studentLoginLimit, studentAuthController.login);
router.get('/student/me', requireStudentAuth, studentAuthController.me);
router.patch('/student/password', requireStudentAuth, studentAuthController.changePassword);

module.exports = router;
