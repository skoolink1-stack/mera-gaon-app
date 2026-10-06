require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const Razorpay = require('razorpay');
const crypto = require('crypto');


const cron = require('node-cron');
const Complaint = require('./models/Complaint');
const Official = require('./models/Official');
const VillageInfo = require('./models/VillageInfo');
const bcrypt = require('bcrypt');
const { sendComplaintEmail, sendAdminVerificationEmail, sendOtpEmail, sendSubReminderEmail } = require('./mailer');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(require('helmet')({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.urlencoded({ extended: false }));
app.set('trust proxy', 1);

app.get('/health', (req, res) => res.send('ok'));
app.use(cors({ origin: ['https://mera-gaon-app.vercel.app', 'http://localhost:5500', 'http://127.0.0.1:5500'] }));
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'बहुत ज़्यादा कोशिशें हुईं, 15 मिनट बाद दोबारा आएँ' }
});
app.use(['/api/auth/login', '/api/auth/send-otp', '/api/auth/register', '/api/payment/create-order'], authLimiter);
const jwt = require('jsonwebtoken');

const LEVEL_OF_ROLE = { 'सरपंच': 1, 'BDO': 2, 'DC/SDM': 3 };

function makeToken(user) {
    return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

async function userFromReq(req) {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    try {
        const d = jwt.verify(h.slice(7), process.env.JWT_SECRET);
        const u = await User.findById(d.id);
        return (u && u.isVerified) ? u : null;
    } catch (e) { return null; }
}

const Payment = require('./models/Payment');
const GRACE_DAYS = 2;
const DAY_MS = 86400000;
const PLANS = {
    monthly: { amount: 2000, label: '1 महीना' },   // ₹20 = 2000 paise
    yearly:  { amount: 22000, label: '1 साल' }      // ₹220 = 22000 paise
};

function addPlan(from, plan) {
    const d = new Date(from);
    if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d;
}

function subInfo(u) {
    if (u.role !== 'citizen') return { status: 'exempt' };
    if (!u.subEnd) return { status: 'expired', daysLeft: 0, subEnd: null };
    const now = Date.now(), end = new Date(u.subEnd).getTime();
    if (now <= end) {
        const daysLeft = Math.ceil((end - now) / DAY_MS);
        return { status: daysLeft <= 2 ? 'soon' : 'active', daysLeft, subEnd: u.subEnd };
    }
    const graceEnd = end + GRACE_DAYS * DAY_MS;
    if (now <= graceEnd) return { status: 'grace', daysLeft: Math.ceil((graceEnd - now) / DAY_MS), subEnd: u.subEnd };
    return { status: 'expired', daysLeft: 0, subEnd: u.subEnd };
}

// ज़्यादातर routes: फीस खत्म तो 402
async function auth(req, res, next) {
    const u = await userFromReq(req);
    if (!u) return res.status(401).json({ success: false, error: 'कृपया दोबारा लॉगिन करें' });
    const s = subInfo(u);
    if (s.status === 'expired') return res.status(402).json({ success: false, code: 'SUB_EXPIRED', error: 'ऐप फीस जमा करें' });
    req.user = u;
    req.sub = s;
    next();
}

// सिर्फ़ लॉगिन चाहिए, फीस की जाँच नहीं (payment, profile, account delete के लिए)
async function authAny(req, res, next) {
    const u = await userFromReq(req);
    if (!u) return res.status(401).json({ success: false, error: 'कृपया दोबारा लॉगिन करें' });
    req.user = u;
    next();
}

async function optionalAuth(req, res, next) {
    req.user = await userFromReq(req);
    next();
}

function officialOnly(req, res, next) {
    if (!LEVEL_OF_ROLE[req.user.role]) return res.status(403).json({ success: false, error: 'यह सिर्फ अधिकारियों के लिए है' });
    next();
}

function adminOnly(req, res, next) {
    if (!process.env.ADMIN_SECRET || req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: 'अनुमति नहीं है' });
    }
    next();
}

// क्या यह user इस शिकायत के इलाके का है?
function inJurisdiction(user, c) {
    const loc = c.location || {};
    if (user.role === 'सरपंच') return loc.district === user.district && loc.block === user.block && loc.village === user.village;
    if (user.role === 'BDO') return loc.district === user.district && loc.block === user.block;
    if (user.role === 'DC/SDM') return loc.district === user.district;
    return loc.district === user.district && loc.block === user.block && loc.village === user.village; // नागरिक
}

// क्या यह अधिकारी अभी इस शिकायत पर action ले सकता है?
function canAct(user, c) {
    return LEVEL_OF_ROLE[user.role] === c.currentLevel
        && inJurisdiction(user, c)
        && !['Resolved', 'Withdrawn'].includes(c.status);
}

// पब्लिक को भेजने से पहले private चीज़ें हटाना
function publicView(c, userId) {
    const o = c.toObject ? c.toObject() : { ...c };
    const uid = userId ? String(userId) : null;
    const sup = (o.supporters || []).map(String);
    o.isMine = !!(uid && o.userId && String(o.userId) === uid);
    o.supportCount = sup.length;
    o.isSupported = !!(uid && sup.includes(uid));
    delete o.userId;
    delete o.supporters;
    delete o.reports;
    return o;
}
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
  district: { type: String, default: '' },
  block: { type: String, default: '' },
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
        resource_type: 'auto',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp', 'mp4', 'mov', 'pdf']
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 25 * 1024 * 1024 } });

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB से कनेक्शन सफल!'))
    .catch(err => console.log('❌ MongoDB कनेक्शन एरर:', err));

    
global.otpStore = global.otpStore || {};

app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, error: "सही ईमेल डालें" });
        }

        const existing = global.otpStore[email];
        if (existing && Date.now() - existing.sentAt < 60 * 1000) {
            return res.status(429).json({ success: false, error: "कृपया 1 मिनट बाद दोबारा कोशिश करें" });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        global.otpStore[email] = { otp, sentAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000 };

        const sent = await sendOtpEmail(email, otp);
        if (!sent) {
            delete global.otpStore[email];
            return res.status(502).json({ success: false, error: "OTP मेल नहीं भेजी जा सकी, कुछ देर बाद कोशिश करें" });
        }

        res.json({ success: true, message: "OTP भेज दिया गया है" });
    } catch (error) {
        console.error("OTP एरर:", error.message);
        res.status(500).json({ success: false, error: "सर्वर एरर" });
    }
});
    
    // --- 1. नया यूज़र रजिस्टर करने की API ---
app.post('/api/auth/register', upload.single('idProof'), async (req, res) => {
    try {
        const { name, phone, password, role, district, block, village, email, otp } = req.body;
                if (!name || !name.trim() || !district || !block || !village) {
            return res.status(400).json({ success: false, error: 'सभी जानकारी भरें' });
        }
        if (!/^\d{10}$/.test(phone || '')) {
            return res.status(400).json({ success: false, error: 'सही 10 अंकों का फ़ोन नंबर डालें' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, error: 'पासवर्ड कम से कम 6 अक्षर का हो' });
        }
        if (['सरपंच', 'BDO', 'DC/SDM'].includes(role) && !req.file) {
            return res.status(400).json({ success: false, error: 'अधिकारी के लिए ID प्रूफ ज़रूरी है' });
        }
        if (!['', 'citizen', 'सरपंच', 'BDO', 'DC/SDM'].includes(role || '')) {
            return res.status(400).json({ success: false, error: 'गलत पद' });
        }

        const record = global.otpStore && global.otpStore[email];
        if (!record || record.otp !== otp || Date.now() > record.expiresAt) {
            return res.status(400).json({ success: false, error: '❌ गलत या expire OTP! दोबारा OTP भेजें।' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        // चेक करें कि फोन नंबर पहले से रजिस्टर तो नहीं है
        const existingUser = await User.findOne({ phone });
        if(existingUser) return res.status(400).json({ success: false, error: 'यह फ़ोन नंबर पहले से रजिस्टर है!' });

        // अधिकारी है तो Verification पेंडिंग रहेगा (false)
        const isVerified = (role === 'citizen' || role === '') ? true : false;
        const isCitizen = (role === 'citizen' || !role);
        let paid = null;
        if (isCitizen) {
            try {
                const d = jwt.verify(req.body.payToken || '', process.env.JWT_SECRET);
                if (d.kind === 'pay') {
                    paid = await Payment.findOneAndUpdate({ _id: d.pid, status: 'paid', claimed: false }, { claimed: true }, { returnDocument: 'after' });
                }
            } catch (e) {}
            if (!paid) return res.status(402).json({ success: false, error: 'पहले ऐप फीस जमा करें' });
            req._claimedId = paid._id;
        }

        const newUser = new User({
            name, phone, email, password: hashedPassword, role: role || 'citizen',
            district, block, village,
            idProofUrl: req.file ? req.file.path : '',
            isVerified, subEnd: paid ? addPlan(new Date(), paid.plan) : undefined,
        });

        await newUser.save();
        if (paid) await Payment.updateOne({ _id: paid._id }, { userId: String(newUser._id) });
        if (!isVerified) {
            const approveUrl = `${process.env.BACKEND_URL}/api/admin/verify-official/${newUser._id}?action=approve&secret=${process.env.ADMIN_SECRET}`;
            const rejectUrl = `${process.env.BACKEND_URL}/api/admin/verify-official/${newUser._id}?action=reject&secret=${process.env.ADMIN_SECRET}`;
            sendAdminVerificationEmail(newUser, approveUrl, rejectUrl);
        }

        const safeUser = newUser.toObject();
        delete safeUser.password;
        res.json({ success: true, message: 'अकाउंट बन गया!', sub: subInfo(newUser),user: safeUser, token: isVerified ? makeToken(newUser) : undefined });
    } catch (error) {
        console.error("रजिस्ट्रेशन में एरर आया:", error);
        if (req._claimedId) await Payment.updateOne({ _id: req._claimedId }, { claimed: false }).catch(() => {});
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/auth/me', authAny, (req, res) => {
    const u = req.user.toObject();
    delete u.password;
    res.json({ success: true, user: u, sub: subInfo(req.user) });
});
app.put('/api/auth/me', auth, async (req, res) => {
    try {
        const name = (req.body.name || '').trim().slice(0, 60);
        if (name.length < 2) return res.status(400).json({ success: false, error: 'सही नाम लिखें' });
        req.user.name = name;
        await req.user.save({ validateModifiedOnly: true });
        res.json({ success: true, name });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/auth/me', authAny, async (req, res) => {
    try {
        const id = String(req.user._id);
        await Chat.deleteMany({ senderId: id });
        await Complaint.updateMany({ userId: id }, { $set: { userId: '', citizenName: 'हटाया गया खाता' } });
        await Complaint.updateMany({ supporters: id }, { $pull: { supporters: id } });
        if (req.user.role !== 'citizen') await Official.deleteMany({ phone: req.user.phone, email: req.user.email });
        await User.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });   // 👈 अब सिर्फ phone से ढूंढो

        if(!user) return res.status(400).json({ success: false, error: 'गलत नंबर या पासवर्ड!' });

        const isMatch = await bcrypt.compare(password, user.password);   // 👈 hash से मिलान
        if(!isMatch) return res.status(400).json({ success: false, error: 'गलत नंबर या पासवर्ड!' });
        
        if(!user.isVerified) return res.status(403).json({ success: false, error: 'आपका अधिकारी अकाउंट अभी पेंडिंग है। टीम इसे वेरीफाई कर रही है।' });

        const safeUser = user.toObject();
        delete safeUser.password;
        res.json({ success: true, message: 'लॉगिन सफल!', user: safeUser, token: makeToken(user), sub: subInfo(user) });
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
    let filter;
    if (complaint.category === 'पंचायत' && complaint.currentLevel < 2) {
        filter = { level: 2, department: 'BDO', district, block };
    } else if (complaint.currentLevel === 1) {
        filter = { level: 1, department: 'पंचायत', district, block, village };
    } else if (complaint.currentLevel === 2) {
        filter = { level: 2, department: 'BDO', district, block };
    } else {
        filter = { level: 3, department: 'DC/SDM', district };
    }
    let official = await Official.findOne(filter);
    if (!official && filter.level === 2) {
        official = await Official.findOne({ level: 3, department: 'DC/SDM', district });
    }
    if (!official || !official.email) {
        const dept = CATEGORY_TO_DEPT[complaint.category] || 'पंचायत';
        const hq = await Official.findOne({ level: 0, department: dept });
        if (hq) official = hq;
    }
    return official;
}

app.post('/api/complaints/new', auth, upload.array('images', 5), async (req, res) => {
    try {
        if (req.user.role !== 'citizen') {
            return res.status(403).json({ success: false, error: 'सिर्फ नागरिक शिकायत दर्ज कर सकते हैं' });
        }
        const { category, desc, isAnonymous } = req.body;
        if (!desc || !desc.trim()) return res.status(400).json({ success: false, error: 'विवरण लिखें' });
        if (!CATEGORY_TO_DEPT[category]) return res.status(400).json({ success: false, error: 'गलत श्रेणी' });

        const cleanDesc = desc.trim().slice(0, 1000);
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 5);
        const mediaUrls = req.files ? req.files.map(f => f.path) : [];

        const newComplaint = new Complaint({
            title: cleanDesc.length > 40 ? cleanDesc.substring(0, 40) + '...' : cleanDesc,
            category,
            description: cleanDesc,
            mediaUrls,
            citizenName: isAnonymous === 'true' ? '👤 पहचान गुप्त रखी गई' : req.user.name,
            userId: String(req.user._id),
            location: { district: req.user.district, block: req.user.block, village: req.user.village },
            currentLevel: category === 'पंचायत' ? 2 : 1,
            escalationDeadline: deadline
        });

        await newComplaint.save();
        const official = await findOfficialForComplaint(newComplaint);
        if (official) {
            console.log(`📧 नई शिकायत की मेल जाएगी: ${official.name} (${official.email})`);
            sendComplaintEmail(official, newComplaint);
        } else {
            console.log(`⚠️ इस गाँव के सरपंच की जानकारी अभी दर्ज नहीं है: ${req.user.village}`);
        }
        res.json({ success: true, message: 'शिकायत सफलतापूर्वक दर्ज हो गई!', complaint: publicView(newComplaint, req.user._id) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- अधिकारी जोड़ना/अपडेट करना (एडमिन पैनल से इस्तेमाल होगा) ---
app.post('/api/officials', adminOnly, async (req, res) => {
    try {
        const { level, department, name, email, phone, district, block, village } = req.body;

        let filter = { level, department, district };
        if (level == 1) filter.village = village;
        if (level == 2) filter.block = block;

        const official = await Official.findOneAndUpdate(
            filter,
            { level, department, name, email, phone, district, block, village, updatedAt: new Date() },
            { returnDocument: 'after', upsert: true }
        );

        res.json({ success: true, message: 'अधिकारी की जानकारी सेव हो गई!', official });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- सभी अधिकारी देखना (एडमिन पैनल के लिए लिस्ट) ---
app.get('/api/officials', adminOnly, async (req, res) => {
    try {
        const officials = await Official.find().sort({ role: 1 });
        res.json(officials);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/complaints', optionalAuth, async (req, res) => {
    try {
        const { village, district, block } = req.query;
        if (!village && !district) return res.json([]);
        const filter = { status: { $ne: 'Withdrawn' } };
        filter['reports.4'] = { $exists: false };
        if (district) filter['location.district'] = district;
        if (village) filter['location.village'] = village;
        if (block) filter['location.block'] = block;

        const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).limit(200);
        const uid = req.user ? req.user._id : null;
        res.json(complaints.map(c => publicView(c, uid)));
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/complaints/:id', optionalAuth, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        res.json(publicView(complaint, req.user ? req.user._id : null));
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/officials/my-complaints', auth, officialOnly, async (req, res) => {
    try {
        const u = req.user;
        const filter = { status: { $ne: 'Withdrawn' }, 'location.district': u.district };
        if (u.role === 'सरपंच') {
            filter['location.village'] = u.village;
            filter['location.block'] = u.block;
            filter.category = { $ne: 'पंचायत' };
        } else if (u.role === 'BDO') {
            filter['location.block'] = u.block;
        }
        const list = await Complaint.find(filter).sort({ createdAt: -1 }).limit(200);
        res.json(list.map(c => {
            const v = publicView(c, null);
            v.canAct = canAct(u, c);
            return v;
        }));
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// कमिटमेंट देना
app.post('/api/complaints/:id/commit', auth, officialOnly, async (req, res) => {
    try {
        const days = parseInt(req.body.days, 10);
        if (!days || days < 1 || days > 30) {
            return res.status(400).json({ success: false, error: 'दिन 1 से 30 के बीच होने चाहिए' });
        }
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        if (!canAct(req.user, complaint)) {
            return res.status(403).json({ success: false, error: 'यह शिकायत अभी आपके स्तर पर नहीं है' });
        }
        if (complaint.isLocked) return res.status(400).json({ success: false, error: 'पहले से कमिटमेंट दर्ज है' });

        const lockUntil = new Date();
        lockUntil.setDate(lockUntil.getDate() + days);

        complaint.comments.push({
            authorName: req.user.name, authorRole: req.user.role,
            text: (req.body.comment || '').trim().slice(0, 500) || `${days} दिन में समाधान का वादा`,
            isCommitment: true, commitmentDays: days
        });
        complaint.isLocked = true;
        complaint.lockUntil = lockUntil;
        complaint.escalationDeadline = lockUntil;
        complaint.status = 'Progress';

        await complaint.save({ validateModifiedOnly: true });
        res.json({ success: true, message: `✅ ${days} दिन का कमिटमेंट दर्ज हो गया, शिकायत लॉक कर दी गई है।` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// कमेंट (नागरिक और अधिकारी दोनों, अपने इलाके की शिकायत पर)
app.post('/api/complaints/:id/comments', auth, async (req, res) => {
    try {
        const text = (req.body.text || '').trim().slice(0, 500);
        if (!text) return res.status(400).json({ success: false, error: 'कमेंट खाली है' });

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        if (!inJurisdiction(req.user, complaint)) {
            return res.status(403).json({ success: false, error: 'आप इस शिकायत पर कमेंट नहीं कर सकते' });
        }

        const isOwner = String(complaint.userId) === String(req.user._id);
        const anon = (complaint.citizenName || '').includes('गुप्त');
        complaint.comments.push({
            authorName: (isOwner && anon) ? 'शिकायतकर्ता' : req.user.name,
            authorRole: req.user.role,
            text,
            isCommitment: false
        });
        await complaint.save({ validateModifiedOnly: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// "काम पूरा किया" -> नागरिक से पुष्टि माँगना
app.post('/api/complaints/:id/mark-done', auth, officialOnly, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        if (!canAct(req.user, complaint)) {
            return res.status(403).json({ success: false, error: 'यह शिकायत अभी आपके स्तर पर नहीं है' });
        }
        complaint.citizenConfirmationPending = true;
        complaint.isLocked = true;          // नागरिक के जवाब तक auto-escalation रुका रहे
        complaint.lockUntil = new Date();
        complaint.status = 'Progress';
        complaint.comments.push({
            authorName: req.user.name, authorRole: req.user.role,
            text: 'अधिकारी ने काम पूरा होने की सूचना दी है, नागरिक की पुष्टि का इंतज़ार है।',
            isCommitment: false
        });
        await complaint.save({ validateModifiedOnly: true });
        res.json({ success: true, message: '✅ नागरिक से पुष्टि माँगी गई है।' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// "आगे भेजें" -> अगले लेवल पर escalate
app.post('/api/complaints/:id/escalate', auth, officialOnly, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        if (!canAct(req.user, complaint)) {
            return res.status(403).json({ success: false, error: 'यह शिकायत अभी आपके स्तर पर नहीं है' });
        }
        if (complaint.currentLevel >= 3) {
            return res.status(400).json({ success: false, error: 'यह पहले से सबसे ऊपर के स्तर पर है' });
        }
        if (complaint.isLocked) {
            return res.status(400).json({ success: false, error: 'कमिटमेंट के दौरान आगे नहीं भेज सकते' });
        }

        complaint.currentLevel += 1;
        complaint.citizenConfirmationPending = false;
        const d = new Date();
        d.setDate(d.getDate() + 7);
        complaint.escalationDeadline = d;
        complaint.comments.push({
            authorName: req.user.name, authorRole: req.user.role,
            text: `${req.user.role} ने शिकायत अगले स्तर पर भेजी।`,
            isCommitment: false
        });
        await complaint.save({ validateModifiedOnly: true });

        const next = await findOfficialForComplaint(complaint);
        if (next) sendComplaintEmail(next, complaint);

        res.json({ success: true, message: '⬆️ शिकायत अगले अधिकारी को भेज दी गई।' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/complaints/:id/confirm-resolution', auth, async (req, res) => {
    try {
        const { resolved } = req.body;
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        if (String(complaint.userId) !== String(req.user._id)) {
            return res.status(403).json({ success: false, error: 'सिर्फ शिकायतकर्ता ही पुष्टि कर सकता है' });
        }
        if (!complaint.citizenConfirmationPending) {
            return res.status(400).json({ success: false, error: 'अभी पुष्टि माँगी नहीं गई है' });
        }

        let escalatedTo = null;
        if (resolved) {
            complaint.status = 'Resolved';
            complaint.citizenConfirmationPending = false;
            complaint.isLocked = false;
        } else {
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
            escalatedTo = true;
        }

        await complaint.save({ validateModifiedOnly: true });
        if (escalatedTo) {
            const next = await findOfficialForComplaint(complaint);
            if (next) sendComplaintEmail(next, complaint);
        }
        res.json({ success: true, message: resolved ? '✅ धन्यवाद! शिकायत हल मानी गई।' : '⚠️ अगले अधिकारी को भेज दिया गया है।' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/complaints/:id/report', auth, async (req, res) => {
    try {
        const c = await Complaint.findById(req.params.id);
        if (!c) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
        if (String(c.userId) === String(req.user._id)) return res.status(400).json({ success: false, error: 'अपनी शिकायत रिपोर्ट नहीं कर सकते' });
        if (!inJurisdiction(req.user, c)) return res.status(403).json({ success: false, error: 'अनुमति नहीं है' });
        await Complaint.updateOne({ _id: c._id }, { $addToSet: { reports: String(req.user._id) } });
        res.json({ success: true, message: '🚩 रिपोर्ट दर्ज हो गई, हम जाँच करेंगे।' });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
// --- शिकायत वापस लेने / दबाव में एस्केलेट करने की API ---
app.post('/api/complaints/:id/withdraw', auth, async (req, res) => {
  try {
    const { reason } = req.body; // 'completed', 'mistake', 'coerced'
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) return res.status(404).json({ success: false, error: 'शिकायत नहीं मिली!' });
    if (String(complaint.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, error: 'सिर्फ शिकायतकर्ता ही शिकायत वापस ले सकता है' });
    }

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

app.get('/api/my-complaints', auth, async (req, res) => {
    try {
        const complaints = await Complaint.find({ userId: String(req.user._id) }).sort({ createdAt: -1 });
        res.json(complaints.map(c => publicView(c, req.user._id)));
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
}, { timezone: 'Asia/Kolkata' });


// --- गाँव के असली आँकड़े ---
app.get('/api/village/stats', async (req, res) => {
    try {
        const { district, block, village } = req.query;
        const cFilter = {};
        const uFilter = { isVerified: true };
        if (district) { cFilter['location.district'] = district; uFilter.district = district; }
        if (village)  { cFilter['location.village'] = village;   uFilter.village = village; }
        if (block) { cFilter['location.block'] = block; uFilter.block = block; }

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
            { upsert: true, returnDocument: 'after' }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- सरपंच की जानकारी सेव करना ---
app.post('/api/village/sarpanch', adminOnly, async (req, res) => {
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

app.get('/api/chat', auth, async (req, res) => {
  try {
    const messages = await Chat.find({ village: req.user.village, district: req.user.district, block: req.user.block })
                               .sort({ createdAt: -1 })
                               .limit(100);
    res.json(messages.reverse().map(m => ({
      _id: m._id, senderId: m.senderId, senderName: m.senderName, text: m.text, createdAt: m.createdAt
    })));
  } catch (error) {
    console.error("Chat fetch error:", error);
    res.status(500).json({ error: "चैट लोड नहीं हो पाई" });
  }
});

app.post('/api/chat', auth, async (req, res) => {
  try {
    const text = (req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ error: "मैसेज खाली है" });

    const newMsg = new Chat({
      village: req.user.village,
      district: req.user.district,
      block: req.user.block,
      senderId: String(req.user._id),
      senderName: req.user.name,
      text
    });
    await newMsg.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Chat save error:", error);
    res.status(500).json({ error: "मैसेज नहीं गया" });
  }
});

// ==========================================
// 2. SUPPORT API (समर्थन)
// ==========================================
app.post('/api/complaints/:id/support', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.user._id);
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
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

app.get('/api/admin/verify-official/:id', async (req, res) => {
    try {
        const { action, secret } = req.query;
        if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) return res.status(403).send('गलत लिंक');
        const user = await User.findById(req.params.id);
        if (!user) return res.send('यूज़र नहीं मिला (शायद पहले ही अप्रूव/रिजेक्ट हो चुका है)');
        const isApprove = action === 'approve';
        res.send(`<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;text-align:center;padding:40px 20px;">
<h2>${escHtml(user.name)} (${escHtml(user.role)})</h2>
<p>${escHtml(user.district)}, ${escHtml(user.block)}, ${escHtml(user.village)}</p>
<p>क्या आप इसे <b>${isApprove ? 'अप्रूव' : 'रिजेक्ट'}</b> करना चाहते हैं?</p>
<form method="POST" action="/api/admin/verify-official/${escHtml(req.params.id)}">
<input type="hidden" name="action" value="${isApprove ? 'approve' : 'reject'}">
<input type="hidden" name="secret" value="${escHtml(secret)}">
<button type="submit" style="padding:14px 28px;font-size:16px;border:none;border-radius:8px;color:white;background:${isApprove ? '#4C6444' : '#A8402E'};">हाँ, ${isApprove ? 'अप्रूव' : 'रिजेक्ट'} करें</button>
</form></body></html>`);
    } catch (error) { res.status(500).send('एरर: ' + error.message); }
});

app.post('/api/admin/verify-official/:id', async (req, res) => {
    try {
        const { action, secret } = req.body;
        if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) return res.status(403).send('गलत लिंक');
        const user = await User.findById(req.params.id);
        if (!user) return res.send('यूज़र नहीं मिला');
        if (action === 'approve') {
            user.isVerified = true;
            await user.save();
            const LV = { 'सरपंच': { level: 1, department: 'पंचायत' }, 'BDO': { level: 2, department: 'BDO' }, 'DC/SDM': { level: 3, department: 'DC/SDM' } };
            const m = LV[user.role];
            if (m) {
                const f = { ...m, district: user.district };
                if (m.level === 1) { f.block = user.block; f.village = user.village; }
                if (m.level === 2) { f.block = user.block; }
                await Official.findOneAndUpdate(f, { ...f, name: user.name, email: user.email, phone: user.phone }, { upsert: true, returnDocument: 'after' });
            }
            return res.send(`<h2 style="font-family:sans-serif;text-align:center;">✅ ${escHtml(user.name)} को ${escHtml(user.role)} के तौर पर अप्रूव कर दिया गया।</h2>`);
        }
        if (user.isVerified) return res.send('यह अकाउंट पहले से अप्रूव है, रिजेक्ट नहीं किया जा सकता');
        await User.findByIdAndDelete(req.params.id);
        return res.send(`<h2 style="font-family:sans-serif;text-align:center;">❌ ${escHtml(user.name)} का अकाउंट रिजेक्ट कर दिया गया।</h2>`);
    } catch (error) { res.status(500).send('एरर: ' + error.message); }
});

// --- Razorpay Payment APIs ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.post('/api/payment/create-order', optionalAuth, async (req, res) => {
    try {
        const plan = PLANS[req.body.plan];
        if (!plan) return res.status(400).json({ success: false, error: 'गलत प्लान' });
        const uid = req.user ? String(req.user._id) : '';
        const email = String(req.body.email || (req.user && req.user.email) || '').slice(0, 80);
        const phone = String(req.body.phone || (req.user && req.user.phone) || '').slice(0, 15);

        const order = await razorpay.orders.create({
            amount: plan.amount, currency: 'INR',
            receipt: 'mg_' + Date.now(),
            notes: { plan: req.body.plan, userId: uid, email, phone }
        });
        await Payment.create({ orderId: order.id, plan: req.body.plan, amount: plan.amount, userId: uid, email, phone });
        res.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        console.error('create-order error:', error.message);
        res.status(500).json({ success: false, error: 'पेमेंट शुरू नहीं हो पाया' });
    }
});

app.post('/api/payment/verify', optionalAuth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, error: 'अधूरी जानकारी' });
        }
        const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
        if (expected !== razorpay_signature) return res.status(400).json({ success: false, error: 'पेमेंट सत्यापित नहीं हुआ' });

        const p = await Payment.findOneAndUpdate(
            { orderId: razorpay_order_id, status: 'created' },
            { status: 'paid', paymentId: razorpay_payment_id, paidAt: new Date() },
            { returnDocument: 'after' }
        );
        if (!p) return res.status(400).json({ success: false, error: 'यह पेमेंट पहले ही दर्ज हो चुका है' });

        if (p.userId) {   // renewal: नया प्लान पुराने के खत्म होने के बाद से शुरू
            const u = await User.findById(p.userId);
            const start = (u.subEnd && u.subEnd > new Date()) ? u.subEnd : new Date();
            u.subEnd = addPlan(start, p.plan);
            u.remind2 = false;
            u.remind1 = false;
            await u.save({ validateModifiedOnly: true });
            await Payment.updateOne({ _id: p._id }, { claimed: true });
            return res.json({ success: true, mode: 'renew', sub: subInfo(u) });
        }

        const payToken = jwt.sign({ pid: String(p._id), kind: 'pay' }, process.env.JWT_SECRET, { expiresIn: '3d' });
        res.json({ success: true, mode: 'register', payToken });
    } catch (error) {
        console.error('verify error:', error.message);
        res.status(500).json({ success: false, error: 'पेमेंट की पुष्टि नहीं हो पाई' });
    }
});
// Global Error Handler (Multer/Cloudinary के एरर पकड़ने के लिए)
app.use((err, req, res, next) => {
    console.error("🔥 Server Crash Error:", err);
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
});
cron.schedule('0 9 * * *', async () => {
    try {
        const now = new Date();
        const in1 = new Date(now.getTime() + DAY_MS), in2 = new Date(now.getTime() + 2 * DAY_MS);
        const a = await User.find({ role: 'citizen', subEnd: { $gt: now, $lte: in2 }, remind2: { $ne: true } });
        for (const u of a) { await sendSubReminderEmail(u, 2); u.remind2 = true; await u.save({ validateModifiedOnly: true }); }
        const b = await User.find({ role: 'citizen', subEnd: { $gt: now, $lte: in1 }, remind1: { $ne: true } });
        for (const u of b) { await sendSubReminderEmail(u, 1); u.remind1 = true; await u.save({ validateModifiedOnly: true }); }
    } catch (e) { console.log('reminder error:', e.message); }
}, { timezone: 'Asia/Kolkata' });

app.listen(PORT, () => {
    console.log(`🚀 सर्वर http://localhost:${PORT} पर लाइव है`);
});