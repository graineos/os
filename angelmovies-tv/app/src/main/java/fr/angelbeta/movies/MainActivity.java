package fr.angelbeta.movies;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Angel Movies pour téléviseurs (Google TV, Android TV, Fire TV), tablettes et téléphones :
 * l'espace Films & Séries d'angel-beta.fr en plein écran, piloté à la télécommande.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://angel-beta.fr/films-series?source=tv";
    private static final String OFFLINE_HTML =
        "<html><body style='margin:0;background:#141414;color:#fff;font-family:sans-serif;display:flex;"
        + "align-items:center;justify-content:center;height:100vh;text-align:center'>"
        + "<div><h1 style='color:#E50914;font-size:42px;margin:0'>ANGEL MOVIES</h1>"
        + "<p style='font-size:22px;opacity:.75'>Pas de connexion Internet.</p>"
        + "<button autofocus onclick=\"location.href='" + HOME + "'\" style='font-size:22px;padding:14px 32px;"
        + "border:0;border-radius:12px;background:#fff;color:#000;font-weight:bold'>Réessayer</button></div></body></html>";

    private WebView web;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#141414"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false); // les liens « nouvel onglet » restent dans l'appli
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setUserAgentString(s.getUserAgentString() + " AngelMoviesTV/1");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if (scheme.equals("https") || scheme.equals("http")) return false;
                // intent:, market:, mailto:… : ouverts par le système s'il sait les gérer.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    // Rien pour les ouvrir sur ce téléviseur : on reste sur la page.
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) view.loadDataWithBaseURL(HOME, OFFLINE_HTML, "text/html", "utf-8", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // Vidéo en plein écran (bouton plein écran du lecteur).
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view;
                fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
                immersive();
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });

        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(HOME);
        immersive();
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
        web.setVisibility(View.VISIBLE);
        web.requestFocus();
    }

    @SuppressWarnings("deprecation")
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    /**
     * Touche Retour de la télécommande : on la transmet d'abord à la page (Échap ferme
     * la fiche ouverte), puis on sort du plein écran, on revient en arrière, et enfin on quitte.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
            if (fullscreenView != null) { exitFullscreen(); return true; }
            web.evaluateJavascript(
                "(function(){var d=document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]');"
                    + "if(d){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));"
                    + "return 'closed';}"
                    + "return 'none';})()",
                result -> {
                    if (result != null && result.contains("closed")) return;
                    if (web.canGoBack()) web.goBack();
                    else finish();
                });
            return true;
        }
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) return true; // consommé sur ACTION_UP
        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (Build.VERSION.SDK_INT >= 19) immersive();
    }

    @Override
    protected void onDestroy() {
        root.removeAllViews();
        web.destroy();
        super.onDestroy();
    }
}
