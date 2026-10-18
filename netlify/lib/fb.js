// Shared helpers for all Netlify functions.
// Needs the env variable FIREBASE_SERVICE_ACCOUNT = full JSON of a Firebase service account key.
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
  });
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Default game economy. Admin panel overrides these in Firestore doc settings/app.
const DEFAULTS = {
  pointsPerLevel: 4,      // points for finishing a level
  heartBonus: 1,          // extra points per heart left (max 3 hearts)
  pointsPerAd: 3,         // points per fully watched rewarded ad (purpose "points")
  ratePer1000: 5,         // rupees per 1000 points (shown to users)
  dailyLevelCap: 60,      // max paid levels per user per day
  dailyAdCap: 15,         // max paid rewarded ads per user per day
  minSecondsPerLevel: 8,  // anti-bot: fastest allowed time between two level claims
  interstitialEvery: 2,   // show an interstitial ad after every N levels
  rewards: [
    { id: 'upi5',  title: 'UPI cash ₹5',          cost: 1000,  field: 'UPI ID' },
    { id: 'rc10',  title: 'Mobile recharge ₹10',  cost: 2000,  field: 'Mobile number' },
    { id: 'v25',   title: 'Shopping voucher ₹25', cost: 5000,  field: 'Email' },
  ],
};

async function getSettings(tx) {
  const ref = db.doc('settings/app');
  const snap = tx ? await tx.get(ref) : await ref.get();
  return { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
function reply(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
class HttpError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra || {}; } }

async function authUser(event) {
  const h = event.headers.authorization || event.headers.Authorization || '';
  const token = h.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Login செய்யுங்க');
  try { return await admin.auth().verifyIdToken(token); }
  catch (e) { throw new HttpError(401, 'Login காலாவதி ஆயிடுச்சு, மறுபடி login செய்யுங்க'); }
}

// India date, so daily limits reset at midnight IST.
function todayIST() { return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); }

// Wraps a POST handler with CORS, JSON parsing and error replies.
function handler(fn) {
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
    if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const user = await authUser(event);
      return reply(200, await fn({ body, user, event }));
    } catch (e) {
      if (e instanceof HttpError) return reply(e.code, { error: e.message, ...e.extra });
      console.error(e);
      return reply(500, { error: 'Server பிழை. கொஞ்ச நேரம் கழிச்சு முயற்சி செய்யுங்க.' });
    }
  };
}

module.exports = { admin, db, FieldValue, DEFAULTS, getSettings, reply, HttpError, handler, todayIST };
