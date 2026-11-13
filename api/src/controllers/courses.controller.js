const coursesService = require('../services/courses.service');
const { send } = require('../views/envelope');
const courseView = require('../views/course.view');
const { pageLinks, totalPages } = require('../views/pagination');

async function list(req, res) {
  const q = req.valid.query;
  const { items, total } = await coursesService.list(req.userId, q);
  const pages = totalPages(total, q.limit);
  send(res, items.map(courseView.listItem), {
    meta: { total, search: q.search ?? null, region: q.region ?? null, page: q.page, limit: q.limit, totalPages: pages },
    links: pageLinks('/api/courses', q, q.page, pages),
  });
}

async function getOne(req, res) {
  const course = await coursesService.getOwned(req.userId, req.valid.params.courseId);
  send(res, courseView.detail(course));
}

module.exports = { list, getOne };
