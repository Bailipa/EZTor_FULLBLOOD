package com.eztor.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.ContextThemeWrapper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 全局弹幕前台服务：
 * 在其它应用之上显示一个不可交互的悬浮层，用透明 WebView 加载
 * danmaku-overlay.html —— 与桌面端完全同一份渲染实现、同一套弹幕规则。
 * 会话 cookie 复用全局 CookieManager，登录态与 App 内一致。
 */
public class DanmakuService extends Service {

    public static final String ACTION_STOP = "com.eztor.app.STOP_DANMAKU";
    public static boolean ACTIVE = false;

    private static final String OVERLAY_URL = "https://eztor.dogeggcode.cyou/danmaku-overlay.html";
    private static final String API_PROBE = "https://eztor.dogeggcode.cyou/api/danmaku?limit=1";
    private static final String CHANNEL_ID = "eztor_danmaku";
    private static final int NOTIF_ID = 1;

    private WindowManager windowManager;
    private FrameLayout overlayRoot;
    private WebView danmakuWebView;
    private Handler handler;

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            createNotificationChannel();
            startForeground(NOTIF_ID, buildNotification());
            handler = new Handler(Looper.getMainLooper());
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
            createOverlay();
            checkAuthOnce();
        } catch (Throwable t) {
            // 服务初始化失败不应拖垮整个应用
            android.util.Log.w("EZTor", "DanmakuService onCreate failed: " + t);
            try {
                stopSelf();
            } catch (Exception ignored) {
            }
        }
    }

    private void createNotificationChannel() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "EZTor 全局弹幕", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("全局弹幕运行中");
            nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        return b.setContentTitle("EZTor 全局弹幕运行中")
                .setContentText("点按通知可关闭")
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setOngoing(true)
                .setContentIntent(null)
                .build();
    }

    private void createOverlay() {
        overlayRoot = new FrameLayout(this);

        int type;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            type = WindowManager.LayoutParams.TYPE_PHONE;
        }

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        windowManager.addView(overlayRoot, lp);

        danmakuWebView = new WebView(new ContextThemeWrapper(getApplicationContext(), R.style.Theme_EZTor));
        WebSettings ws = danmakuWebView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ws.setUserAgentString(ws.getUserAgentString() + " EZTorAndroid/" + BuildConfig.VERSION_NAME);
        danmakuWebView.setBackgroundColor(Color.TRANSPARENT);
        danmakuWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // 静默失败：网络异常时悬浮层保持透明即可
            }
        });

        FrameLayout.LayoutParams flp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT);
        overlayRoot.addView(danmakuWebView, flp);
        danmakuWebView.loadUrl(OVERLAY_URL);
    }

    /** 一次性轻量探测登录态：未登录时提示，避免悬浮层"无弹幕"被误解为故障 */
    private void checkAuthOnce() {
        new Thread(() -> {
            try {
                URL url = new URL(API_PROBE);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                String cookie = CookieManager.getInstance().getCookie("https://eztor.dogeggcode.cyou");
                if (cookie != null && !cookie.isEmpty()) {
                    conn.setRequestProperty("Cookie", cookie);
                }
                conn.setRequestProperty("Accept", "application/json");
                int code = conn.getResponseCode();
                conn.disconnect();
                if (code == 401) {
                    handler.post(() -> Toast.makeText(DanmakuService.this,
                            "请先在 App 内登录后使用全局弹幕", Toast.LENGTH_LONG).show());
                }
            } catch (Exception ignored) {
            }
        }).start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ACTIVE = true;
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        ACTIVE = false;
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (danmakuWebView != null) {
            overlayRoot.removeView(danmakuWebView);
            danmakuWebView.removeAllViews();
            danmakuWebView.destroy();
            danmakuWebView = null;
        }
        if (overlayRoot != null) {
            try {
                windowManager.removeView(overlayRoot);
            } catch (Exception ignored) {
            }
            overlayRoot = null;
        }
        super.onDestroy();
    }
}
