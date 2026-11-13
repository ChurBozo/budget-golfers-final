const clubsService = require('../services/clubs.service');
const { send } = require('../views/envelope');
const clubView = require('../views/club.view');

async function getBag(req, res) {
  const [doc, units] = await Promise.all([clubsService.getOrCreate(req.userId), clubsService.unitsOf(req.userId)]);
  send(res, clubView.bag(doc, units));
}

async function replaceBag(req, res) {
  const [doc, units] = await Promise.all([
    clubsService.replace(req.userId, req.valid.body.clubs),
    clubsService.unitsOf(req.userId),
  ]);
  send(res, clubView.bag(doc, units));
}

module.exports = { getBag, replaceBag };
