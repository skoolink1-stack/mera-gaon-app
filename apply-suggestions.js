// fix-suggestions.csv में जिन पंक्तियों के approve कॉलम में Y लिखा है, सिर्फ़ उन्हीं को DB में बदलता है
//   node apply-suggestions.js --dry   → सिर्फ़ गिनती, कुछ नहीं बदलता
//   node apply-suggestions.js         → असली बदलाव
// सुरक्षा: अगर नए नाम वाले गाँव का सरपंच पहले से दर्ज है तो वह पंक्ति छोड़ दी जाती है
try { require('dotenv').config(); } catch (e) {}
const fs = require('fs'), path = require('path');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry');
const FILE = arg('--file', path.join(__dirname, 'fix-suggestions.csv'));
const YES = new Set(['y', 'yes', '1', 'ha', 'haan', 'हाँ', 'हां']);

function parse(text) {
  const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(l => l.trim());
  const head = lines.shift().split(',').map(h => h.replace(/"/g, '').trim());
  return lines.map(l => {
    const c = l.split(',').map(x => x.replace(/"/g, '').trim()), o = {};
    head.forEach((h, i) => o[h] = c[i] || '');
    return o;
  });
}
const approvedRows = rows => rows.filter(r => YES.has(String(r.approve).toLowerCase()) && r.phone && r.village_new);

module.exports = { parse, approvedRows };

if (require.main === module) (async () => {
  const mongoose = require('mongoose'); const Official = require('./models/Official');
  const rows = approvedRows(parse(fs.readFileSync(FILE, 'utf8')));
  console.log(`approve (Y) वाली पंक्तियाँ: ${rows.length}`);
  await mongoose.connect(process.env.MONGO_URI);
  const base = { level: 1, department: 'पंचायत' };
  const claimed = new Set(); let ok = 0, notFound = 0, busy = 0;
  for (const r of rows) {
    const key = [r.district_new, r.block_new, r.village_new].join('|');
    const mine = await Official.collection.findOne({ ...base, phone: r.phone, district: r.district_old, block: r.block_old, village: r.village_old });
    if (!mine) { notFound++; console.log(`  ✗ DB में पुराना रिकॉर्ड नहीं मिला: ${r.village_old} (${r.phone})`); continue; }
    const taken = claimed.has(key) || await Official.collection.findOne({ ...base, district: r.district_new, block: r.block_new, village: r.village_new, _id: { $ne: mine._id } });
    if (taken) { busy++; console.log(`  ✗ छोड़ा (उस गाँव का सरपंच पहले से दर्ज): ${r.village_new}`); continue; }
    claimed.add(key);
    if (!DRY) await Official.collection.updateOne({ _id: mine._id }, { $set: { district: r.district_new, block: r.block_new, village: r.village_new } });
    ok++;
  }
  console.log(`${DRY ? '--dry: ' : '✅ '}बदलेंगे/बदले गए: ${ok} | पुराना नहीं मिला: ${notFound} | गाँव भरा हुआ: ${busy}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });