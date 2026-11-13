// /api/clubs/:userId: the golfer's bag and club distances, owner only.
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireSelf = require('../middleware/requireSelf');
const validate = require('../middleware/validate');
const { clubs } = require('../validators/other.schemas');
const controller = require('../controllers/clubs.controller');

const router = express.Router();

router.use(requireAuth);

router
  .route('/:userId')
  .all(requireSelf('You can only view or change your own clubs.'))
  .get(validate({ params: clubs.params }), controller.getBag)
  .put(validate({ params: clubs.params, body: clubs.put }), controller.replaceBag);

module.exports = router;
