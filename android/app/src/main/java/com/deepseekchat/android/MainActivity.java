package com.deepseekchat.android;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
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
}
