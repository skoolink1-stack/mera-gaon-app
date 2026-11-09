// fix-report.csv के बचे हुए सरपंचों के लिए "सुझाव" बनाता है (DB में कुछ नहीं बदलता)
//   node suggest-fixes.js            → fix-suggestions.csv बनता है
// फिर उस फ़ाइल को Excel/Numbers में खोलकर देखें; जो सही लगे उसके approve कॉलम में Y लिखें
// (HIGH वालों में Y पहले से लिखा है)। उसके बाद:  node apply-suggestions.js --dry  →  node apply-suggestions.js
try { require('dotenv').config(); } catch (e) {}
const fs = require('fs'), path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const REPORT = arg('--report', path.join(__dirname, 'fix-report.csv'));
const DATA = arg('--data', path.join(__dirname, 'haryana-data.js'));
const NO_DB = process.argv.includes('--no-db');

// ---------- नाम की सफ़ाई / मिलान ----------
const phon = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '')
  .replace(/ph/g, 'f').replace(/x/g, 'ks').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/ch+/g, 'c')
  .replace(/sh/g, 's').replace(/w/g, 'v').replace(/z/g, 'j').replace(/y/g, 'i').replace(/q/g, 'k').replace(/(.)\1+/g, '$1');
const skel = s => phon(s).replace(/[aeiou]/g, '');
const GENERIC = new Set(['dhani', 'dera', 'basti', 'colony', 'farm', 'pana', 'panna', 'patti', 'urf', 'alias', 'bass']);
const tokens = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(t => t && !GENERIC.has(t)).map(phon);

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// ब्लॉक का नाम: I / II / III अलग रखता है
function splitBlock(s) {
  const t = String(s || '').toLowerCase().replace(/\(.*?\)/g, '').trim();
  const m = t.match(/^(.+?)[\s\-_]+(iii|ii|i)$/);
  return m ? { base: phon(m[1]), suf: m[2].length } : { base: phon(t), suf: 0 };
}
function findBlockKey(obj, target) {
  const t = splitBlock(target);
  const cand = Object.keys(obj).map(k => ({ k, ...splitBlock(k) })).filter(c => c.suf === t.suf);
  const hit = cand.find(c => c.base === t.base)
    || cand.find(c => c.base.length >= 5 && t.base.length >= 5 && (c.base.startsWith(t.base) || t.base.startsWith(c.base)))
    || cand.find(c => lev(c.base, t.base) <= (t.base.length <= 6 ? 1 : 2));
  return hit && hit.k;
}
function findDistrict(HR, name) {
  const t = phon(name), alias = { charkidadri: 'Charkhi Dadri', mewat: 'Nuh', mohindergarh: 'Mahendragarh', mahendergarh: 'Mahendragarh', gurgaon: 'Gurugram', sonepat: 'Sonipat' };
  if (alias[t]) return alias[t];
  return Object.keys(HR).find(k => phon(k) === t) || Object.keys(HR).find(k => lev(phon(k), t) <= 2);
}
function resolveBlock(HR, district, block) {
  let d = findDistrict(HR, district), b = d && findBlockKey(HR[d], block);
  if (!b) for (const dd of Object.keys(HR)) { const k = findBlockKey(HR[dd], block); if (k) { d = dd; b = k; break; } }
  return d && b ? { d, b } : null;
}

const stripSuffix = v => String(v || '').replace(/\(.*?\)/g, '').replace(/[\s\-]*(\d+(\.\d+)?|iii|ii|i)\s*$/i, '').replace(/\s*\*+\s*$/, '').trim();

// किसी एक रिपोर्ट-पंक्ति और एक गाँव के बीच मेल का "दर्जा" (छोटा = बेहतर), या null
function rankOf(base, cand) {
  const pb = phon(base), pc = phon(cand);
  if (!pb || !pc) return null;
  if (pb === pc) return { rank: 0, L: pb.length };
  const sb = skel(base), sc = skel(cand), L = Math.max(sb.length, sc.length);
  if (L >= 3 && pb[0] === pc[0]) {
    const d = lev(sb, sc);
    if (d === 0) return { rank: 1, L };
    const tb = tokens(base), tc = tokens(cand);
    if (tb.length && tc.length && (tc.every(x => tb.includes(x)) || tb.every(x => tc.includes(x))) && Math.min(...[...tb, ...tc].map(x => x.length)) >= 4) return { rank: 2, L };
    if (d === 1 && L >= 4) return { rank: 3, L };
    if (d === 2 && L >= 8) return { rank: 4, L };
    return null;
  }
  const tb = tokens(base), tc = tokens(cand);
  if (tb.length && tc.length && (tc.every(x => tb.includes(x)) || tb.every(x => tc.includes(x))) && Math.min(...[...tb, ...tc].map(x => x.length)) >= 4) return { rank: 2, L: pb.length };
  return null;
}

function confidence(rank, L, hadSuffix, hamlet, otherBlock) {
  if (otherBlock) return 'LOW';
  if (hamlet) return 'LOW';
  if (rank === 0) return hadSuffix ? 'MED' : 'HIGH';
  if (rank === 1) return L >= 4 ? 'HIGH' : 'MED';
  if (rank === 2) return 'MED';
  if (rank === 3) return L >= 5 ? 'MED' : 'LOW';
  return 'LOW';
}

// rows: {district, block, village, name, phone}; taken: Set("d|b|v") — जिन गाँवों का सरपंच पहले से सही नाम से दर्ज है
function suggest(rows, HR, taken) {
  const pairs = [], info = rows.map(r => {
    const res = resolveBlock(HR, r.district, r.block);
    const base = stripSuffix(r.village);
    return { r, res, base, hadSuffix: base !== String(r.village).replace(/\(.*?\)/g, '').trim(),
      hamlet: /^(dhani|dera|basti)\b|\b(colony|farm)\b/i.test(r.village) };
  });
  info.forEach((x, i) => {
    if (!x.res) return;
    const { d, b } = x.res;
    const free = (bb, v) => !taken.has(d + '|' + bb + '|' + v);
    for (const v of new Set(HR[d][b])) if (free(b, v)) {
      const k = rankOf(x.base, v); if (k) pairs.push({ i, d, b, v, ...k, other: false });
    }
    for (const bb of Object.keys(HR[d])) if (bb !== b) for (const v of new Set(HR[d][bb])) if (free(bb, v)) {
      const k = rankOf(x.base, v); if (k && k.rank <= 1 && k.L >= 5) pairs.push({ i, d, b: bb, v, rank: 5, L: k.L, other: true });
    }
  });
  pairs.sort((p, q) => p.rank - q.rank || p.i - q.i);
  const usedRow = new Set(), usedVil = new Set(), out = new Array(rows.length).fill(null);
  for (const p of pairs) {
    const key = p.d + '|' + p.b + '|' + p.v;
    if (usedRow.has(p.i) || usedVil.has(key)) continue;
    usedRow.add(p.i); usedVil.add(key);
    const x = info[p.i];
    out[p.i] = { d: p.d, b: p.b, v: p.v, conf: confidence(p.rank, p.L, x.hadSuffix, x.hamlet, p.other),
      why: p.other ? 'दूसरे ब्लॉक में वही नाम' : ['नाम एक जैसा', 'उच्चारण एक जैसा', 'नाम का हिस्सा मेल', 'स्पेलिंग में थोड़ा फ़र्क', 'स्पेलिंग में फ़र्क'][Math.min(p.rank, 4)] };
  }
  return { out, info };
}

module.exports = { suggest, phon, skel, resolveBlock };

if (require.main === module) (async () => {
  const HR = new Function(fs.readFileSync(DATA, 'utf8') + '; return haryanaFullData;')();
  const rows = fs.readFileSync(REPORT, 'utf8').replace(/^\ufeff/, '').split(/\r?\n/).slice(1).filter(Boolean).map(l => {
    const [district, block, village, name, phone] = l.split(',').map(s => (s || '').trim()); return { district, block, village, name, phone };
  });

  const taken = new Set();
  if (!NO_DB) {
    const mongoose = require('mongoose'); const Official = require('./models/Official');
    await mongoose.connect(process.env.MONGO_URI);
    const docs = await Official.collection.find({ level: 1, department: 'पंचायत' }, { projection: { district: 1, block: 1, village: 1 } }).toArray();
    docs.forEach(o => { if (HR[o.district] && HR[o.district][o.block] && HR[o.district][o.block].includes(o.village)) taken.add(o.district + '|' + o.block + '|' + o.village); });
    console.log(`DB में सही नाम वाले गाँव (भरे हुए): ${taken.size}`);
    await mongoose.disconnect();
  } else console.log('⚠️ --no-db: भरे हुए गाँवों की जाँच नहीं होगी');

  const { out } = suggest(rows, HR, taken);
  const cnt = { HIGH: 0, MED: 0, LOW: 0, NONE: 0 };
  const csv = ['approve,confidence,district_old,block_old,village_old,district_new,block_new,village_new,name,phone,why'];
  rows.forEach((r, i) => {
    const s = out[i]; cnt[s ? s.conf : 'NONE']++;
    if (!s) return;
    csv.push([s.conf === 'HIGH' ? 'Y' : '', s.conf, r.district, r.block, r.village, s.d, s.b, s.v, r.name, r.phone, s.why].map(x => String(x ?? '').replace(/,/g, ' ')).join(','));
  });
  fs.writeFileSync(path.join(__dirname, 'fix-suggestions.csv'), '\ufeff' + csv.join('\n'));
  const none = rows.filter((_, i) => !out[i]);
  fs.writeFileSync(path.join(__dirname, 'fix-nomatch.csv'), '\ufeff' + ['district,block,village,name,phone'].concat(none.map(r => [r.district, r.block, r.village, r.name, r.phone].join(','))).join('\n'));
  console.log(`कुल बचे: ${rows.length}`);
  console.log(`  HIGH (पक्का, Y पहले से):  ${cnt.HIGH}`);
  console.log(`  MED  (देखकर Y लिखें):     ${cnt.MED}`);
  console.log(`  LOW  (शक वाले):           ${cnt.LOW}`);
  console.log(`  कोई सुझाव नहीं:           ${cnt.NONE}  (fix-nomatch.csv)`);
  console.log('→ fix-suggestions.csv खोलकर देखें।');
})().catch(e => { console.error(e); process.exit(1); });