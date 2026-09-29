require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// OTP को थोड़ी देर याद रखने के लिए (Temporary Store)
const otpStore = {};
const cron = require('node-cron');
const Complaint = require('./models/Complaint');
const Official = require('./models/Official');
const VillageInfo = require('./models/VillageInfo');
const bcrypt = require('bcrypt');
const { sendComplaintEmail, sendAdminVerificationEmail } = require('./mailer');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({ origin: 'https://mera-gaon-app.vercel.app' }));
const path = require('path'); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 1. Cloudinary ko .env ki keys se connect karna
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- CHAT MODEL ---
const chatSchema = new mongoose.Schema({
  village: { type: String, required: true }, // Sirf isi gaon ke logon ko dikhega
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true }
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);

// 2. Multer ko batana ki file Cloudinary mein 'MeraGaon' folder mein save karni hai
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'MeraGaon',
        allowedFormats: ['jpeg', 'png', 'jpg', 'mp4', 'pdf']
    }
});

const upload = multer({ storage: storage });

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB से कनेक्शन सफल!'))
    .catch(err => console.log('❌ MongoDB कनेक्शन एरर:', err));

    // --- असली OTP भेजने की API (Fast2SMS) ---
app.post('/api/auth/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.length !== 10) return res.status(400).json({ error: "सही नंबर डालें" });

    // 4 अंकों का असली OTP बनाना
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore[phone] = otp; // OTP को मेमोरी में सेव कर लिया

    try {
        await axios.get('https://www.fast2sms.com/dev/bulkV2', {
            params: {
                authorization: process.env.FAST2SMS_API_KEY,
                variables_values: otp,
                route: 'otp',
                numbers: phone
            }
        });
        console.log(`${phone} पर OTP भेज दिया गया है।`);
        res.json({ success: true, message: "OTP भेज दिया गया है" });
    } catch (error) {
        console.error("Fast2SMS Error:", error.message);
        res.status(500).json({ success: false, error: "OTP भेजने में समस्या आई" });
    }
});
    
    // --- 1. नया यूज़र रजिस्टर करने की API ---
app.post('/api/auth/register', upload.single('idProof'), async (req, res) => {
    try {
        const { name, phone, password, role, district, block, village, otp } = req.body; // otp जोड़ा

        // OTP चेक करने का असली लॉजिक
        if (otpStore[phone] !== otp) {
            return res.status(400).json({ success: false, error: '❌ गलत OTP! कृपया सही OTP डालें।' });
        }
        delete otpStore[phone];
        const hashedPassword = await bcrypt.hash(password, 10);

        // चेक करें कि फोन नंबर पहले से रजिस्टर तो नहीं है
        const existingUser = await User.findOne({ phone });
        if(existingUser) return res.status(400).json({ success: false, error: 'यह फ़ोन नंबर पहले से रजिस्टर है!' });

        // अधिकारी है तो Verification पेंडिंग रहेगा (false)
        const isVerified = (role === 'citizen' || role === '') ? true : false;

        const newUser = new User({
            name, phone, password: hashedPassword, role: role || 'citizen',
            district, block, village,
            idProofUrl: req.file ? req.file.path : '',
            isVerified
        });

        await newUser.save();
        if (!isVerified) {
            const approveUrl = `${process.env.BACKEND_URL}/api/admin/verify-official/${newUser._id}?action=approve&secret=${process.env.ADMIN_SECRET}`;
            const rejectUrl = `${process.env.BACKEND_URL}/api/admin/verify-official/${newUser._id}?action=reject&secret=${process.env.ADMIN_SECRET}`;
            sendAdminVerificationEmail(newUser, approveUrl, rejectUrl);
        }

        res.json({ success: true, message: 'अकाउंट बन गया!', user: newUser });
    } catch (error) {
        console.error("रजिस्ट्रेशन में एरर आया:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });   // 👈 अब सिर्फ phone से ढूंढो

        if(!user) return res.status(400).json({ success: false, error: 'गलत नंबर या पासवर्ड!' });

        const isMatch = await bcrypt.compare(password, user.password);   // 👈 hash से मिलान
        if(!isMatch) return res.status(400).json({ success: false, error: 'गलत नंबर या पासवर्ड!' });
        
        if(!user.isVerified) return res.status(403).json({ success: false, error: 'आपका अधिकारी अकाउंट अभी पेंडिंग है। टीम इसे वेरीफाई कर रही है।' });

        res.json({ success: true, message: 'लॉगिन सफल!', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// शिकायत की कैटेगरी को डिपार्टमेंट से जोड़ना
const CATEGORY_TO_DEPT = {
    'पानी': 'जल (PHED)',
    'सड़क': 'सड़क (PWD)',
    'स्कूल': 'शिक्षा',
    'अन्य': 'राशन/PDS',
    'पंचायत': 'पंचायत'
};

async function findOfficialForComplaint(complaint) {
    const { district, block, village } = complaint.location;
    let filter = {};

    if (complaint.category === 'पंचायत') {
        filter = { level: 2, department: 'BDO', district, block };
    } else if (complaint.currentLevel === 1) {
        const dept = CATEGORY_TO_DEPT[complaint.category] || 'पंचायत';
        filter = { level: 1, department: dept, district, block, village };
    } else if (complaint.currentLevel === 2) {
        filter = { level: 2, department: 'BDO', district, block };
    } else {
        filter = { level: 3, department: 'DC/SDM', district };
    }

    let official = await Official.findOne(filter);

    // 👇 अगर लोकल अधिकारी नहीं मिला, तो राज्य-स्तर के fallback को ढूंढो
    if (!official) {
        const dept = CATEGORY_TO_DEPT[complaint.category] || 'पंचायत';
        official = await Official.findOne({ level: 0, department: dept });
        if (official) {
            console.log(`ℹ️ स्थानीय अधिकारी नहीं मिला (${district}/${block}/${village}) — राज्य मुख्यालय को भेजा जा रहा है`);
        }
    }

    return official;
}

app.post('/api/complaints/new', upload.array('images', 5), async (req, res) => {
    try {
        const { category, desc, isAnonymous, citizenName, district, block, village } = req.body;
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 5);

        const mediaUrls = req.files ? req.files.map(f => f.path) : [];

        const newComplaint = new Complaint({
            title: desc.length > 40 ? desc.substring(0, 40) + '...' : desc,
            category: category,
            description: desc,
            mediaUrls: mediaUrls,
            citizenName: isAnonymous === 'true' ? '👤 पहचान गुप्त रखी गई' : citizenName,
            location: { district, block, village },
            currentLevel: category === 'पंचायत' ? 2 : 1,   // 👈 यह लाइन जोड़ो
            escalationDeadline: deadline
        });

        await newComplaint.save();
        // तुरंत लेवल-1 (सरपंच) को सूचित करना
        const official = await findOfficialForComplaint(newComplaint);
        if (official) {
            console.log(`📧 नई शिकायत की मेल जाएगी: ${official.name} (${official.email})`);
            sendComplaintEmail(official, newComplaint);
        } else {
            console.log(`⚠️ इस गाँव के सरपंच की जानकारी अभी दर्ज नहीं है: ${village}`);
        }
        res.json({ success: true, message: 'शिकायत सफलतापूर्वक दर्ज हो गई!', complaint: newComplaint });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- अधिकारी जोड़ना/अपडेट करना (एडमिन पैनल से इस्तेमाल होगा) ---
app.post('/api/officials', async (req, res) => {
    try {
        const { level, department, name, email, phone, district, block, village } = req.body;

        let filter = { level, department, district };
        if (level == 1) filter.village = village;
        if (level == 2) filter.block = block;

        const official = await Official.findOneAndUpdate(
            filter,
            { level, department, name, email, phone, district, block, village, updatedAt: new Date() },
            { new: true, upsert: true }
        );

        res.json({ success: true, message: 'अधिकारी की जानकारी सेव हो गई!', official });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- सभी अधिकारी देखना (एडमिन पैनल के लिए लिस्ट) ---
app.get('/api/officials', async (req, res) => {
    try {
        const officials = await Official.find().sort({ role: 1 });
        res.json(officials);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/complaints', async (req, res) => {
    try {
        const { village, district } = req.query;   // 👈 अब गाँव के हिसाब से फ़िल्टर
        let filter = { status: { $ne: 'Withdrawn' } };
        if (village) filter['location.village'] = village;
        else if (district) filter['location.district'] = district;

        const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/complaints/:id', async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        res.json(complaint);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- 1. अधिकारी के डैशबोर्ड के लिए — उसकी जगह की शिकायतें ---
app.get('/api/officials/my-complaints', async (req, res) => {
    try {
        const { role, district, block, village } = req.query;
        let filter = { status: { $ne: 'Withdrawn' } };

        if (role === 'सरपंच') {
            filter['location.district'] = district;
            filter['location.village'] = village;
        } else if (role === 'BDO') {
            filter['location.district'] = district;
            filter['location.block'] = block;
        } else if (role === 'DC/SDM') {
            filter['location.district'] = district;
        }

        const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- 2. अधिकारी का कमिटमेंट/कमेंट देना (शिकायत लॉक हो जाएगी) ---
app.post('/api/complaints/:id/commit', async (req, res) => {
    try {
        const { days, comment, authorName, authorRole } = req.body;
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });

        const lockUntil = new Date();
        lockUntil.setDate(lockUntil.getDate() + parseInt(days));

        complaint.comments.push({
            authorName, authorRole, text: comment,
            isCommitment: true, commitmentDays: days
        });
        complaint.isLocked = true;
        complaint.lockUntil = lockUntil;
        complaint.escalationDeadline = lockUntil;
        complaint.status = 'Progress';

        await complaint.save();
        res.json({ success: true, message: `✅ ${days} दिन का कमिटमेंट दर्ज हो गया, शिकायत लॉक कर दी गई है।`, complaint });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- 3. आम कमेंट जोड़ना (नागरिक या अधिकारी दोनों के लिए) ---
app.post('/api/complaints/:id/comment', async (req, res) => {
    try {
        const { text, authorName, authorRole } = req.body;
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });

        complaint.comments.push({ authorName, authorRole, text, isCommitment: false });
        await complaint.save();
        res.json({ success: true, complaint });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- 4. नागरिक का "हाँ/नहीं" कन्फर्मेशन ---
app.post('/api/complaints/:id/confirm-resolution', async (req, res) => {
    try {
        const { resolved } = req.body; // true या false
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });

        if (resolved) {
            complaint.status = 'Resolved';
            complaint.citizenConfirmationPending = false;
            complaint.isLocked = false;
        } else {
            // झूठा कमिटमेंट निकला — तुरंत अगले लेवल पर एस्केलेट
            complaint.currentLevel = Math.min(complaint.currentLevel + 1, 3);
            complaint.citizenConfirmationPending = false;
            complaint.isLocked = false;
            const newDeadline = new Date();
            newDeadline.setDate(newDeadline.getDate() + 7);
            complaint.escalationDeadline = newDeadline;
            complaint.comments.push({
                authorName: 'सिस्टम', authorRole: 'system',
                text: `नागरिक ने बताया कि समस्या हल नहीं हुई — शिकायत लेवल ${complaint.currentLevel} पर भेजी गई।`
            });
        }

        await complaint.save();
        res.json({ success: true, message: resolved ? '✅ धन्यवाद! शिकायत हल मानी गई।' : '⚠️ अगले अधिकारी को भेज दिया गया है।' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- शिकायत वापस लेने / दबाव में एस्केलेट करने की API ---
app.post('/api/complaints/:id/withdraw', async (req, res) => {
  try {
    const { reason } = req.body; // 'completed', 'mistake', 'coerced'
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });

    // अगर पुराने डेटा में title नहीं है, तो डिफ़ॉल्ट टाइटल दे दें ताकि Validation Fail न हो
    if (!complaint.title) {
      complaint.title = complaint.text || 'शिकायत';
    }

    if (reason === 'coerced') {
      complaint.status = 'Escalated to DC (Alert)';
      complaint.currentLevel = 3;
      complaint.withdrawalReason = 'किसी के दबाव में आकर शिकायत वापस लेने की कोशिश';
    } else if (reason === 'completed') {
      complaint.status = 'Resolved';
      complaint.withdrawalReason = 'काम पूरा हो गया';
    } else if (reason === 'mistake') {
      complaint.status = 'Withdrawn';
      complaint.withdrawalReason = 'गलती से शिकायत दर्ज हुई थी';
    }

    // validateModifiedOnly: true लगाने से Mongoose सिर्फ बदले गए फ़ील्ड्स को चेक करेगा
    await complaint.save({ validateModifiedOnly: true });
    
    res.json({ success: true, message: 'आपकी शिकायत वापस ले ली गई है।' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// प्रोफाइल के लिए सभी शिकायतें (Withdrawn सहित) लाने की API
app.get('/api/my-complaints', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. ऑटोमैटिक एस्केलेशन सिस्टम (हर रात 12 बजे चलेगा)
cron.schedule('0 0 * * *', async () => {
    console.log('⏳ एस्केलेशन चेक शुरू...');
    const now = new Date();

    try {
        const lockedComplaints = await Complaint.find({
            isLocked: true,
            lockUntil: { $lte: now },
            citizenConfirmationPending: false
        });

        for (let complaint of lockedComplaints) {
            complaint.citizenConfirmationPending = true;
            await complaint.save();
            console.log(`🔔 नागरिक से पूछा जाएगा: क्या शिकायत "${complaint.title}" हल हुई? (ID: ${complaint._id})`);
        }
        // वो शिकायतें ढूंढो जिनकी डेडलाइन निकल गई है और जो हल नहीं हुई हैं
        const pendingComplaints = await Complaint.find({
            status: { $in: ['Pending', 'Progress'] },
            escalationDeadline: { $lte: now },
            currentLevel: { $lt: 3 }, // जो लेवल 3 (DC) तक नहीं पहुंची हैं
            isLocked: { $ne: true }
        });

        for (let complaint of pendingComplaints) {
            complaint.currentLevel += 1; // लेवल बढ़ाएं (सरपंच -> BDO -> DC)
            
            // नया टाइमर (अगले अधिकारी के लिए 7 दिन का समय)
            const newDeadline = new Date();
            newDeadline.setDate(newDeadline.getDate() + 7);
            complaint.escalationDeadline = newDeadline;

            await complaint.save();
            
            console.log(`⚠️ शिकायत ID ${complaint._id} को लेवल ${complaint.currentLevel} पर भेज दिया गया है।`);
            const official = await findOfficialForComplaint(complaint);
            if (official) {
                console.log(`📧 मेल जाएगी: ${official.name} (${official.email}) — गाँव: ${complaint.location.village}`);
                sendComplaintEmail(official, complaint);
            } else {
                console.log(`⚠️ चेतावनी: लेवल ${complaint.currentLevel} के लिए कोई अधिकारी assign नहीं है! (district: ${complaint.location.district})`);
            }
        }
    } catch (error) {
        console.log('❌ एस्केलेशन एरर:', error);
    }
});

// Global Error Handler (Multer/Cloudinary के एरर पकड़ने के लिए)
app.use((err, req, res, next) => {
    console.error("🔥 Server Crash Error:", err);
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
});
// --- गाँव के असली आँकड़े ---
app.get('/api/village/stats', async (req, res) => {
    try {
        const { district, village } = req.query;
        const cFilter = {};
        const uFilter = { isVerified: true };
        if (district) { cFilter['location.district'] = district; uFilter.district = district; }
        if (village)  { cFilter['location.village'] = village;   uFilter.village = village; }

        const total = await Complaint.countDocuments({ ...cFilter, status: { $ne: 'Withdrawn' } });
        const resolved = await Complaint.countDocuments({ ...cFilter, status: 'Resolved' });
        const members = await User.countDocuments(uFilter);

        res.json({ total, resolved, members });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- क्या इस यूज़र को "एडमिन बनें?" popup दिखाना है? ---
app.get('/api/village/status', async (req, res) => {
    try {
        const { district, block, village, userId } = req.query;

        const sarpanch = await Official.findOne({ level: 1, department: 'पंचायत', district, block, village });
        if (sarpanch) return res.json({ hasSarpanch: true, showPrompt: false });

        const info = await VillageInfo.findOne({ district, block, village });
        const declined = info ? info.declinedUsers.includes(userId) : false;

        res.json({ hasSarpanch: false, showPrompt: !declined });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- यूज़र ने "नहीं" कहा ---
app.post('/api/village/decline', async (req, res) => {
    try {
        const { district, block, village, userId } = req.body;
        await VillageInfo.findOneAndUpdate(
            { district, block, village },
            { $addToSet: { declinedUsers: userId } },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- सरपंच की जानकारी सेव करना ---
app.post('/api/village/sarpanch', async (req, res) => {
    try {
        const { district, block, village, name, phone, email } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'सरपंच का नाम ज़रूरी है' });
        }
        if (!phone || !/^\d{10}$/.test(phone.trim())) {
            return res.status(400).json({ success: false, error: '10 अंकों का सरपंच का फ़ोन नंबर ज़रूरी है' });
        }

        const filter = { level: 1, department: 'पंचायत', district, block, village };

        // पहले से जानकारी दर्ज है तो कोई दोबारा बदल न सके
        const existing = await Official.findOne(filter);
        if (existing) {
            return res.status(409).json({ success: false, error: 'इस गाँव के सरपंच की जानकारी पहले से दर्ज है' });
        }

        const official = await Official.create({
            ...filter, name: name.trim(), phone: phone.trim(), email: email || ''
        });
        res.json({ success: true, message: 'सरपंच की जानकारी सेव हो गई!', official });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==========================================
// 1. CHAT APIs (Gaon ki Baithak)
// ==========================================

// A. Chat mangwane ki API (Sirf specific gaon ki)
app.get('/api/chat', async (req, res) => {
  try {
    const { village } = req.query;
    if (!village) return res.status(400).json({ error: "गाँव का नाम नहीं मिला" });

    // Sirf us gaon ke aakhri 100 message load karega
    const messages = await Chat.find({ village: village })
                               .sort({ createdAt: 1 })
                               .limit(100);
    res.json(messages);
  } catch (error) {
    console.error("Chat fetch error:", error);
    res.status(500).json({ error: "चैट लोड नहीं हो पाई" });
  }
});

// B. Naya message save karne ki API
app.post('/api/chat', async (req, res) => {
  try {
    const { village, senderId, senderName, text } = req.body;
    if (!village || !text) return res.status(400).json({ error: "मैसेज खाली है" });

    const newMsg = new Chat({ village, senderId, senderName, text });
    await newMsg.save();
    
    res.json({ success: true, message: newMsg });
  } catch (error) {
    console.error("Chat save error:", error);
    res.status(500).json({ error: "मैसेज नहीं गया" });
  }
});

// ==========================================
// 2. SUPPORT API (समर्थन)
// ==========================================
app.post('/api/complaints/:id/support', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "यूज़र आईडी नहीं मिली" });

    const complaint = await Complaint.findById(id);
    if (!complaint) return res.status(404).json({ error: "शिकायत नहीं मिली" });

    if (!complaint.supporters) complaint.supporters = [];

    let isSupported = false;
    const index = complaint.supporters.indexOf(userId);

    if (index === -1) {
      // Agar pehle support nahi kiya, toh add kar do
      complaint.supporters.push(userId);
      isSupported = true;
    } else {
      // Agar pehle se support kiya hai, toh wapas le lo (Toggle)
      complaint.supporters.splice(index, 1);
      isSupported = false;
    }

    await complaint.save();
    res.json({ 
      success: true, 
      isSupported: isSupported, 
      supportCount: complaint.supporters.length 
    });
  } catch (error) {
    console.error("Support error:", error);
    res.status(500).json({ error: "समर्थन अपडेट नहीं हो पाया" });
  }
});
app.get('/api/admin/verify-official/:id', async (req, res) => {
    try {
        const { action, secret } = req.query;
        if (secret !== process.env.ADMIN_SECRET) return res.status(403).send('गलत लिंक');
        const user = await User.findById(req.params.id);
        if (!user) return res.send('यूज़र नहीं मिला');
        if (action === 'approve') {
            user.isVerified = true;
            await user.save();
            return res.send(`<h2>✅ ${user.name} को ${user.role} के तौर पर अप्रूव कर दिया गया।</h2>`);
        } else {
            await User.findByIdAndDelete(req.params.id);
            return res.send(`<h2>❌ ${user.name} का अकाउंट रिजेक्ट कर दिया गया।</h2>`);
        }
    } catch (error) { res.status(500).send('एरर: ' + error.message); }
});

// --- Razorpay Payment APIs ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.post('/api/payment/create-order', async (req, res) => {
    try {
        const options = {
            amount: 10 * 100, // ₹10 (पैसे में)
            currency: "INR",
            receipt: "receipt_" + Math.random().toString(36).substring(7)
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/payment/verify', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(sign.toString()).digest("hex");

    if (razorpay_signature === expectedSign) {
        // पेमेंट सक्सेस हो गई! (यहाँ आप यूजर के डेटाबेस में isPaid = true कर सकते हैं)
        res.json({ success: true, message: "Payment Successful" });
    } else {
        res.status(400).json({ success: false, error: "Payment Failed / Fake" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 सर्वर http://localhost:${PORT} पर लाइव है`);
});