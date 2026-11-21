package com.deepseekchat.android;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/** 网页侧 native-shim.js 调用的外壳能力：保存/打开文件、外部链接、系统栏颜色。 */
@CapacitorPlugin(name = "AppShell")
public class AppShellPlugin extends Plugin {

    private static final String TEMP_PATH_KEY = "__tempPath";
    private Integer barColor = null;

    /** 历史导出等下载：弹出系统「保存到」对话框，由用户选择保存位置。 */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String name = fileName(call.getString("name", ""), mimeType);
        File temp;
        try {
            temp = writeTemp(call, "save", UUID.randomUUID().toString());
        } catch (IOException | IllegalArgumentException e) {
            call.reject("写入临时文件失败", e);
            return;
        }
        call.getData().remove("data");
        call.getData().put(TEMP_PATH_KEY, temp.getAbsolutePath());

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        File temp = new File(call.getString(TEMP_PATH_KEY, ""));
        try {
            Uri target = result.getData() == null ? null : result.getData().getData();
            if (result.getResultCode() != Activity.RESULT_OK || target == null) {
                call.reject("已取消保存", "CANCELLED");
                return;
            }
            try (
                InputStream in = new FileInputStream(temp);
                OutputStream out = getContext().getContentResolver().openOutputStream(target)
            ) {
                if (out == null) {
                    throw new IOException("无法写入所选位置");
                }
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
            }
            call.resolve();
        } catch (IOException e) {
            call.reject("保存失败", e);
        } finally {
            //noinspection ResultOfMethodCallIgnored
            temp.delete();
        }
    }

    /** 附件原件：写入缓存后交给系统里能打开该类型的应用。 */
    @PluginMethod
    public void openFile(PluginCall call) {
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String name = fileName(call.getString("name", ""), mimeType);
        try {
            File dir = new File(getContext().getCacheDir(), "open");
            deleteChildren(dir);
            File file = writeTemp(call, "open", name);
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, name));
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("没有可打开此文件的应用", e);
        } catch (IOException | IllegalArgumentException e) {
            call.reject("打开文件失败", e);
        }
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url", "");
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            call.reject("只支持 http(s) 链接");
            return;
        }
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("没有可打开链接的浏览器", e);
        }
    }

    /** 页面背景色同步到状态栏/导航栏区域，并按亮度切换图标深浅。 */
    @PluginMethod
    public void setBarColor(PluginCall call) {
        Integer r = call.getInt("r");
        Integer g = call.getInt("g");
        Integer b = call.getInt("b");
        if (r == null || g == null || b == null) {
            call.reject("缺少颜色");
            return;
        }
        barColor = Color.rgb(clamp(r), clamp(g), clamp(b));
        getBridge().executeOnMainThread(() -> {
            applyBarColor();
            call.resolve();
        });
    }

    /** 网页首屏已绘制完成，通知壳层收起启动画面。 */
    @PluginMethod
    public void contentReady(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).onContentReady();
        }
        call.resolve();
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // SystemBars 在配置变化时会重置颜色，延后一帧重新应用
        getActivity().getWindow().getDecorView().post(this::applyBarColor);
    }

    private void applyBarColor() {
        if (barColor == null) {
            return;
        }
        Window window = getActivity().getWindow();
        View decor = window.getDecorView();
        decor.setBackgroundColor(barColor);
        boolean light = Color.luminance(barColor) > 0.5f;
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decor);
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }

    private File writeTemp(PluginCall call, String dirName, String fileName) throws IOException {
        String data = call.getString("data");
        if (data == null) {
            throw new IllegalArgumentException("缺少文件内容");
        }
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        File dir = new File(getContext().getCacheDir(), dirName);
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new IOException("无法创建缓存目录");
        }
        File file = new File(dir, fileName);
        try (OutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return file;
    }

    private static void deleteChildren(File dir) {
        File[] children = dir.listFiles();
        if (children == null) {
            return;
        }
        for (File child : children) {
            //noinspection ResultOfMethodCallIgnored
            child.delete();
        }
    }

    /** 去掉路径分隔符等非法字符；没有名字时按 MIME 类型补扩展名。 */
    private static String fileName(String name, String mimeType) {
        String safe = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (safe.isEmpty() || safe.equals(".") || safe.equals("..")) {
            String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
            safe = ext == null ? "file" : "file." + ext;
        }
        return safe;
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(255, value));
    }
}
