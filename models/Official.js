const mongoose = require('mongoose');

const officialSchema = new mongoose.Schema({
    // level 1 = गाँव/ब्लॉक स्तर का विभाग (PHED/PWD/बिजली/सरपंच)
    // level 2 = BDO (सामान्य एस्केलेशन)
    // level 3 = DC/SDM (अंतिम एस्केलेशन)
    level: { type: Number, required: true, enum: [0, 1, 2, 3] },
    department: { 
        type: String, 
        required: true, 
        enum: ['पंचायत', 'जल (PHED)', 'सड़क (PWD)', 'बिजली', 'शिक्षा', 'राशन/PDS', 'BDO', 'DC/SDM']
    },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    district: { type: String, required: true },
    block: { type: String },
    village: { type: String },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Official', officialSchema);