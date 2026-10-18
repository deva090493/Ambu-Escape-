// Awards points for a finished level. The server owns the level number and the points,
// so players cannot edit them from the phone.
const { db, FieldValue, HttpError, handler, getSettings, todayIST } = require('../lib/fb');

exports.handler = handler(async ({ body, user }) => {
  const level = parseInt(body.level, 10);
  const hearts = Math.max(0, Math.min(3, parseInt(body.hearts, 10) || 0));
  const ref = db.doc(`users/${user.uid}`);

  return db.runTransaction(async (tx) => {
    const s = await getSettings(tx);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, 'Profile இல்ல. மறுபடி login செய்யுங்க.');
    const u = snap.data();
    if (u.blocked) throw new HttpError(403, 'உங்க account block செய்யப்பட்டிருக்கு.');
    if (level !== u.level) throw new HttpError(409, 'Level பொருந்தல', { level: u.level });

    const now = Date.now();
    if (now - (u.lastLevelAt || 0) < s.minSecondsPerLevel * 1000) {
      throw new HttpError(429, 'ரொம்ப வேகமா இருக்கு. கொஞ்சம் பொறுங்க.');
    }
    const today = todayIST();
    const day = u.day && u.day.date === today ? u.day : { date: today, levels: 0, ads: 0 };

    // After the daily cap the player still moves to the next level, just without points.
    const paid = day.levels < s.dailyLevelCap;
    const earned = paid ? s.pointsPerLevel + s.heartBonus * hearts : 0;

    tx.update(ref, {
      level: u.level + 1,
      points: FieldValue.increment(earned),
      totalEarned: FieldValue.increment(earned),
      lastLevelAt: now,
      day: { ...day, levels: day.levels + 1 },
    });
    tx.set(db.doc('stats/global'), {
      levels: FieldValue.increment(1),
      pointsIssued: FieldValue.increment(earned),
    }, { merge: true });

    return { ok: true, earned, level: u.level + 1, capped: !paid };
  });
});
