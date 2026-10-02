const axios = require('axios');

async function sendMail({ to, subject, text, html }) {
    try {
        const body = {
            sender: { name: 'मेरा गाँव', email: process.env.MAIL_FROM },
            to: [{ email: to }],
            subject
        };
        if (html) body.htmlContent = html;
        if (text) body.textContent = text;

        await axios.post('https://api.brevo.com/v3/smtp/email', body, {
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        return true;
    } catch (err) {
        console.error('❌ मेल एरर:', err.response?.data || err.message);
        return false;
    }
}

// OTP मेल
async function sendOtpEmail(toEmail, otp) {
    return sendMail({
        to: toEmail,
        subject: 'मेरा गाँव - आपका OTP',
        html: `
          <div style="font-family:Arial,sans-serif;padding:20px;">
            <h2>मेरा गाँव</h2>
            <p>आपका OTP है:</p>
            <h1 style="letter-spacing:8px;">${otp}</h1>
            <p>यह 10 मिनट तक मान्य है। इसे किसी के साथ साझा न करें।</p>
          </div>`
    });
}

// नई शिकायत की सूचना अधिकारी को
async function sendComplaintEmail(official, complaint) {
    if (!official || !official.email) return false;

    const mediaLinks = (complaint.mediaUrls || [])
        .map(url => url.startsWith('http') ? url : `https://mera-gaon-app.onrender.com${url}`)
        .join('\n');

    const ok = await sendMail({
        to: process.env.MAIL_REDIRECT_TO || official.email,
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
    });

    if (ok) console.log(`✅ ईमेल भेज दी गई: ${official.email}`);
    return ok;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// एडमिन को अधिकारी वेरिफिकेशन मेल
async function sendAdminVerificationEmail(user, approveUrl, rejectUrl) {
    const ok = await sendMail({
        to: process.env.ADMIN_EMAIL || process.env.MAIL_FROM,
        subject: `🆕 नया ${user.role} अकाउंट वेरिफिकेशन — ${user.village || user.district}`,
        html: `
          <p><b>नाम:</b> ${esc(user.name)}</p>
          <p><b>पद:</b> ${esc(user.role)}</p>
          <p><b>फ़ोन:</b> ${esc(user.phone)}</p>
          <p><b>जगह:</b> ${esc(user.district)}, ${esc(user.block)}, ${esc(user.village)}</p>
          <p><b>ID/इलेक्शन सर्टिफिकेट:</b> ${user.idProofUrl ? `<a href="${esc(user.idProofUrl)}">यहां देखें</a>` : 'अपलोड नहीं हुआ'}</p>
          <p>
            <a href="${approveUrl}" style="padding:10px 16px;background:#4C6444;color:white;text-decoration:none;border-radius:6px;">✅ अप्रूव करें</a>
            &nbsp;
            <a href="${rejectUrl}" style="padding:10px 16px;background:#A8402E;color:white;text-decoration:none;border-radius:6px;">❌ रिजेक्ट करें</a>
          </p>`
    });

    if (ok) console.log('✅ एडमिन वेरिफिकेशन मेल भेजी गई');
    return ok;
}
async function sendSubReminderEmail(user, daysLeft) {
    if (!user.email) return false;
    return sendMail({
        to: user.email,
        subject: `⏰ मेरा गाँव: आपकी ऐप फीस ${daysLeft} दिन में खत्म हो रही है`,
        text: `नमस्ते ${user.name},\n\nआपका "मेरा गाँव" प्लान ${daysLeft} दिन में खत्म हो रहा है।\nऐप खोलकर ☰ मेनू → "ऐप फीस" से भुगतान कर दें। नया प्लान पुराने के खत्म होने के बाद से शुरू होगा।\n\n— मेरा गाँव`
    });
}

module.exports = { sendOtpEmail, sendComplaintEmail, sendAdminVerificationEmail, sendSubReminderEmail };