// Player asks to redeem points. Points are taken now; admin pays and marks it paid,
// or rejects it and the points go back.
const { db, FieldValue, HttpError, handler, getSettings } = require('../lib/fb');

exports.handler = handler(async ({ body, user }) => {
  const rewardId = String(body.rewardId || '');
  const target = String(body.target || '').trim().slice(0, 200);
  if (target.length < 4) throw new HttpError(400, 'விவரம் சரியா type செய்யுங்க');

  const userRef = db.doc(`users/${user.uid}`);
  const pendingQ = db.collection('redeems').where('uid', '==', user.uid).where('status', '==', 'pending').limit(1);

  return db.runTransaction(async (tx) => {
    const s = await getSettings(tx);
    const reward = (s.rewards || []).find((r) => r.id === rewardId);
    if (!reward) throw new HttpError(400, 'இந்த reward இப்போ இல்ல');

    const [snap, pending] = await Promise.all([tx.get(userRef), tx.get(pendingQ)]);
    if (!snap.exists) throw new HttpError(404, 'Profile இல்ல');
    const u = snap.data();
    if (u.blocked) throw new HttpError(403, 'உங்க account block செய்யப்பட்டிருக்கு.');
    if (!pending.empty) throw new HttpError(409, 'முந்தைய request இன்னும் pending-ல இருக்கு. அது முடிஞ்சதும் அடுத்தது கேளுங்க.');
    if ((u.points || 0) < reward.cost) throw new HttpError(400, `இன்னும் ${reward.cost - u.points} pts வேணும்`);

    const rRef = db.collection('redeems').doc();
    tx.update(userRef, { points: FieldValue.increment(-reward.cost) });
    tx.set(rRef, {
      uid: user.uid, name: u.name || '', email: u.email || '',
      rewardId: reward.id, title: reward.title, cost: reward.cost, target,
      status: 'pending', createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc('stats/global'), { redeemRequests: FieldValue.increment(1) }, { merge: true });
    return { ok: true, id: rRef.id };
  });
});
