const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// नई शिकायत की सूचना अधिकारी को भेजना
async function sendComplaintEmail(official, complaint) {
    if (!official || !official.email) return;

    const mediaLinks = (complaint.mediaUrls || [])
        .map(url => `https://mera-gaon-app.onrender.com${url}`)
        .join('\n');

    const mailOptions = {
        from: `"मेरा गाँव" <${process.env.GMAIL_USER}>`,
        to: official.email,
        subject: `🔔 नई शिकायत (${complaint.category}) — ${complaint.location.village || complaint.location.district}`,
        text: `
नमस्ते ${official.name || official.department},

एक नई शिकायत दर्ज हुई है जो आपके क्षेत्र से जुड़ी है:

श्रेणी: ${complaint.category}
गाँव/ब्लॉक/ज़िला: ${complaint.location.village || ''}, ${complaint.location.block || ''}, ${complaint.location.district}
शिकायतकर्ता: ${complaint.citizenName}
विवरण: ${complaint.description}

सबूत की फोटो/वीडियो:
${mediaLinks || 'कोई फोटो नहीं'}

शिकायत ट्रैकिंग ID: ${complaint._id}

कृपया इस समस्या पर जल्द से जल्द ध्यान दें।

— मेरा गाँव ऐप
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ ईमेल भेज दी गई: ${official.email}`);
    } catch (err) {
        console.log(`❌ ईमेल भेजने में गलती (${official.email}):`, err.message);
    }
}

module.exports = { sendComplaintEmail };