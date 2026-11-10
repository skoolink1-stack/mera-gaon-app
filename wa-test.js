// ऐप और DB के बिना, सीधे Meta से जाँच: (1) नंबर की हालत (2) टेम्पलेट भेजना
// चलाने का तरीका (टोकन टाइप करते समय दिखेगा नहीं, history में भी नहीं जाएगा):
//   read -s "T?Token: "; echo; WA_TOKEN="$T" WA_PHONE_ID=आपका_phone_number_id node wa-test.js 919896339174
const to = process.argv[2];
const { WA_TOKEN, WA_PHONE_ID, WA_TEMPLATE = 'mera_gaon_sarpanch_alert', WA_LANG = 'hi', WA_API_VERSION = 'v25.0' } = process.env;
if (!to || !WA_TOKEN || !WA_PHONE_ID) { console.log('चाहिए: प्राप्त करने वाला नंबर (91 के साथ), WA_TOKEN और WA_PHONE_ID'); process.exit(1); }
const base = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}`;
const H = { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' };
(async () => {
  console.log('--- 1) नंबर की हालत ---');
  let r = await fetch(`${base}?fields=display_phone_number,verified_name,status,quality_rating,platform_type`, { headers: H });
  console.log('HTTP', r.status, JSON.stringify(await r.json().catch(() => ({})), null, 2));

  console.log('--- 2) टेम्पलेट भेजना ---');
  r = await fetch(`${base}/messages`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: WA_TEMPLATE, language: { code: WA_LANG },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Suman Kumari' }, { type: 'text', text: 'Shekhupur Daroli' }] }] }
    })
  });
  console.log('HTTP', r.status, JSON.stringify(await r.json().catch(() => ({})), null, 2));
})().catch(e => console.log('नेटवर्क एरर:', e.message));