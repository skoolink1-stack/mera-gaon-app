// whatsapp.js — गाँव का पहला नागरिक जुड़ने पर उस गाँव के सरपंच को सिर्फ़ एक बार WhatsApp संदेश
// .env / Render में चाहिए: WA_ENABLED=true, WA_PHONE_ID, WA_TOKEN, WA_TEMPLATE, WA_LANG
// टेस्टिंग के लिए: WA_REDIRECT_TO=91XXXXXXXXXX (सारे संदेश इसी नंबर पर जाएँगे, DB में कुछ दर्ज नहीं होगा)
const Official = require('./models/Official');
const User = require('./models/User');

const DAY_MS = 86400000;
const dbg = (...a) => { if (process.env.WA_DEBUG === 'true') console.log('📲 WA debug:', ...a); };
const cap = s => String(s || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
const clean = s => cap(String(s || '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim());
const istHour = () => parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }), 10) % 24;

async function sendTemplate(to, name, village) {
    const { WA_PHONE_ID, WA_TOKEN, WA_TEMPLATE = 'mera_gaon_sarpanch_alert', WA_LANG = 'hi', WA_API_VERSION = 'v25.0' } = process.env;
    const r = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: 'whatsapp', to, type: 'template',
            template: {
                name: WA_TEMPLATE, language: { code: WA_LANG },
                components: [{ type: 'body', parameters: [{ type: 'text', text: name }, { type: 'text', text: village }] }]
            }
        })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, id: j.messages && j.messages[0] && j.messages[0].id };
    return { ok: false, err: (j.error && (j.error.code + ': ' + j.error.message)) || ('HTTP ' + r.status) };
}

async function notifySarpanch(user) {
    dbg('बुलाया गया:', user && user.role, user && user.village);
    if (process.env.WA_ENABLED !== 'true') return dbg('रुका: WA_ENABLED != true');
    if (!user || user.role !== 'citizen') return dbg('रुका: यूज़र नागरिक नहीं है');
    if (!process.env.WA_PHONE_ID || !process.env.WA_TOKEN) return dbg('रुका: WA_PHONE_ID या WA_TOKEN खाली');
    const { district, block, village } = user;
    if (!district || !block || !village) return dbg('रुका: यूज़र का ज़िला/ब्लॉक/गाँव खाली');

    // सरपंच पहले से ऐप पर जुड़ चुका है तो संदेश की ज़रूरत नहीं
    if (await User.exists({ role: 'सरपंच', isVerified: true, district, block, village })) return dbg('रुका: इस गाँव का सरपंच पहले से ऐप पर जुड़ा है');

    const where = { level: 1, department: 'पंचायत', district, block, village };
    const redirect = String(process.env.WA_REDIRECT_TO || '').replace(/\D/g, '');

    // --- टेस्ट मोड: असली सरपंच को नहीं, अपने नंबर पर; DB में कुछ दर्ज नहीं ---
    if (redirect) {
        const o = await Official.collection.findOne(where);
        if (!o) { console.log(`📲 WA(test): ${village} का सरपंच रिकॉर्ड नहीं मिला`); return; }
        const to = redirect.length === 10 ? '91' + redirect : redirect;
        const res = await sendTemplate(to, clean(o.name) || 'सरपंच', clean(o.village));
        console.log(`📲 WA(test) ${village} →`, res.ok ? 'भेजा ' + res.id : 'फ़ेल ' + res.err);
        return;
    }

    // रात में सरपंच को संदेश नहीं; अगला नागरिक दिन में जुड़ेगा/लॉगिन करेगा तो चला जाएगा
    const h = istHour();
    if (h < 8 || h >= 21) return dbg('रुका: अभी रात का समय है (भारत में 8 से 21 बजे के बीच ही जाता है), घंटा =', h);

    // एक ही बार भेजने के लिए "दावा" (atomic) — दो लोग एक साथ जुड़ें तब भी सिर्फ़ एक संदेश
    const now = new Date();
    const claim = await Official.collection.findOneAndUpdate(
        {
            ...where, phone: /^[6-9]\d{9}$/, name: { $not: /death/i }, waTries: { $not: { $gte: 3 } },
            $or: [
                { waStatus: { $in: [null, ''] } },
                { waStatus: 'failed', waSentAt: { $lt: new Date(now - DAY_MS) } },
                { waStatus: 'sending', waSentAt: { $lt: new Date(now - 15 * 60000) } }
            ]
        },
        { $set: { waStatus: 'sending', waSentAt: now }, $inc: { waTries: 1 } },
        { returnDocument: 'after' }
    );
    const o = claim && claim.value !== undefined ? claim.value : claim;   // driver के अलग-अलग version के लिए
    if (!o) return dbg('रुका: या तो इस गाँव के सरपंच को पहले भेजा जा चुका, या रिकॉर्ड/नंबर नहीं मिला:', district, block, village);

    const res = await sendTemplate('91' + o.phone, clean(o.name) || 'सरपंच', clean(o.village));
    await Official.collection.updateOne({ _id: o._id }, {
        $set: res.ok
            ? { waStatus: 'sent', waMsgId: res.id, waSentAt: new Date(), waError: '' }
            : { waStatus: 'failed', waError: res.err, waSentAt: new Date() }
    });
    console.log(`📲 WA ${village} (${clean(o.name)}) →`, res.ok ? 'भेजा' : 'फ़ेल: ' + res.err);
}

module.exports = { notifySarpanch };