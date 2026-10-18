import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---------------------------------------------------------------------------
// AdMob IDs. These are Google's TEST IDs — safe for testing.
// Before Play Store release, replace all four with YOUR ids from admob.google.com.
// Never click your own real ads.
// ---------------------------------------------------------------------------
val admobAppId = "ca-app-pub-3940256099942544~3347511713"
val bannerId = "ca-app-pub-3940256099942544/9214589741"
val interstitialId = "ca-app-pub-3940256099942544/1033173712"
val rewardedId = "ca-app-pub-3940256099942544/5224354917"

// Signing key: same key every build, so new APKs install over the old one.
// On GitHub the key comes from repo Secrets (KEYSTORE_BASE64 + KEYSTORE_PASSWORD),
// which the workflow writes to release.keystore. Locally, keystore.properties also works.
val ksProps = Properties().apply {
    val f = file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
    val envPass = System.getenv("KEYSTORE_PASSWORD")
    if (!envPass.isNullOrEmpty() && file("release.keystore").exists()) {
        setProperty("storeFile", "release.keystore")
        setProperty("storePassword", envPass)
        setProperty("keyPassword", envPass)
        setProperty("keyAlias", "ambu")
    }
}
val hasReleaseKey = ksProps.isNotEmpty()

android {
    namespace = "com.ambuescape.game"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.ambuescape.game"
        minSdk = 26
        targetSdk = 36
        // GitHub Actions run number → every build gets a higher version automatically.
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"

        manifestPlaceholders["admobAppId"] = admobAppId
        buildConfigField("String", "BANNER_ID", "\"$bannerId\"")
        buildConfigField("String", "INTERSTITIAL_ID", "\"$interstitialId\"")
        buildConfigField("String", "REWARDED_ID", "\"$rewardedId\"")
    }

    signingConfigs {
        create("release") {
            if (hasReleaseKey) {
                storeFile = file(ksProps.getProperty("storeFile"))
                storePassword = ksProps.getProperty("storePassword")
                keyAlias = ksProps.getProperty("keyAlias")
                keyPassword = ksProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Without the real key (Secrets not set yet) the build is signed with a debug key:
            // fine for testing on your phone, NOT for Play Store.
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("com.google.android.gms:play-services-ads:24.4.0")
}
