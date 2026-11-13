const roundsService = require('../services/rounds.service');
const { send } = require('../views/envelope');
const roundView = require('../views/round.view');
const { pageLinks, totalPages } = require('../views/pagination');

async function list(req, res) {
  const q = req.valid.query;
  const { items, total, bests } = await roundsService.list(req.userId, q);
  const pages = totalPages(total, q.limit);
  send(
    res,
    items.map((r) => roundView.summary(r, { isPersonalBest: bests.has(String(r._id)) })),
    {
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: pages,
        filters: { from: q.from ?? null, to: q.to ?? null, courseId: q.courseId ?? null, holes: q.holes ?? null },
        sort: q.sort,
      },
      links: pageLinks('/api/rounds', q, q.page, pages),
    },
  );
}

async function getOne(req, res) {
  const round = await roundsService.getOwned(req.userId, req.valid.params.roundId);
  send(res, roundView.detail(round));
}

// The app can say which phone uploaded the round (users.devices).
function deviceFrom(req, body) {
  const deviceId = req.get('x-device-id');
  if (!deviceId || body.source !== 'mobile-app') return null;
  const platform = (req.get('x-device-platform') || 'android').toLowerCase();
  return {
    deviceId: deviceId.slice(0, 64),
    platform: ['android', 'ios', 'web'].includes(platform) ? platform : 'other',
  };
}

async function create(req, res) {
  const body = req.valid.body;
  const { round, duplicate } = await roundsService.create(req.userId, body, deviceFrom(req, body));
  res.location(`/api/rounds/${round._id}`);
  // 201 for a new round; 200 when the app re-sent one already saved.
  send(res, roundView.created(round, duplicate), { status: duplicate ? 200 : 201 });
}

async function update(req, res) {
  const round = await roundsService.update(req.userId, req.valid.params.roundId, req.valid.body);
  send(res, roundView.detail(round));
}

async function remove(req, res) {
  await roundsService.remove(req.userId, req.valid.params.roundId);
  res.status(204).end();
}

module.exports = { list, getOne, create, update, remove };
