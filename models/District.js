const mongoose = require('mongoose');

const districtSchema = new mongoose.Schema({
  districtId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true }
});

module.exports = mongoose.model('District', districtSchema);