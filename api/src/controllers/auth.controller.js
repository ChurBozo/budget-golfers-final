// Controllers read the request, call a service and send the response with the
// right status code. Express 5 passes errors from async functions to the
// error handler, so no try/catch is needed here.
const authService = require('../services/auth.service');
const { send } = require('../views/envelope');
const userView = require('../views/user.view');

function authBody({ token, expiresIn, user }) {
  return { token, expiresIn, user: userView.authUser(user) };
}

async function register(req, res) {
  const result = await authService.register(req.valid.body);
  res.location(`/api/users/${result.user._id}`);
  send(res, authBody(result), { status: 201 });
}

async function login(req, res) {
  send(res, authBody(await authService.login(req.valid.body)));
}

module.exports = { register, login };
