const usersService = require('../services/users.service');
const { send } = require('../views/envelope');
const userView = require('../views/user.view');
const exportView = require('../views/export.view');

async function me(req, res) {
  const { user, homeCourse } = await usersService.getMe(req.userId);
  send(res, userView.me(user, homeCourse));
}

async function update(req, res) {
  const { user, homeCourse } = await usersService.update(req.userId, req.valid.body);
  send(res, userView.me(user, homeCourse));
}

async function remove(req, res) {
  await usersService.remove(req.userId);
  res.status(204).end();
}

async function exportData(req, res) {
  const data = await usersService.exportData(req.userId);
  const day = new Date().toISOString().slice(0, 10);
  if (req.valid.query.format === 'csv') {
    res.attachment(`budget-golfers-${day}.csv`);
    res.type('text/csv; charset=utf-8');
    return res.send(exportView.csv(data));
  }
  res.attachment(`budget-golfers-${day}.json`);
  return send(res, exportView.json(data));
}

module.exports = { me, update, remove, exportData };
