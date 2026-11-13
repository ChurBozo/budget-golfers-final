// /api/users: the signed-in golfer's own account.
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireSelf = require('../middleware/requireSelf');
const validate = require('../middleware/validate');
const schemas = require('../validators/users.schemas');
const controller = require('../controllers/users.controller');

const router = express.Router();
const self = requireSelf('You can only change your own account.');

router.use(requireAuth);

router.get('/me', controller.me);
router.patch('/:userId', self, validate({ params: schemas.params, body: schemas.patch }), controller.update);
router.delete('/:userId', self, validate({ params: schemas.params }), controller.remove);
router.get('/:userId/export', self, validate({ params: schemas.params, query: schemas.exportQuery }), controller.exportData);

module.exports = router;
