# AI Group Chat - 移动端构建指南

## 方式一：PWA（推荐，最快）

PWA 版本已部署，直接在手机浏览器打开：

**https://13ab41d5eb524265b570a18f67fcb5e9.app.workbuddy.link**

### Android 安装
1. 用 Chrome 打开上面的链接
2. 点击浏览器菜单 → "添加到主屏幕"
3. 桌面会出现 AI Chat 图标，点击即可像原生 App 一样使用

### iOS 安装
1. 用 Safari 打开上面的链接
2. 点击分享按钮 → "添加到主屏幕"
3. 桌面会出现 AI Chat 图标

### 配置同步
1. 在桌面版打开 设置 → 数据管理 → 同步到手机
2. 会生成一个配置二维码
3. 在手机版 PWA 中打开 设置 → 数据管理 → 扫码导入
4. 扫描二维码即可导入所有 AI 好友配置

---

## 方式二：GitHub Actions 云构建（生成原生 APK/IPA）

### 准备
1. 把项目推送到 GitHub 仓库
2. 在 GitHub 仓库的 Actions 页面会自动看到 "Build Mobile Apps" 工作流
3. 点击 "Run workflow" 手动触发构建

### 获取构建产物
1. 构建完成后，在 Actions 页面点击对应的运行记录
2. 在页面底部 "Artifacts" 区域下载 `ai-chat-android-apk` 或 `ai-chat-ios-ipa`

---

## 方式三：本地构建 Android APK

### 环境要求
- Java 21+
- Android SDK（包含 platform-tools、platforms;android-34、build-tools;34.0.0）
- Node.js 18+

### 步骤

```bash
# 1. 安装依赖
cd E:/workspace/workbuddy/ai-chat
npm install
npm install @capacitor/core@6 @capacitor/cli@6 @capacitor/android@6

# 2. 同步 web 资源到 Android 项目
npx cap sync android

# 3. 构建 APK
cd android
./gradlew assembleDebug

# 4. APK 生成位置
# android/app/build/outputs/apk/debug/app-debug.apk
```

### 构建 Release 版本（需要签名）
```bash
# 生成签名密钥
keytool -genkey -v -keystore ai-chat.keystore -alias ai-chat -keyalg RSA -keysize 2048 -validity 10000

# 在 android/app/build.gradle 中配置签名
# 然后构建
cd android
./gradlew assembleRelease
```

---

## 方式四：使用 Android Studio

1. 打开 Android Studio
2. File → Open → 选择 `E:/workspace/workbuddy/ai-chat/android`
3. 等待 Gradle sync 完成
4. Build → Build Bundle(s) / APK(s) → Build APK(s)

---

## 项目结构

```
ai-chat/
├── src/                 # Web 源码（桌面版和移动版共用）
│   ├── index.html       # 主页面（含 PWA meta 标签）
│   ├── styles.css       # 样式（含移动端响应式 CSS）
│   ├── store.js         # 数据存储（localStorage）
│   ├── ai-service.js    # AI 接口调用
│   ├── api-bridge.js    # 跨平台 API 适配层
│   ├── renderer.js      # UI 渲染逻辑
│   ├── manifest.json    # PWA 清单
│   └── sw.js            # Service Worker（离线缓存）
├── android/             # Capacitor Android 项目
├── pwa/                 # PWA 部署目录
├── .github/workflows/   # GitHub Actions 云构建
├── capacitor.config.js  # Capacitor 配置
├── main.js              # Electron 主进程
├── preload.js           # Electron 预加载
└── package.json
```

## 技术架构

### 跨平台适配
- `api-bridge.js` 自动检测运行环境：
  - **Electron**（桌面版）：通过 IPC 调用主进程的 Node.js HTTP
  - **Capacitor**（原生 App）：通过 CapacitorHttp 原生代理绕过 CORS
  - **Web/PWA**：直接使用 fetch API
- 流式输出在移动端自动降级为非流式 + 模拟打字效果

### 配置同步
- 桌面版生成配置二维码（包含所有 AI 好友、API Key、规则）
- 手机端扫码导入，配置完全一致
- 使用 LZString 压缩配置数据以适应二维码容量
