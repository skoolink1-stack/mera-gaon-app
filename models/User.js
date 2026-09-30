const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true }, // एक नंबर से एक ही अकाउंट
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'citizen' }, // नागरिक, सरपंच, BDO, DC/SDM
    district: String,
    block: String,
    village: String,
    idProofUrl: String, // आधार/आईडी की फोटो
    isVerified: { type: Boolean, default: true }, // नागरिक = true, अधिकारी = false (जब तक एडमिन अप्रूव न करे)
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);