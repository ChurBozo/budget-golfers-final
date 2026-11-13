// The default route. Anything no router matched ends here and gets an HTTP
// 404 with the standard JSON error body, never Express's HTML page.
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      status: 404,
      code: 'NOT_FOUND',
      message: `There is no ${req.method} ${req.path} in the Budget Golfers API.`,
      requestId: req.id,
    },
  });
}

module.exports = notFound;
