require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const Complaint = require('./models/Complaint');
const Official = require('./models/Official');
const bcrypt = require('bcrypt');
const { sendComplaintEmail } = require('./mailer');
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
    
    // --- 1. नया यूज़र रजिस्टर करने की API ---
app.post('/api/auth/register', upload.single('idProof'), async (req, res) => {
    try {
        const { name, phone, password, role, district, block, village } = req.body;
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

app.listen(PORT, () => {
    console.log(`🚀 सर्वर http://localhost:${PORT} पर लाइव है`);
});