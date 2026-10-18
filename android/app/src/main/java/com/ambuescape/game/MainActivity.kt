package com.ambuescape.game

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions

/**
 * The game itself is assets/index.html running in a WebView.
 * This activity only adds what a web page cannot do: real AdMob ads and the phone's device ID.
 * JavaScript calls window.AndroidApp.*, and gets answers through window.onAdResult(purpose, ok).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private var interstitial: InterstitialAd? = null
    private var rewarded: RewardedAd? = null
    private var loadingRewarded = false
    private var loadingInterstitial = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Keep content clear of the status bar and navigation bar (Android 15+ draws edge to edge).
        val root = findViewById<View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        web = findViewById(R.id.web)
        // Serve assets from a real https address so Firebase login works inside the WebView.
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == "appassets.androidplatform.net") return false
                // Any other link opens in the phone's browser.
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                return true
            }
        }
        web.addJavascriptInterface(Bridge(), "AndroidApp")
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                js("window.onBackButton && window.onBackButton()")
            }
        })

        MobileAds.initialize(this) {
            loadBanner()
            loadInterstitial()
            loadRewarded()
        }
    }

    private fun loadBanner() {
        val holder = findViewById<FrameLayout>(R.id.banner)
        val adView = AdView(this)
        adView.adUnitId = BuildConfig.BANNER_ID
        val widthDp = (resources.displayMetrics.widthPixels / resources.displayMetrics.density).toInt()
        adView.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, widthDp))
        holder.removeAllViews()
        holder.addView(adView)
        adView.loadAd(AdRequest.Builder().build())
    }

    private fun loadInterstitial() {
        if (interstitial != null || loadingInterstitial) return
        loadingInterstitial = true
        InterstitialAd.load(this, BuildConfig.INTERSTITIAL_ID, AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) { interstitial = ad; loadingInterstitial = false }
                override fun onAdFailedToLoad(e: LoadAdError) { interstitial = null; loadingInterstitial = false }
            })
    }

    private fun loadRewarded() {
        if (rewarded != null || loadingRewarded) return
        loadingRewarded = true
        RewardedAd.load(this, BuildConfig.REWARDED_ID, AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) { rewarded = ad; loadingRewarded = false }
                override fun onAdFailedToLoad(e: LoadAdError) { rewarded = null; loadingRewarded = false }
            })
    }

    private fun js(code: String) = web.post { web.evaluateJavascript(code, null) }
    private fun result(purpose: String, ok: Boolean) = js("window.onAdResult && window.onAdResult('$purpose', $ok)")

    inner class Bridge {
        @JavascriptInterface
        fun isApp(): Boolean = true

        @JavascriptInterface
        fun deviceId(): String =
            Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: ""

        @JavascriptInterface
        fun showInterstitial() = runOnUiThread {
            val ad = interstitial
            if (ad == null) { result("inter", false); loadInterstitial(); return@runOnUiThread }
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    interstitial = null; loadInterstitial(); result("inter", true)
                }
                override fun onAdFailedToShowFullScreenContent(e: AdError) {
                    interstitial = null; loadInterstitial(); result("inter", false)
                }
            }
            ad.show(this@MainActivity)
        }

        /** purpose: "points", "hint" or "revive". uid goes to AdMob so the server knows whom to pay. */
        @JavascriptInterface
        fun showRewarded(purposeIn: String, uidIn: String) = runOnUiThread {
            val purpose = purposeIn.filter { it.isLetter() }.take(20)
            val uid = uidIn.filter { it.isLetterOrDigit() }.take(64)
            val ad = rewarded
            if (ad == null) { result(purpose, false); loadRewarded(); return@runOnUiThread }
            ad.setServerSideVerificationOptions(
                ServerSideVerificationOptions.Builder().setUserId(uid).setCustomData(purpose).build()
            )
            var earned = false
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    rewarded = null; loadRewarded(); result(purpose, earned)
                }
                override fun onAdFailedToShowFullScreenContent(e: AdError) {
                    rewarded = null; loadRewarded(); result(purpose, false)
                }
            }
            ad.show(this@MainActivity) { earned = true }
        }

        @JavascriptInterface
        fun exitApp() = runOnUiThread { finish() }
    }
}
