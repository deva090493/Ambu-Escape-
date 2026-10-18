// AdMob server-side verification (SSV) callback.
// Google calls this URL after a player fully watches a rewarded ad. We check Google's
// signature, then add points only for ads shown with custom_data = "points".
// Set this URL in AdMob > Rewarded ad unit > Server-side verification:
//   https://YOUR-SITE.netlify.app/api/admob-ssv
const crypto = require('crypto');
const { db, FieldValue, getSettings, todayIST } = require('../lib/fb');

const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let keyCache = { at: 0, keys: {} };

async function getKeys() {
  if (Date.now() - keyCache.at < 6 * 3600e3 && Object.keys(keyCache.keys).length) return keyCache.keys;
  const res = await fetch(KEYS_URL);
  const json = await res.json();
  const keys = {};
  for (const k of json.keys || []) keys[String(k.keyId)] = k.pem;
  keyCache = { at: Date.now(), keys };
  return keys;
}

function ok(msg) { return { statusCode: 200, body: msg || 'ok' }; }

exports.handler = async (event) => {
  const raw = event.rawQuery || '';
  // AdMob console "Verify URL" sends a request without a signature; answer 200 so it passes.
  const sigIdx = raw.indexOf('&signature=');
  if (sigIdx < 0) return ok('no signature');

  const message = raw.slice(0, sigIdx);
  const params = new URLSearchParams(raw);
  const signature = params.get('signature') || '';
  const keyId = params.get('key_id') || '';

  try {
    const keys = await getKeys();
    const pem = keys[keyId];
    if (!pem) return { statusCode: 400, body: 'unknown key' };
    const sig = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const valid = crypto.verify('sha256', Buffer.from(message), { key: pem, dsaEncoding: 'der' }, sig);
    if (!valid) return { statusCode: 400, body: 'bad signature' };
  } catch (e) {
    console.error('ssv verify', e);
    return { statusCode: 500, body: 'verify error' };
  }

  const uid = (params.get('user_id') || '').replace(/[^a-zA-Z0-9]/g, '');
  const purpose = params.get('custom_data') || '';
  const txId = (params.get('transaction_id') || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!uid || !txId) return ok('missing ids');

  const userRef = db.doc(`users/${uid}`);
  const txRef = db.doc(`adtx/${txId}`);

  try {
    await db.runTransaction(async (tx) => {
      const s = await getSettings(tx);
      const [seen, snap] = await Promise.all([tx.get(txRef), tx.get(userRef)]);
      if (seen.exists || !snap.exists) return; // duplicate callback or unknown user
      const u = snap.data();
      const today = todayIST();
      const day = u.day && u.day.date === today ? u.day : { date: today, levels: 0, ads: 0 };
      const paid = purpose === 'points' && !u.blocked && day.ads < s.dailyAdCap;
      const earned = paid ? s.pointsPerAd : 0;

      tx.set(txRef, { uid, purpose, earned, at: FieldValue.serverTimestamp() });
      tx.update(userRef, {
        points: FieldValue.increment(earned),
        totalEarned: FieldValue.increment(earned),
        day: { ...day, ads: day.ads + (purpose === 'points' ? 1 : 0) },
      });
      tx.set(db.doc('stats/global'), {
        rewardedAds: FieldValue.increment(1),
        pointsIssued: FieldValue.increment(earned),
      }, { merge: true });
    });
  } catch (e) {
    console.error('ssv award', e);
    return { statusCode: 500, body: 'award error' }; // AdMob retries later
  }
  return ok();
};
