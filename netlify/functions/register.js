// Creates the player profile on first login. One account per phone (Android ID).
const { db, FieldValue, HttpError, handler } = require('../lib/fb');

exports.handler = handler(async ({ body, user }) => {
  const name = String(body.name || '').trim().slice(0, 40);
  const deviceId = String(body.deviceId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!deviceId) throw new HttpError(400, 'Device ID கிடைக்கல');

  const userRef = db.doc(`users/${user.uid}`);
  const devRef = db.doc(`devices/${deviceId}`);

  return db.runTransaction(async (tx) => {
    const [u, d] = await Promise.all([tx.get(userRef), tx.get(devRef)]);
    if (u.exists) return { ok: true, existing: true };
    if (d.exists && d.data().uid !== user.uid) {
      throw new HttpError(409, 'இந்த phone-ல ஏற்கனவே வேற account இருக்கு. அந்த account-லயே login செய்யுங்க.');
    }
    tx.set(userRef, {
      name: name || (user.email || '').split('@')[0],
      email: user.email || '',
      points: 0, totalEarned: 0, level: 1,
      deviceId, blocked: false,
      lastLevelAt: 0,
      day: { date: '', levels: 0, ads: 0 },
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(devRef, { uid: user.uid, at: FieldValue.serverTimestamp() });
    tx.set(db.doc('stats/global'), { users: FieldValue.increment(1) }, { merge: true });
    return { ok: true, existing: false };
  });
});
