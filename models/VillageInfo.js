const mongoose = require('mongoose');

const villageInfoSchema = new mongoose.Schema({
    district: { type: String, required: true },
    block: { type: String, default: '' },
    village: { type: String, required: true },
    declinedUsers: [{ type: String }]
});

villageInfoSchema.index({ district: 1, block: 1, village: 1 }, { unique: true });

module.exports = mongoose.model('VillageInfo', villageInfoSchema);