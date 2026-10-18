// Google Play requires apps with sign-up to let users delete their account (in app and on the web).
// Deletes the player profile and login. Pending redeem requests are cancelled (points are lost).
// The phone's device record is kept so a deleted account cannot be re-created on the same phone
// for extra sign-up rewards; the privacy policy says so.
const { admin, db, FieldValue, handler } = require('../lib/fb');

exports.handler = handler(async ({ user }) => {
  const uid = user.uid;
  const userRef = db.doc(`users/${uid}`);
  const [snap, pending] = await Promise.all([
    userRef.get(),
    db.collection('redeems').where('uid', '==', uid).where('status', '==', 'pending').get(),
  ]);

  const batch = db.batch();
  pending.forEach((d) => batch.update(d.ref, { status: 'cancelled', note: 'Account deleted by user', settledAt: FieldValue.serverTimestamp() }));
  if (snap.exists) {
    batch.delete(userRef);
    batch.set(db.doc('stats/global'), { users: FieldValue.increment(-1), accountsDeleted: FieldValue.increment(1) }, { merge: true });
  }
  await batch.commit();
  await admin.auth().deleteUser(uid).catch((e) => { if (e.code !== 'auth/user-not-found') throw e; });
  return { ok: true };
});
