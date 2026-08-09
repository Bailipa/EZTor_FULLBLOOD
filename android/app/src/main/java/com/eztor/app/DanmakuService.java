package com.eztor.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.ContextThemeWrapper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * 全局弹幕前台服务：
 * 在其它应用之上显示一个不可交互的悬浮层，用透明 WebView 加载
 * danmaku-overlay.html —— 与桌面端完全同一份渲染实现、同一套弹幕规则。
 * 会话 cookie 复用全局 CookieManager，登录态与 App 内一致。
 */
public class DanmakuService extends Service {

    public static boolean ACTIVE = false;

    private static final String OVERLAY_URL = "https://eztor.dogeggcode.cyou/danmaku-overlay.html";
    private static final String CHANNEL_ID = "eztor_danmaku";
    private static final int NOTIF_ID = 1;

    private WindowManager windowManager;
    private FrameLayout overlayRoot;
    private WebView danmakuWebView;
    private Handler handler;
    private ScreenStateReceiver screenStateReceiver;
    private long lastRendererRecreateAt = 0;
    private static final long RENDERER_RECREATE_COOLDOWN_MS = 5000;
    private int overlayLoadFailures = 0;
    private static final int MAX_OVERLAY_RETRIES = 3;

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            createNotificationChannel();
            startForeground(NOTIF_ID, buildNotification());
            handler = new Handler(Looper.getMainLooper());
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
            createOverlay();
            registerScreenStateReceiver();
        } catch (Throwable t) {
            // 服务初始化失败不应拖垮整个应用
            Log.w("EZTor", "DanmakuService onCreate failed: " + t);
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

        createOverlayWebView();
    }

    private void createOverlayWebView() {
        final WebView wv = new WebView(new ContextThemeWrapper(getApplicationContext(), R.style.Theme_EZTor));
        WebSettings ws = wv.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ws.setUserAgentString(ws.getUserAgentString() + " EZTorAndroid/" + BuildConfig.VERSION_NAME);
        wv.setBackgroundColor(Color.TRANSPARENT);
        wv.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                // 加载成功：重置重试计数
                overlayLoadFailures = 0;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return; // 子资源失败静默忽略
                // 离线启动时页面加载失败会一直空白；有界退避重试，联网后自愈
                // （不无限重试：避免一直离线时白耗流量/电量）
                overlayLoadFailures++;
                if (overlayLoadFailures <= MAX_OVERLAY_RETRIES) {
                    long backoff = 5000L * overlayLoadFailures * overlayLoadFailures; // 5s/20s/45s
                    handler.postDelayed(() -> {
                        if (danmakuWebView != null && ACTIVE
                                && overlayLoadFailures <= MAX_OVERLAY_RETRIES) {
                            danmakuWebView.loadUrl(OVERLAY_URL);
                        }
                    }, backoff);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // 渲染进程被杀（双 WebView 内存压力下常见）：默认返回 false 会直接杀掉
                // 整个 App 进程（闪退）。这里接管并重建悬浮层 WebView，不崩 App。
                Log.w("EZTor", "danmaku WebView render process gone, didCrash="
                        + (detail != null && detail.didCrash()));
                long now = System.currentTimeMillis();
                if (now - lastRendererRecreateAt < RENDERER_RECREATE_COOLDOWN_MS) {
                    // 极低内存下渲染进程反复被杀：退避，避免重建死循环
                    Log.w("EZTor", "danmaku renderer keeps dying, skipping recreate to avoid loop");
                    return true;
                }
                lastRendererRecreateAt = now;
                handler.post(() -> {
                    try {
                        if (overlayRoot == null) return;
                        WebView old = danmakuWebView;
                        if (old != null) {
                            overlayRoot.removeView(old);
                            old.removeAllViews();
                            old.destroy();
                            danmakuWebView = null;
                        }
                        createOverlayWebView();
                    } catch (Exception ignored) {
                    }
                });
                return true;
            }
        });

        FrameLayout.LayoutParams flp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT);
        overlayRoot.addView(wv, flp);
        danmakuWebView = wv;
        wv.loadUrl(OVERLAY_URL);
    }

    /** 屏幕关闭时暂停悬浮层渲染与轮询，亮屏恢复 —— 避免前台服务在关屏时持续耗电/耗流量 */
    private final class ScreenStateReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            try {
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    if (danmakuWebView != null) danmakuWebView.onPause();
                } else if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
                    if (danmakuWebView != null) danmakuWebView.onResume();
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void registerScreenStateReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        screenStateReceiver = new ScreenStateReceiver();
        try {
            registerReceiver(screenStateReceiver, filter);
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ACTIVE = true;
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        ACTIVE = false;
        if (screenStateReceiver != null) {
            try {
                unregisterReceiver(screenStateReceiver);
            } catch (Exception ignored) {
            }
            screenStateReceiver = null;
        }
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
