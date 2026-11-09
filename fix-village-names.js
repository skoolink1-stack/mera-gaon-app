// DB में पहले से डाले गए सरपंचों के गाँव-नाम को haryana-data.js वाले नाम में बदलता है
// (ताकि गाँव का पहला नागरिक जुड़ने पर / शिकायत करते समय सही सरपंच मिले)
//   node fix-village-names.js --dry   → कुछ नहीं बदलता; सिर्फ़ गिनती + fix-preview.csv + fix-report.csv
//   node fix-village-names.js         → असली अपडेट (सिर्फ़ वही रिकॉर्ड बदलते हैं जिनका नाम सच में अलग है)
// fix-preview.csv : पुराना → नया नाम (बदलने वालों की लिस्ट, चलाने से पहले देख लें)
// fix-report.csv  : जो मेल नहीं खाए (इन्हें हाथ से देखना है)
require('dotenv').config();
const fs = require('fs'), path = require('path');
const mongoose = require('mongoose');
const Official = require('./models/Official');
const { buildMatches } = require('./import-sarpanch');
const DRY = process.argv.includes('--dry');
const csv = rows => rows.map(r => r.map(x => String(x ?? '').replace(/,/g, ' ')).join(',')).join('\n');

(async () => {
  const HR = new Function(fs.readFileSync(path.join(__dirname, 'haryana-data.js'), 'utf8') + '; return haryanaFullData;')();
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await Official.collection.find({ level: 1, department: 'पंचायत' }).toArray();
  const byId = new Map(docs.map(d => [String(d._id), d]));
  const rows = docs.map(d => ({ _id: d._id, district: d.district, block: d.block, village: d.village, name: d.name, phone: d.phone }));
  const { matched, unmatched } = buildMatches(rows, HR);

  const changed = matched.filter(m => {
    const d = byId.get(String(m._id));
    return d.district !== m.district || d.block !== m.block || d.village !== m.village;
  });

  console.log(`DB में सरपंच: ${rows.length}`);
  console.log(`  पहले से सही नाम: ${matched.length - changed.length}`);
  console.log(`  नाम बदलेगा:      ${changed.length}`);
  console.log(`  मेल नहीं खाए:     ${unmatched.length}  (fix-report.csv देखें)`);

  fs.writeFileSync(path.join(__dirname, 'fix-preview.csv'), '\ufeff' + csv([['district_old', 'block_old', 'village_old', 'district_new', 'block_new', 'village_new', 'phone']]
    .concat(changed.map(m => { const d = byId.get(String(m._id)); return [d.district, d.block, d.village, m.district, m.block, m.village, m.phone]; }))));
  fs.writeFileSync(path.join(__dirname, 'fix-report.csv'), '\ufeff' + csv([['district', 'block', 'village', 'name', 'phone', 'reason']]
    .concat(unmatched.map(u => [u.district, u.block, u.village, u.name, u.phone, u.reason]))));

  if (!DRY) {
    const ops = changed.map(m => ({ updateOne: { filter: { _id: m._id }, update: { $set: { district: m.district, block: m.block, village: m.village } } } }));
    for (let i = 0; i < ops.length; i += 500) await Official.collection.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    console.log(`✅ ${changed.length} रिकॉर्ड के गाँव-नाम ठीक कर दिए गए।`);
  } else console.log('--dry: कुछ नहीं बदला।');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });