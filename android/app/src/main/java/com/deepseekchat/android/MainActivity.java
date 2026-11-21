package com.deepseekchat.android;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // 首屏是否已完成绘制（由网页侧的 native-shim.js 通知）
    private volatile boolean contentReady = false;
    private long splashShownAt = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 启动画面一直挂到网页首屏绘制完成，避免中间出现一段空白
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashShownAt = SystemClock.uptimeMillis();
        splashScreen.setKeepOnScreenCondition(
            () -> !contentReady && SystemClock.uptimeMillis() - splashShownAt < SPLASH_TIMEOUT_MS
        );
        // 收起时整层淡出，而不是硬切到网页，避免闪一下白底
        splashScreen.setOnExitAnimationListener(provider -> {
            View splashView = provider.getView();
            splashView.animate()
                .alpha(0f)
                .setDuration(SPLASH_FADE_MS)
                .setInterpolator(new DecelerateInterpolator())
                .withEndAction(provider::remove)
                .start();
        });

        registerPlugin(AppShellPlugin.class);
        super.onCreate(savedInstanceState);
        // 各 Android 版本统一为全面屏绘制，系统栏区域由 SystemBars 留白并跟随页面背景色
        EdgeToEdge.enable(this);

        // 返回键先交给页面关闭弹窗或侧边栏；页面没处理时退到后台，保留当前会话状态
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView webView = bridge == null ? null : bridge.getWebView();
                    if (webView == null) {
                        moveTaskToBack(true);
                        return;
                    }
                    webView.evaluateJavascript(
                        "typeof window.__chatShellBack === 'function' && window.__chatShellBack() === true",
                        (result) -> {
                            if (!"true".equals(result)) {
                                moveTaskToBack(true);
                            }
                        }
                    );
                }
            }
        );
    }

    /** 网页首屏绘制完成：允许系统收起启动画面。 */
    public void onContentReady() {
        contentReady = true;
    }

    // 网页迟迟没通知（离线、加载失败）时的兜底时间
    private static final long SPLASH_TIMEOUT_MS = 3000L;
    // 启动画面淡出时长
    private static final long SPLASH_FADE_MS = 220L;
}
