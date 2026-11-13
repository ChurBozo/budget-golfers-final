// A GeoJSON point: { type: "Point", coordinates: [lng, lat] }.
// MongoDB stores longitude first; the API body uses { lat, lng } instead.
const { Schema } = require('mongoose');

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
      default: undefined,
      required: true,
      validate: {
        validator: (c) =>
          Array.isArray(c) && c.length === 2 && c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90,
        message: 'must be [longitude, latitude]',
      },
    },
  },
  { _id: false },
);

module.exports = pointSchema;
