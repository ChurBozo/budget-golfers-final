// Distances between GPS points, and converting between the API's { lat, lng }
// and MongoDB's GeoJSON { type: "Point", coordinates: [lng, lat] }.
const EARTH_RADIUS_M = 6371008.8;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Great-circle (haversine) distance in metres.
function distanceMetres(a, b) {
  if (!a || !b) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toPoint(latLng) {
  if (!latLng) return undefined;
  return { type: 'Point', coordinates: [latLng.lng, latLng.lat] };
}

function fromPoint(point) {
  if (!point || !Array.isArray(point.coordinates)) return undefined;
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

// Moves a point a distance (m) along a compass bearing (degrees). Used by the
// seed data generator to lay out realistic shots.
function offset(from, metres, bearingDeg) {
  const d = metres / EARTH_RADIUS_M;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

module.exports = { distanceMetres, toPoint, fromPoint, offset };
