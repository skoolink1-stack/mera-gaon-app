// सरपंच की लिस्ट (sarpanch.csv) को डेटाबेस में डालने की स्क्रिप्ट
// चलाने का तरीका (MeraGaon-Server फोल्डर में):
//   node import-sarpanch.js --dry     → सिर्फ़ जाँच, डेटाबेस में कुछ नहीं लिखता
//   node import-sarpanch.js           → असली import
// नतीजा import-report.csv में आता है (जो गाँव मेल नहीं खाए उनकी लिस्ट)

const fs = require('fs');
const path = require('path');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
const DRY = process.argv.includes('--dry');
const CSV_PATH = arg('--csv', path.join(__dirname, 'sarpanch.csv'));
const DATA_PATH = arg('--data', path.join(__dirname, 'haryana-data.js'));

const DISTRICT_ALIAS = { 'charkidadri': 'Charkhi Dadri', 'mewat': 'Nuh', 'mohindergarh': 'Mahendragarh', 'mahendergarh': 'Mahendragarh', 'gurgaon': 'Gurugram', 'sonepat': 'Sonipat' };

// अंग्रेज़ी स्पेलिंग के फ़र्क (kh/k, ou/o, w/v ...) को बराबर कर देता है
const norm = s => String(s || '').toLowerCase()
  .replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '')
  .replace(/ou/g, 'o').replace(/au/g, 'o').replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u')
  .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ch+/g, 'c').replace(/sh/g, 's')
  .replace(/w/g, 'v').replace(/z/g, 'j').replace(/y/g, 'i').replace(/(.)\1+/g, '$1');

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const threshold = L => (L <= 4 ? 0 : L <= 7 ? 1 : L <= 11 ? 2 : 3);

function distance(a, b) {
  if (a === b) return 0;
  if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))) return 1;
  return lev(a, b);
}

function findKey(obj, target) {
  const keys = Object.keys(obj);
  const t = norm(target);
  return keys.find(k => norm(k) === t)
    || keys.find(k => norm(k).length >= 5 && t.length >= 5 && (norm(k).startsWith(t) || t.startsWith(norm(k))))
    || keys.find(k => lev(norm(k), t) <= (t.length <= 6 ? 1 : 2));
}

// ब्लॉक का नाम: Ambala-I और Ambala-II को अलग रखता है (norm() "ii" को "i" बना देता था)
function splitBlock(s) {
  const t = String(s || '').toLowerCase().replace(/\(.*?\)/g, '').trim();
  const m = t.match(/^(.+?)[\s\-_]+(iii|ii|i)$/);
  return m ? { base: norm(m[1]), suf: m[2].length } : { base: norm(t), suf: 0 };
}

function findBlockKey(obj, target) {
  const t = splitBlock(target);
  const cand = Object.keys(obj).map(k => ({ k, ...splitBlock(k) })).filter(c => c.suf === t.suf);
  const hit = cand.find(c => c.base === t.base)
    || cand.find(c => c.base.length >= 5 && t.base.length >= 5 && (c.base.startsWith(t.base) || t.base.startsWith(c.base)))
    || cand.find(c => lev(c.base, t.base) <= (t.base.length <= 6 ? 1 : 2));
  return hit && hit.k;
}

// एक ब्लॉक की पंचायतों को उसके गाँवों से जोड़ना (हर गाँव सिर्फ़ एक बार)
function matchBlock(rows, villages) {
  const pairs = [];
  rows.forEach((r, i) => villages.forEach((v, j) => {
    const a = norm(r.village), b = norm(v);
    if (!a || !b) return;
    const d = distance(a, b);
    if (d <= threshold(Math.max(a.length, b.length))) pairs.push([d, i, j]);
  }));
  pairs.sort((x, y) => x[0] - y[0]);
  const usedR = new Set(), usedV = new Set(), out = new Map();
  for (const [, i, j] of pairs) {
    if (usedR.has(i) || usedV.has(j)) continue;
    usedR.add(i); usedV.add(j); out.set(i, villages[j]);
  }
  return out;
}

function parseCsv(text) {
  return text.split(/\r?\n/).slice(1).filter(Boolean).map(line => {
    const [district, block, village, name, phone] = line.split(',').map(s => (s || '').trim());
    return { district, block, village, name, phone };
  });
}

function buildMatches(rows, HR) {
  const matched = [], unmatched = [];
  const groups = new Map();

  for (const r of rows) {
    let dKey = DISTRICT_ALIAS[norm(r.district)] || findKey(HR, r.district);
    if (dKey && !HR[dKey]) dKey = findKey(HR, dKey);
    let bKey = dKey && findBlockKey(HR[dKey], r.block);
    if (!bKey) {                       // जैसे Hisar के नीचे लिखे Hansi-I / Hansi-II
      for (const d of Object.keys(HR)) { const k = findBlockKey(HR[d], r.block); if (k) { dKey = d; bKey = k; break; } }
    }
    if (!dKey || !bKey) { unmatched.push({ ...r, reason: 'ज़िला/ब्लॉक नहीं मिला' }); continue; }
    const key = dKey + '||' + bKey;
    if (!groups.has(key)) groups.set(key, { district: dKey, block: bKey, rows: [] });
    groups.get(key).rows.push(r);
  }

  for (const g of groups.values()) {
    const villages = [...new Set(HR[g.district][g.block])];
    const m = matchBlock(g.rows, villages);
    g.rows.forEach((r, i) => {
      if (m.has(i)) matched.push({ _id: r._id, district: g.district, block: g.block, village: m.get(i), name: r.name, phone: r.phone, pdfVillage: r.village });
      else unmatched.push({ ...r, reason: 'गाँव का नाम मेल नहीं खाया' });
    });
  }
  return { matched, unmatched };
}

async function main() {
  const HR = new Function(fs.readFileSync(DATA_PATH, 'utf8') + '; return haryanaFullData;')();
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const { matched, unmatched } = buildMatches(rows, HR);

  const rep = ['district,block,village,name,phone,reason']
    .concat(unmatched.map(u => [u.district, u.block, u.village, u.name, u.phone, u.reason].join(',')));
  fs.writeFileSync(path.join(__dirname, 'import-report.csv'), '\ufeff' + rep.join('\n'));

  console.log(`CSV में कुल: ${rows.length}`);
  console.log(`मेल खाए:   ${matched.length}`);
  console.log(`मेल नहीं खाए: ${unmatched.length}  (import-report.csv देखें)`);

  if (DRY) {
    console.log('\n--dry मोड: डेटाबेस में कुछ नहीं लिखा। नमूना:');
    matched.slice(0, 8).forEach(m => console.log(`  ${m.pdfVillage}  →  ${m.district} / ${m.block} / ${m.village}  (${m.name})`));
    return;
  }

  require('dotenv').config();
  const mongoose = require('mongoose');
  const Official = require('./models/Official');
  await mongoose.connect(process.env.MONGO_URI);

  const ops = matched.map(m => ({
    updateOne: {
      filter: { level: 1, department: 'पंचायत', district: m.district, block: m.block, village: m.village },
      update: { $set: { name: m.name, phone: m.phone }, $setOnInsert: { email: '' } },
      upsert: true
    }
  }));
  for (let i = 0; i < ops.length; i += 500) await Official.bulkWrite(ops.slice(i, i + 500));
  console.log(`\n✅ डेटाबेस में ${ops.length} सरपंच दर्ज/अपडेट हुए (मौजूदा ईमेल नहीं छेड़ी गई)।`);
  process.exit(0);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { buildMatches, norm };