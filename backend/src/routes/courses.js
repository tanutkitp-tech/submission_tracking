const router = require('express').Router();
const controller = require('../controllers/courses-controller');
const { requireAuth } = require('../middleware/auth');

router.get('/', controller.list);
router.get('/mine', requireAuth, controller.listMine);
router.get('/:id', controller.get);
router.post('/', requireAuth, controller.create);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);

module.exports = router;
