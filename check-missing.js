require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Official = require('./models/Official');
const HR = new Function(fs.readFileSync(path.join(__dirname, 'haryana-data.js'), 'utf8') + '; return haryanaFullData;')();

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const bdos = await Official.find({ level: 2, department: 'BDO' });
  const have = new Set(bdos.map(b => b.district + '|' + b.block));
  const dcs = new Set((await Official.find({ level: 3 })).map(d => d.district));

  let missing = 0;
  for (const d of Object.keys(HR)) {
    if (!dcs.has(d)) console.log('❌ DC नहीं है:', d);
    for (const b of Object.keys(HR[d])) {
      if (!have.has(d + '|' + b)) { console.log('⚠️ BDO नहीं है:', d, '/', b); missing++; }
    }
  }
  console.log('\nबिना BDO वाले ब्लॉक:', missing);
  process.exit(0);
})();