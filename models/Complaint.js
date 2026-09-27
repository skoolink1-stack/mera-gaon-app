const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    mediaUrls: [{ type: String }],
    status: { type: String, default: 'Pending' }, // Pending, Progress, Resolved, Withdrawn
    currentLevel: { type: Number, default: 1 }, // 1: सरपंच, 2: BDO, 3: DC
    escalationDeadline: { type: Date },
    location: {
        district: { type: String, default: 'हिसार' },
        block: String,
        village: String
    },
    citizenName: { type: String, default: 'जागरूक नागरिक' },
    citizenPhone: { type: String },
    withdrawalReason: { type: String },

    // --- कमिटमेंट / लॉक सिस्टम ---
    comments: [{
        authorName: String,
        authorRole: String,   // 'citizen', 'सरपंच', 'BDO', 'DC/SDM', 'system'
        text: String,
        isCommitment: { type: Boolean, default: false },
        commitmentDays: Number,
        createdAt: { type: Date, default: Date.now }
    }],
    isLocked: { type: Boolean, default: false },
    lockUntil: { type: Date },
    citizenConfirmationPending: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);