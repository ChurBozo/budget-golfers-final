// /api/rounds: the golfer's rounds. Ownership is checked in the service,
// which always queries with the caller's userId.
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const schemas = require('../validators/rounds.schemas');
const controller = require('../controllers/rounds.controller');

const router = express.Router();

router.use(requireAuth);

router
  .route('/')
  .get(validate({ query: schemas.list }), controller.list)
  .post(validate({ body: schemas.create }), controller.create);

router
  .route('/:roundId')
  .get(validate({ params: schemas.params }), controller.getOne)
  .patch(validate({ params: schemas.params, body: schemas.patch }), controller.update)
  .delete(validate({ params: schemas.params }), controller.remove);

module.exports = router;
