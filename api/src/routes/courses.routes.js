// /api/courses: the golfer's self-named courses (read only; courses are
// created when a round is uploaded with a new course name).
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { courses } = require('../validators/other.schemas');
const controller = require('../controllers/courses.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', validate({ query: courses.list }), controller.list);
router.get('/:courseId', validate({ params: courses.params }), controller.getOne);

module.exports = router;
