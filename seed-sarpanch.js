// 6,175 सरपंच का डेटा सीधे MongoDB में डालने की स्क्रिप्ट (bulk, API से नहीं — तेज़ है)
// चलाने का तरीका (लोकल कंप्यूटर पर, server.js के बराबर वाले फोल्डर में):
//   node seed-sarpanch.js

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const Official = require('./models/Official');

const sarpanchList = JSON.parse(fs.readFileSync('./sarpanch-data.json', 'utf-8'));

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB से जुड़ गया। कुल ${sarpanchList.length} सरपंच डाले जाएंगे...`);

    const ops = sarpanchList.map(s => ({
        updateOne: {
            filter: { level: 1, department: 'पंचायत', district: s.district, block: s.block, village: s.village },
            update: { $set: s },
            upsert: true
        }
    }));

    // 1000-1000 के बैच में डालो (एक साथ 6175 भारी पड़ सकता है)
    const batchSize = 1000;
    let done = 0;
    for (let i = 0; i < ops.length; i += batchSize) {
        const batch = ops.slice(i, i + batchSize);
        const result = await Official.bulkWrite(batch);
        done += batch.length;
        console.log(`➡️  ${done}/${ops.length} हो गए (इस बैच में: ${result.upsertedCount} नए, ${result.modifiedCount} अपडेट हुए)`);
    }

    console.log('🎉 पूरा हो गया! सभी सरपंच डेटाबेस में डल गए।');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('❌ एरर:', err);
    process.exit(1);
});