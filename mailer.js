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

async function sendAdminVerificationEmail(user, approveUrl, rejectUrl) {
    const mailOptions = {
        from: `"मेरा गाँव" <${process.env.GMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `🆕 नया ${user.role} अकाउंट वेरिफिकेशन — ${user.village || user.district}`,
        html: `
          <p><b>नाम:</b> ${user.name}</p>
          <p><b>पद:</b> ${user.role}</p>
          <p><b>फ़ोन:</b> ${user.phone}</p>
          <p><b>जगह:</b> ${user.district}, ${user.block}, ${user.village}</p>
          <p><b>ID/इलेक्शन सर्टिफिकेट:</b> <a href="${user.idProofUrl}">यहां देखें</a></p>
          <p>
            <a href="${approveUrl}" style="padding:10px 16px;background:#4C6444;color:white;text-decoration:none;border-radius:6px;">✅ अप्रूव करें</a>
            &nbsp;
            <a href="${rejectUrl}" style="padding:10px 16px;background:#A8402E;color:white;text-decoration:none;border-radius:6px;">❌ रिजेक्ट करें</a>
          </p>`
    };
    try { await transporter.sendMail(mailOptions); console.log('✅ एडमिन वेरिफिकेशन मेल भेजी गई'); }
    catch(err){ console.log('❌ एडमिन मेल एरर:', err.message); }
}

async function sendOtpEmail(toEmail, otp) {
    const mailOptions = {
        from: `"मेरा गाँव" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: `आपका OTP: ${otp}`,
        text: `आपका सत्यापन कोड है: ${otp}\n\nयह किसी के साथ साझा न करें।\n\n— मेरा गाँव ऐप`
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP मेल भेजी गई: ${toEmail}`);
        return true;
    } catch (err) {
        console.log(`❌ OTP मेल एरर (${toEmail}):`, err.message);
        return false;
    }
}

module.exports = { sendComplaintEmail, sendAdminVerificationEmail, sendOtpEmail };