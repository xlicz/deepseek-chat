# DeepSeek Chat for Android

把 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo) 打包成安卓 App。App 用系统 WebView 加载 chat-demo 的构建产物，直接请求 DeepSeek API，没有自建后端。

> 本项目是非官方的社区项目，与 DeepSeek 公司没有隶属或合作关系。「DeepSeek」是其所有者的商标，这里只用来说明 App 接入的服务。

## 下载安装

1. 在 [Releases](../../releases) 下载最新的 `deepseek-chat-<版本>.apk`。
2. 在手机上打开 APK。系统提示「未知来源」时，允许当前浏览器或文件管理器安装应用。
3. 首次打开时在设置里填写 [DeepSeek API Key](https://platform.deepseek.com/api_keys)。

要求 Android 7.0 及以上，系统 WebView 版本不低于 105。

## 功能

chat-demo 的功能全部保留：多会话、流式回答、深度思考、智能搜索、附件、语音输入与朗读、Markdown / 代码高亮 / 公式 / Mermaid、中英文界面、深浅色主题、历史导入导出。

WebView 缺少部分浏览器行为，App 外壳补齐了以下场景：

| 场景                  | App 内行为                                       |
| --------------------- | ------------------------------------------------ |
| 导出历史（blob 下载） | 弹出系统「保存到」对话框                         |
| 打开附件原件（blob）  | 交给系统中能打开该类型的应用                     |
| 外部链接、引用来源    | 用系统浏览器打开                                 |
| 返回键                | 先关弹窗，再关侧边栏，最后退到后台（不结束会话） |
| 浅色 / 深色主题       | 状态栏、导航栏背景和图标颜色跟随页面             |
| 语音输入              | 首次使用时请求麦克风权限                         |

## 数据与隐私

- API Key 和设置存在 App 私有的 WebView localStorage，会话和附件存在 IndexedDB，都只在本机。
- 发送对话、上传附件和使用语音时，内容直接发往 `https://api.deepseek.com`，不经过其他服务器。
- 已关闭系统备份（`allowBackup=false`），备份不会带走 API Key 和会话。卸载 App 会清空全部本地数据，需要保留时先在设置里导出历史。

## 从源码构建

需要 Node.js 22.12+、pnpm、JDK 21 和 Android SDK（platform 36、build-tools 36）。

```sh
git clone --recurse-submodules https://github.com/xlicz/deepseek-chat.git
cd deepseek-chat
pnpm install

export JAVA_HOME=<JDK 21 路径>
export ANDROID_HOME=<Android SDK 路径>
pnpm apk:debug
```

调试包输出到 `android/app/build/outputs/apk/debug/app-debug.apk`。

| 命令               | 用途                                                    |
| ------------------ | ------------------------------------------------------- |
| `pnpm build:web`   | 构建 `chat-demo`，复制到 `www/` 并注入 `native-shim.js` |
| `pnpm sync`        | `build:web` 后同步到 `android/`                         |
| `pnpm apk:debug`   | 生成调试包                                              |
| `pnpm apk:release` | 生成发布包                                              |
| `pnpm open`        | 用 Android Studio 打开工程                              |

### 发布签名

`pnpm apk:release` 读取 `android/keystore.properties`。该文件和密钥都不入库，格式如下：

```properties
storeFile=/绝对路径/release.jks
storePassword=...
keyAlias=...
keyPassword=...
```

没有这个文件时，发布包不签名，不能直接安装。

## 目录结构

```text
chat-demo/             上游网页应用（git 子模块，源码不做修改）
shim/native-shim.js    网页侧外壳脚本：下载、打开文件、外部链接、返回键、系统栏颜色
scripts/build-web.mjs  构建 chat-demo 并注入外壳脚本
android/               Capacitor 8 安卓工程
  app/src/main/java/com/deepseekchat/android/
    MainActivity.java    返回键与全面屏
    AppShellPlugin.java  保存/打开文件、外部链接、系统栏颜色
```

升级上游：进入 `chat-demo/` 切到新版本，再在仓库根目录提交子模块指针。

## 限制

- 导出和打开文件时，内容以 base64 在网页和原生之间传递，几百 MB 的大文件可能内存不足。
- 目前只在 Android 16 模拟器上验证过，真机覆盖有限。

## 许可证

本仓库代码使用 [MIT](LICENSE) 许可证。`chat-demo` 子模块使用其自身的 MIT 许可证（Copyright (c) 2026 DeepSeek），App 内置了该许可证文件。其他第三方依赖遵循各自的许可证。
