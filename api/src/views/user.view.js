// JSON shapes for users. Only these fields ever leave the server, so
// passwordHash, role, devices and __v are never exposed.
function preferences(user) {
  const p = user.preferences || {};
  return {
    units: p.units || 'metric',
    theme: p.theme || 'light',
    showOnLeaderboard: p.showOnLeaderboard !== false,
  };
}

// Inside POST /api/auth/login and /register.
function authUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    preferences: preferences(user),
  };
}

// GET /api/users/me and PATCH /api/users/:userId.
function me(user, homeCourse) {
  const id = String(user._id);
  return {
    id,
    email: user.email,
    displayName: user.displayName,
    homeCourse: homeCourse ? { id: String(homeCourse._id), name: homeCourse.name } : null,
    handicapEstimate: user.statsSnapshot?.handicapEstimate ?? null,
    preferences: preferences(user),
    createdAt: user.createdAt,
    links: {
      self: `/api/users/${id}`,
      rounds: '/api/rounds',
      stats: `/api/stats/${id}`,
      clubs: `/api/clubs/${id}`,
    },
  };
}

module.exports = { authUser, me, preferences };
