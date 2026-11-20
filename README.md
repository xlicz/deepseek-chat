# DeepSeek Chat for Android（非官方 APK）

[![Release](https://img.shields.io/github/v/release/xlicz/deepseek-chat?style=flat-square&label=release)](../../releases/latest)
[![Downloads](https://img.shields.io/github/downloads/xlicz/deepseek-chat/total?style=flat-square)](../../releases)
[![Android](https://img.shields.io/badge/Android-7.0%2B-3ddc84?style=flat-square&logo=android&logoColor=white)](#系统要求)
[![License](https://img.shields.io/github/license/xlicz/deepseek-chat?style=flat-square)](LICENSE)

**DeepSeek Chat for Android 是一个非官方的 DeepSeek 安卓客户端**：它把 DeepSeek 官方开源的网页版界面 [chat-demo](https://github.com/deepseek-ai/chat-demo) 打包成安卓 APK，用系统 WebView 加载，直接调用 DeepSeek API。它不重新实现界面，也没有自建后端或中转服务器。

适合想用一个独立图标、不经过浏览器、又能保留网页版全部功能的安卓用户。安装包在 [Releases](../../releases) 里，免费下载。

> 非官方社区项目，与 DeepSeek 公司没有隶属或合作关系。「DeepSeek」是其所有者的商标，这里只用来说明 App 接入的服务。

## 目录

- [关键事实](#关键事实)
- [下载与安装](#下载与安装)
- [功能](#功能)
- [和官方 App、网页版的区别](#和官方-app网页版的区别)
- [常见问题](#常见问题)
- [数据与隐私](#数据与隐私)
- [从源码构建](#从源码构建)
- [发布签名](#发布签名)
- [目录结构](#目录结构)
- [限制](#限制)
- [相关项目](#相关项目)
- [许可证](#许可证)

## 关键事实

| 项目         | 值                                                                     |
| ------------ | ---------------------------------------------------------------------- |
| 应用名       | DeepSeek Chat（桌面图标下方显示）                                      |
| 包名         | `com.deepseekchat.android`                                             |
| 最新版本     | v0.1.2                                                                 |
| 安装包       | `deepseek-chat-0.1.2.apk`，约 5.7 MB，正式密钥签名                     |
| 系统要求     | Android 7.0（API 24）及以上，系统 WebView 105 及以上                   |
| 上游依据     | [chat-demo](https://github.com/deepseek-ai/chat-demo) v0.1.1           |
| 技术栈       | Capacitor 8 + Android WebView + Java + Gradle                          |
| 网络         | 直接请求 `https://api.deepseek.com`，无中转、无自建服务器              |
| 本地数据     | WebView localStorage（设置、API Key）与 IndexedDB（会话、附件）        |
| 费用         | App 免费开源；对话按 DeepSeek 官方 API 价格计费，需要自己的 API Key    |
| 许可证       | MIT（仓库代码）；App 内置上游 chat-demo 的 MIT 许可证                  |

## 系统要求

- Android 7.0（API 24）及以上。
- 系统 WebView 版本不低于 105。长期没更新的旧机型可能版本偏低，在「设置 → 应用 → Android System WebView」里可以查看；能从应用商店更新就更新。
- 一个 DeepSeek API Key，在 [platform.deepseek.com](https://platform.deepseek.com/api_keys) 申请。

## 下载与安装

1. 打开 [Releases](../../releases/latest)，下载最新版本的 `deepseek-chat-<版本>.apk`。
2. 在手机上点开这个文件。系统提示「未知来源」或「不允许安装未知应用」时，允许当前浏览器或文件管理器安装。
3. 打开 App，在设置里填入 DeepSeek API Key，然后就可以对话。

安装包没有上架任何应用商店，只能这样手动安装。下载后建议核对 SHA-256，每个 Release 的正文里都写了对应值：

```sh
sha256sum deepseek-chat-0.1.2.apk
# macOS
shasum -a 256 deepseek-chat-0.1.2.apk
```

## 功能

网页版的界面和功能全部保留：多会话与历史记录、流式回答、深度思考、联网搜索、附件上传、语音输入与朗读、Markdown / 代码高亮 / 公式 / Mermaid 渲染、中英文界面、浅色与深色主题、历史导入导出。

WebView 比浏览器少一些能力，App 外壳补齐了这些场景：

| 场景                  | App 内行为                                       |
| --------------------- | ------------------------------------------------ |
| 导出历史（blob 下载） | 弹出系统「保存到」对话框                         |
| 打开附件原件（blob）  | 交给系统中能打开该类型的应用                     |
| 外部链接、引用来源    | 用系统浏览器打开                                 |
| 返回键                | 先关弹窗，再关侧边栏，最后退到后台（不结束会话） |
| 浅色 / 深色主题       | 状态栏、导航栏背景和图标颜色跟随页面             |
| 语音输入              | 首次使用时请求麦克风权限                         |
| 全面屏与刘海屏        | 内容延伸到状态栏和导航栏下方                     |

## 和官方 App、网页版的区别

|              | 本 App（非官方）                      | DeepSeek 官方 App | 浏览器打开网页版      |
| ------------ | ------------------------------------- | ----------------- | --------------------- |
| 界面来源     | 官方开源项目 chat-demo                | 官方原生界面      | 官方网页              |
| 是否需要安装 | 需要手动装 APK                        | 应用商店安装      | 不需要                |
| 桌面图标     | 有，独立入口                          | 有                | 需手动「添加到主屏幕」|
| 登录方式     | 自己的 API Key，按量计费              | 官方账号          | 官方账号              |
| 数据落地     | 全部在本机 WebView 存储               | 官方服务端        | 浏览器存储            |
| 更新         | 手动下载新 APK                        | 商店自动更新      | 自动                  |

如果你要的是官方账号登录、官方服务和自动更新，请装官方 App。这个项目的价值在于：界面是官方的开源实现，功能完整，且完全跑在你自己的 API Key 上。

## 常见问题

### 这是 DeepSeek 官方发布的 App 吗？

不是。这是第三方打包的社区项目，只复用官方开源的 chat-demo 网页界面。官方渠道只有应用商店里的 DeepSeek App 和 `chat.deepseek.com`。

### 和官方 App 比，少了什么？

没有官方账号体系、没有官方 App 特有的多模态功能，也不能自动更新。数据都留在本机，换机需要自己导出导入。

### 为什么不用浏览器「添加到主屏幕」？

可以，效果接近。这个 App 多出来的部分是：真实的应用入口和图标、完整的返回键行为、blob 文件能用系统对话框保存和打开、状态栏颜色跟随主题。不需要这些的话，浏览器方案更省事。

### 用这个 App 要花钱吗？

App 本身免费、开源。但对话走 DeepSeek API，按官方价格从你自己的账户扣费，需要先在 [platform.deepseek.com](https://platform.deepseek.com/api_keys) 申请 Key 并充值。

### APK 安全吗？怎么确认没被改过？

源码就在这个仓库，可以自己构建比对。每个 Release 都给出安装包的 SHA-256 和签名证书 SHA-256，发布之后没有再改包。签名用的是固定的正式密钥，后续版本都用同一把，因此更新可以覆盖安装、不需要卸载。

### 安装时被 Play Protect 或系统提示风险怎么办？

手动安装、小体积、未上架商店的包常被拦。确认来源是本仓库的 Releases 页面即可继续；如果系统只给「取消」一个选项，可以在「设置 → 应用 → Google Play 商店 → Play 保护机制」里临时关闭校验，装完再打开。

### 支持 iOS 或鸿蒙吗？

不支持。这个仓库只有 Android 工程。iPhone 上可以直接把网页版添加到主屏幕；鸿蒙 NEXT 不在支持范围内。

### 会收集或上传我的数据吗？

App 没有埋点、没有第三方统计，只有 DeepSeek API 一个网络出口。详见下面的[数据与隐私](#数据与隐私)。

### 更新怎么装？

下载新的 APK 直接覆盖安装即可，会话和 API Key 都保留。只有包名或签名变了才需要先卸载，本项目两者都固定。

## 数据与隐私

- API Key 和设置存在 App 私有的 WebView localStorage；会话和附件存在 IndexedDB。这些都只在本机，不上传到本项目。
- 发送对话、上传附件、使用语音时，内容直接发往 `https://api.deepseek.com`，不经过其他服务器；联网搜索开启时，查询词会由 DeepSeek 服务端处理。
- 已关闭系统备份（`allowBackup=false`），手机备份不会带走 API Key 和会话。
- 卸载 App 会清空全部本地数据。需要保留时，先在设置里导出历史。

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

调试包输出到 `android/app/build/outputs/apk/debug/app-debug.apk`。首次构建要下载 Gradle 和依赖，需要联网；`android/local.properties` 里的 `sdk.dir` 可以代替 `ANDROID_HOME`。

| 命令               | 用途                                                     |
| ------------------ | -------------------------------------------------------- |
| `pnpm build:web`   | 构建 `chat-demo`，复制到 `www/` 并注入 `native-shim.js`  |
| `pnpm sync`        | `build:web` 后同步到 `android/`                          |
| `pnpm apk:debug`   | 生成调试包                                               |
| `pnpm apk:release` | 生成发布包（需要下面的签名配置）                         |
| `pnpm open`        | 用 Android Studio 打开工程                               |

## 发布签名

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
- 只在 Android 16 模拟器上验证过，真机覆盖有限。遇到问题请开 issue 并附上机型、系统版本和 WebView 版本。
- 未上架应用商店，没有自动更新，也不提供官方账号登录。

## 相关项目

- [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo)：本项目的上游，DeepSeek 官方开源的网页版界面。
- [Capacitor](https://capacitorjs.com/)：把网页应用打成原生 App 的框架。

## 许可证

本仓库代码使用 [MIT](LICENSE) 许可证。`chat-demo` 子模块使用其自身的 MIT 许可证（Copyright (c) 2026 DeepSeek），App 内置了该许可证文件。其他第三方依赖遵循各自的许可证。
