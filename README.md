# அம்பு Escape — Setup வழிகாட்டி

Arrow puzzle game. Users விளையாடி points சேர்ப்பாங்க, 1000 pts ஆனதும் பணம் / recharge / product redeem பண்ணுவாங்க. Ad வருமானத்தில் users-க்கு போக மீதி உங்க லாபம்.

## Folder-ல என்ன இருக்கு

| Folder / file | என்ன |
|---|---|
| `android/` | Android app (Kotlin). Game = `android/app/src/main/assets/index.html` |
| `admin/index.html` | Admin panel (Netlify-ல ஓடும்) |
| `netlify/functions/` | Server: register, claim-level, redeem, admob-ssv |
| `firestore.rules` | Firebase பாதுகாப்பு rules |
| `.github/workflows/build-android.yml` | GitHub-ல APK + AAB build |
| Signing key | Repo-ல இல்ல. GitHub **Secrets**-ல (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`). Backup: `ambu-release.keystore` + `github-secrets.txt` |

எல்லாமே free plan-லயே ஓடும்: Firebase Spark, Netlify free, GitHub Actions.

---

## 1. GitHub

1. Repo: `github.com/deva090493/Ambu-Escape-` (code ஏற்கனவே push ஆகியிருக்கு).
2. Repo → **Settings → Secrets and variables → Actions → New repository secret** → `github-secrets.txt`-ல உள்ள இரண்டு secrets-ஐயும் (பெயர் + value) சேருங்க. இது இல்லன்னா build debug key-ல sign ஆகும், Play Store ஏற்காது.
3. `ambu-release.keystore`, `github-secrets.txt` இரண்டையும் Google Drive-ல backup வெச்சுக்கோங்க. இது போனா Play Store-ல app update பண்ண கஷ்டம்.
4. ஒவ்வொரு build-க்கும் பிறகு APK, AAB இரண்டும் **build-output** branch-லயும் வரும் (phone-ல இருந்து download பண்ண எளிது).

## 2. Firebase (புது project)

Hit Transport project-ல free quota பகிராம இருக்க, இதுக்கு **தனி project** உருவாக்குங்க.

1. console.firebase.google.com → **Add project** → `ambu-escape`.
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. Authentication → **Settings → Authorized domains → Add domain**:
   - `appassets.androidplatform.net` (app-க்குள்ள login ஆக இது கட்டாயம்)
   - உங்க Netlify domain (step 3-க்கு பிறகு)
4. **Build → Firestore Database → Create database** → location `asia-south1 (Mumbai)` → Production mode.
5. Firestore → **Rules** tab → `firestore.rules` file-ல உள்ளதை முழுசா paste பண்ணி **Publish**.
6. Project settings (⚙) → **Your apps → Web (</>)** → app register பண்ணுங்க → வரும் `firebaseConfig`-ல இருந்து `apiKey`, `authDomain`, `projectId`, `appId` நாலையும் copy பண்ணி **இரண்டு இடத்துல** paste பண்ணுங்க:
   - `android/app/src/main/assets/index.html` → `CONFIG.firebase`
   - `admin/index.html` → `FIREBASE`
7. Project settings → **Service accounts → Generate new private key** → ஒரு `.json` file download ஆகும். இது ரகசியம். GitHub-ல போடாதீங்க. அடுத்த step-க்கு தேவை.

## 3. Netlify (server + admin panel)

1. app.netlify.com → **Add new site → Import from Git → GitHub** → இந்த repo.
2. Build settings தானா `netlify.toml`-ல இருந்து எடுத்துக்கும் (publish = `admin`). Deploy பண்ணுங்க.
3. **Site configuration → Environment variables → Add**:
   - Key: `FIREBASE_SERVICE_ACCOUNT`
   - Value: step 2.7-ல download ஆன json file-ல உள்ள **முழு text**
4. **Deploys → Trigger deploy** (env variable சேர்த்த பிறகு மறுபடி deploy கட்டாயம்).
5. Site name மாத்துங்க (உதா: `ambuescape` → `https://ambuescape.netlify.app`).
6. `android/app/src/main/assets/index.html`-ல `apiBase`-ஐ மாத்துங்க:
   `apiBase: "https://ambuescape.netlify.app/api"`
7. Firebase Authorized domains-ல `ambuescape.netlify.app` சேர்த்துடுங்க.

## 4. Admin account

1. App அல்லது Firebase console (Authentication → Add user) மூலமா உங்க email-ல ஒரு account உருவாக்குங்க.
2. Authentication list-ல அந்த user-ஓட **User UID**-ஐ copy பண்ணுங்க.
3. Firestore → **Start collection** → Collection ID: `admins` → Document ID: அந்த UID → ஏதாவது ஒரு field (உதா `name` = `Deva`) → Save.
4. `https://ambuescape.netlify.app` திறந்து login பண்ணுங்க → **Settings → Save settings** ஒரு முறை அழுத்துங்க.

## 5. APK build

1. GitHub repo → **Actions → Build Android app → Run workflow** (அல்லது `android/` folder-ல எதையாவது மாத்தி push பண்ணா தானா ஓடும்).
2. முடிஞ்சதும் அந்த run-ஐ திறந்து **Artifacts**:
   - `ambu-escape-apk-N` → phone-ல install பண்ண
   - `ambu-escape-playstore-aab-N` → Play Store-க்கு
3. Signing key ஒன்றே என்பதால், புது APK பழையதுக்கு மேலேயே install ஆகும் (uninstall தேவையில்லை).

இப்போ ads எல்லாம் **Google test ads** ("Test Ad" என்று போடும்). அதுல click பண்ணலாம், பிரச்சனை இல்ல.

## 6. AdMob (உண்மையான ads)

1. admob.google.com → account உருவாக்குங்க (payment-க்கு PAN, bank details).
2. **Apps → Add app → Android**. Play Store-ல இன்னும் இல்லன்னா "No" சொல்லுங்க, பிறகு link பண்ணலாம்.
3. மூணு **Ad units** உருவாக்குங்க: Banner, Interstitial, Rewarded.
4. Rewarded unit → **Server-side verification** → Callback URL:
   `https://ambuescape.netlify.app/api/admob-ssv` → **Verify URL** → Save.
5. `android/app/build.gradle.kts`-ல மேல உள்ள நாலு ID-யையும் (`admobAppId`, `bannerId`, `interstitialId`, `rewardedId`) உங்க ID-ஆல மாத்துங்க → push → புது build.

முக்கியம்:
- உங்க சொந்த **real** ads-ல நீங்களே click பண்ணாதீங்க. Account ban ஆகும். Test-க்கு AdMob → Settings → **Test devices**-ல உங்க phone-ஐ சேர்த்துக்கோங்க.
- "Ad பார்த்து points" **rewarded ad-க்கு மட்டும்** தான். Banner அல்லது interstitial ad-ஐ click பண்ணச் சொல்லி reward கொடுக்கக் கூடாது (AdMob policy). இந்த app அப்படித்தான் செட் ஆகியிருக்கு.
- Test ads-க்கு SSV callback சரியா வராது. அதனால ad points real ID போட்ட பிறகுதான் சேரும். Level points உடனே வேலை செய்யும்.

## 7. Google Play Store

1. play.google.com/console → developer account ($25 ஒரு முறை).
2. **Create app** → AAB upload.
3. **Privacy policy URL** கட்டாயம். Admin site-லயே ஒரு page போடலாம்; வேணும்னா அடுத்து எழுதித் தரேன்.
4. **Data safety**-ல சொல்ல வேண்டியது: Email, Name, Device ID, Advertising ID (ads-க்கு), UPI ID / mobile (redeem-க்கு).
5. **Ads**: "Yes, contains ads". **Target audience**: 18+.
6. App விவரத்துல rewards விதிமுறைகளை தெளிவா எழுதுங்க: points-க்கு நேரடி பண மதிப்பு இல்ல, admin approve செய்த பிறகுதான் கிடைக்கும், limits உண்டு. இது gambling அல்ல (பணம் கட்டி விளையாடுவது இல்ல), அதனால real-money gaming policy-க்குள் வராது.
7. புது personal developer account-க்கு Google **closed testing** (12 testers, 14 நாள்) கேட்கும். நண்பர்கள் 12 பேரை tester-ஆ சேர்த்துக்கோங்க.

## 8. தினசரி வேலை (Admin)

- **Redeems** tab → Pending → UPI ID-ஐ **Copy** → GPay/PhonePe-ல அனுப்புங்க → **Paid** (transaction ID note-ல போடலாம்).
- சந்தேகமான request (ஒரே நாள்ல அதிக points, ஒரே UPI-க்கு பல accounts) → **Reject** (points திரும்ப போகும்) அல்லது Users tab-ல **Block**.
- **Dashboard** → payout விகிதம் 50%-க்கு மேல போனா, Settings-ல points குறைங்க.

## 9. லாபக் கணக்கு (மனசுல வெச்சுக்கோங்க)

- India-ல ஒரு active user ஒரு நாளைக்கு சுமார் ₹0.5 முதல் ₹1 ad வருமானம் கொடுப்பாங்க.
- Default settings: 1000 pts = ₹5, level-க்கு 4 முதல் 7 pts. ஒரு user 1000 pts சேர்க்க சுமார் 2–3 வாரம் ஆகும். அந்த காலத்துல அவங்க கொடுக்கற ad வருமானம் ₹5-ஐ விட அதிகம், மீதி உங்க லாபம்.
- Settings-ல points அதிகமாக்கினா users சந்தோஷப்படுவாங்க, ஆனா உங்களுக்கு நஷ்டம். Dashboard-ல payout % பார்த்து முடிவு பண்ணுங்க.

## 10. Free limits

- **Firebase Spark:** ஒரு நாளைக்கு 50,000 reads, 20,000 writes. சுமார் 800–1000 daily users வரை போதும்.
- **Netlify free:** function calls-க்கு மாத limit உண்டு (ஒரு user ஒரு நாளைக்கு சுமார் 10–12 calls). Netlify dashboard-ல usage பாருங்க.
- Users அதிகமானா Firebase Blaze plan-க்கு மாறலாம். அப்போ ad வருமானமும் அதிகமா இருக்கும்.

## பாதுகாப்பு எப்படி

- Points, level, redeem எல்லாமே **server**-ல தான் மாறும். Phone-ல இருந்து யாரும் points-ஐ நேரடியா மாத்த முடியாது (Firestore rules தடுக்கும்).
- Ad points: Google கையெழுத்து (signature) சரியா இருந்தா மட்டும் சேரும். ஒரே ad-க்கு இரண்டு முறை சேராது.
- ஒரு phone-க்கு ஒரு account. Level-க்கு இடையில் குறைந்தது 8 நொடி. நாள் limits உண்டு. ஒரு நேரத்துல ஒரு pending redeem மட்டும்.
