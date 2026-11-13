// The "view" of a REST API is its JSON. Every success response uses the same
// envelope: { success: true, data, meta?, links? } (A2 section 6.3).
function send(res, data, { status = 200, meta, links } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  if (links) body.links = links;
  return res.status(status).json(body);
}

module.exports = { send };
