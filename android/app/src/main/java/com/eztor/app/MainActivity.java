package com.eztor.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.provider.Settings;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import android.util.Log;

import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    // 浏览器套壳：直接把网页加载进 WebView
    private static final String APP_URL = "https://eztor.dogeggcode.cyou";
    private static final String CRASH_ENDPOINT = "https://eztor.dogeggcode.cyou/api/debug/crash";
    private static final int REQ_OVERLAY_PERMISSION = 1001;
    private static final int REQ_NOTIFICATION_PERMISSION = 1002;

    private WebView webView;
    private ProgressBar progressBar;

    /** 判断是否为网页可自处理的 scheme（http/https 留在 WebView，其他外联） */
    private boolean isExternalScheme(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        return !lower.startsWith("http://")
            && !lower.startsWith("https://")
            && !lower.startsWith("about:")
            && !lower.startsWith("file:")
            && !lower.startsWith("data:")
            && !lower.startsWith("javascript:");
    }

    /** 把自定义 scheme（如 xiaoying://）交给系统，跳转到对应 App（外联打开） */
    private boolean openExternalUrl(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            // 没有能处理该 scheme 的应用（如未安装小应）
            Toast.makeText(this, "无法打开 " + url.split(":")[0] + "://，请安装对应应用后重试", Toast.LENGTH_LONG).show();
            return true; // 已消费，避免 WebView 报 ERR_UNKNOWN_URL_SCHEME
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 崩溃上报：把未捕获异常的堆栈发到服务器，便于定位闪退
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            final String trace = Log.getStackTraceString(throwable);
            new Thread(() -> {
                try {
                    URL u = new URL(CRASH_ENDPOINT);
                    HttpURLConnection c = (HttpURLConnection) u.openConnection();
                    c.setRequestMethod("POST");
                    c.setDoOutput(true);
                    c.setConnectTimeout(5000);
                    c.setReadTimeout(5000);
                    c.setRequestProperty("Content-Type", "application/json");
                    String safe = trace == null ? "" : trace.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
                    byte[] payload = ("{\"source\":\"android\",\"trace\":\"" + safe + "\"}")
                            .getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    c.getOutputStream().write(payload);
                    c.getResponseCode();
                    c.disconnect();
                } catch (Exception ignored) {
                }
            }).start();
            try {
                Thread.sleep(1500); // 给上报请求留时间
            } catch (InterruptedException ignored) {
            }
            android.os.Process.killProcess(android.os.Process.myPid());
        });

        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress);

        // Android 13+：请求通知权限（前台服务通知需要）
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATION_PERMISSION);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " EZTorAndroid/" + BuildConfig.VERSION_NAME);
        settings.setSupportMultipleWindows(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // WebView 渲染进程被杀（常见于内存不足）：不闪退，重建 Activity 重载
                Log.w("EZTor", "WebView render process gone, detail=" + detail);
                runOnUiThread(() -> {
                    try {
                        if (!isFinishing() && !isDestroyed()) recreate();
                    } catch (Exception ignored) {
                    }
                });
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (isExternalScheme(url)) {
                    // 小应登录 xiaoying:// 等自定义 scheme：外联打开对应 App
                    return openExternalUrl(url);
                }
                return false; // http/https 留在 WebView
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (isExternalScheme(url)) {
                    return openExternalUrl(url);
                }
                return false;
            }
        });

        // target="_blank" / window.open 的新窗口：交给系统浏览器外联打开
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                WebView newWebView = new WebView(MainActivity.this);
                newWebView.getSettings().setJavaScriptEnabled(true);
                newWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView innerView, String url) {
                        openExternalUrl(url);
                        return true;
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView innerView, WebResourceRequest request) {
                        openExternalUrl(request.getUrl().toString());
                        return true;
                    }
                });
                transport.setWebView(newWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        // 网页端弹幕按钮通过该桥启停原生全局悬浮层（唯一弹幕入口）
        webView.addJavascriptInterface(new DanmakuBridge(), "AndroidDanmaku");

        // 下载处理：WebView 默认不处理下载，点 APK/安装包链接会直接无响应。
        // 用系统 DownloadManager 接管，并带上 WebView 的 dl_pass cookie（否则会被下载门禁 307 拦下）。
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null && !cookie.isEmpty()) {
                    req.addRequestHeader("Cookie", cookie);
                }
                String filename = url.substring(url.lastIndexOf('/') + 1);
                if (filename.isEmpty()) filename = "download";
                req.setTitle("EZTor " + filename);
                req.setDescription("正在下载安装包");
                req.setMimeType(mimetype != null && !mimetype.isEmpty() ? mimetype : "application/octet-stream");
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                req.setAllowedOverMetered(true);
                req.setAllowedOverRoaming(true);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                dm.enqueue(req);
                Toast.makeText(this, "开始下载: " + filename, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                // DownloadManager 不可用时回退到系统浏览器
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (Exception ignored) {
                    Toast.makeText(this, "下载失败，请使用系统浏览器", Toast.LENGTH_SHORT).show();
                }
            }
        });

        webView.loadUrl(APP_URL);
    }

    /** 与网页端「弹幕复习」联动的原生桥：启停 DanmakuService 全局悬浮层 */
    private class DanmakuBridge {
        @android.webkit.JavascriptInterface
        public void setEnabled(boolean enabled) {
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                if (enabled) requestAndStartGlobalDanmaku();
                else stopGlobalDanmaku();
            });
        }

        @android.webkit.JavascriptInterface
        public boolean isActive() {
            return DanmakuService.ACTIVE;
        }
    }

    private void requestAndStartGlobalDanmaku() {
        if (isFinishing() || isDestroyed()) return;
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) {
            try {
                new AlertDialog.Builder(this)
                        .setTitle("需要悬浮窗权限")
                        .setMessage("全局弹幕需要在其它应用之上显示。请在系统设置中允许 EZTor 显示悬浮窗。")
                        .setPositiveButton("去授权", (d, w) -> {
                            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:" + getPackageName()));
                            try {
                                startActivityForResult(i, REQ_OVERLAY_PERMISSION);
                            } catch (ActivityNotFoundException e) {
                                startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION), REQ_OVERLAY_PERMISSION);
                            }
                        })
                        .setNegativeButton("取消", null)
                        .show();
            } catch (Exception e) {
                Log.w("EZTor", "overlay permission dialog failed: " + e);
            }
            return;
        }
        try {
            Intent svc = new Intent(this, DanmakuService.class);
            if (Build.VERSION.SDK_INT >= 26) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        } catch (Exception e) {
            // Android 12+ 后台启动前台服务限制（ForegroundServiceStartNotAllowedException）
            Log.w("EZTor", "start danmaku service failed: " + e);
        }
    }

    private void stopGlobalDanmaku() {
        try {
            startService(new Intent(this, DanmakuService.class).setAction(DanmakuService.ACTION_STOP));
        } catch (Exception e) {
            Log.w("EZTor", "stop danmaku service failed: " + e);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
