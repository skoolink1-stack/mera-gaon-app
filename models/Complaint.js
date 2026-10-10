const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    userId: { type: String, default: '' },
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    mediaUrls: [{ type: String }],
    status: { type: String, default: 'Pending' }, // Pending, Progress, Resolved, Withdrawn
    supporters: { type: [String], default: [] },
    reports: { type: [String], default: [] }, // रिपोर्ट करने वाले यूज़र की ids (server.js इसे इस्तेमाल करता है)
    currentLevel: { type: Number, default: 1 }, // 1: सरपंच, 2: BDO, 3: DC
    escalationDeadline: { type: Date },
    location: {
        district: { type: String, required: true },
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

// cron और लिस्टिंग की क्वेरी तेज़ करने के लिए
complaintSchema.index({ status: 1, escalationDeadline: 1 });
complaintSchema.index({ 'location.district': 1, 'location.block': 1, 'location.village': 1, createdAt: -1 });
complaintSchema.index({ userId: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);