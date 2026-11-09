// जिन सरपंचों का गाँव haryana-data.js में है ही नहीं, उनके पंचायत-नाम को सूची में नए गाँव के रूप में जोड़ता है
// ⚠️ असली haryana-data.js को नहीं छेड़ता — नई फ़ाइल haryana-data.new.js बनाता है; देखकर आप खुद बदलेंगे
//   node add-extra-villages.js              (fix-report.csv का इस्तेमाल करता है — पहले node fix-village-names.js --dry चला लें)
// बनने वाली फ़ाइलें: haryana-data.new.js, extra-added.csv (क्या जुड़ा), extra-skipped.csv (क्या छोड़ा और क्यों)
const fs = require('fs'), path = require('path');
const { resolveBlock, phon } = require('./suggest-fixes');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const REPORT = arg('--report', path.join(__dirname, 'fix-report.csv'));
const DATA = arg('--data', path.join(__dirname, 'haryana-data.js'));
const OUT = arg('--out', path.join(__dirname, 'haryana-data.new.js'));
const GENERIC = /^(dhani|dera|basti|colony|farm|bass|bas)$/i;
const csvLine = a => a.map(x => String(x ?? '').replace(/,/g, ' ')).join(',');

function run(HR, rows) {
  const added = [], skipped = [], seen = new Set();
  const have = (d, b) => new Set(HR[d][b].map(phon));
  for (const r of rows) {
    const res = resolveBlock(HR, r.district, r.block);
    if (!res) { skipped.push([r, 'ज़िला/ब्लॉक नहीं मिला']); continue; }
    const { d, b } = res, exist = have(d, b);
    let name = String(r.village).replace(/\(.*?\)/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    const m = name.match(/^(.*?)[\s\-]+(\d{1,2})$/);          // "Bamla-2" जैसा गिनती वाला हिस्सा
    if (m) {
      const base = m[1].trim();
      if (base.length < 4 || GENERIC.test(base)) { skipped.push([r, 'नाम साफ़ नहीं']); continue; }
      if (exist.has(phon(base))) { skipped.push([r, 'उसी गाँव का दूसरा पंचायत (एक गाँव = एक सरपंच)']); continue; }
      name = base;
    }
    if (name.length < 3 || !/[a-z]{3}/i.test(name)) { skipped.push([r, 'नाम साफ़ नहीं']); continue; }
    if (exist.has(phon(name))) { skipped.push([r, 'उस नाम का गाँव सूची में पहले से है (दूसरा पंचायत)']); continue; }
    const key = d + '|' + b + '|' + phon(name);
    if (seen.has(key)) { skipped.push([r, 'इसी नाम का एक और सरपंच भी है']); continue; }
    seen.add(key);
    HR[d][b].push(name);
    added.push({ d, b, name, r });
  }
  for (const a of new Set(added.map(x => x.d + '||' + x.b))) { const [d, b] = a.split('||'); HR[d][b].sort((x, y) => x.localeCompare(y, 'en', { sensitivity: 'base' })); }
  return { added, skipped };
}
module.exports = { run };

if (require.main === module) {
  const src = fs.readFileSync(DATA, 'utf8');
  const HR = new Function(src + '; return haryanaFullData;')();
  const rows = fs.readFileSync(REPORT, 'utf8').replace(/^\ufeff/, '').split(/\r?\n/).slice(1).filter(Boolean).map(l => {
    const [district, block, village, name, phone] = l.split(',').map(s => (s || '').trim()); return { district, block, village, name, phone };
  });
  const { added, skipped } = run(HR, rows);
  const nd = Object.keys(HR).length, nv = Object.values(HR).reduce((s, bl) => s + Object.values(bl).reduce((t, a) => t + a.length, 0), 0);
  const header = src.split('const haryanaFullData')[0].replace(/कुल \d+ ज़िले, \d+ गाँव/, `कुल ${nd} ज़िले, ${nv} गाँव`).replace(/\s+$/, '\n');
  fs.writeFileSync(OUT, header + `// + ${added.length} पंचायत-नाम सरपंच-सूची (SPIO PDF) से जोड़े गए, ताकि उनके गाँव के लोग रजिस्टर कर सकें\nconst haryanaFullData = ` + JSON.stringify(HR, null, 2) + ';\n');
  fs.writeFileSync(path.join(__dirname, 'extra-added.csv'), '\ufeff' + ['district,block,village_added,sarpanch,phone'].concat(added.map(a => csvLine([a.d, a.b, a.name, a.r.name, a.r.phone]))).join('\n'));
  fs.writeFileSync(path.join(__dirname, 'extra-skipped.csv'), '\ufeff' + ['district,block,village,sarpanch,phone,reason'].concat(skipped.map(([r, why]) => csvLine([r.district, r.block, r.village, r.name, r.phone, why]))).join('\n'));
  const why = {}; skipped.forEach(([, w]) => why[w] = (why[w] || 0) + 1);
  console.log(`रिपोर्ट में कुल: ${rows.length}`);
  console.log(`  सूची में जोड़े गए: ${added.length}   → ${path.basename(OUT)} (अब कुल ${nv} गाँव)`);
  console.log(`  छोड़े गए:         ${skipped.length}`);
  Object.entries(why).forEach(([w, n]) => console.log(`      ${n}  ${w}`));
  console.log('→ extra-added.csv खोलकर देख लें, फिर haryana-data.new.js को haryana-data.js बना दें।');
}