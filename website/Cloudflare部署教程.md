# Cloudflare Pages 部署官网 —— 手把手图文教程

> 目标：把官网部署到 `https://ai-chat.zhuzibaishang.com`
> 你的情况：域名在腾讯云、未备案；官网文件已打包好
> 全程只需 3 大步骤：①注册 Cloudflare → ②上传 zip 部署 → ③绑域名 + 腾讯云加 CNAME
> 预计耗时：15～20 分钟（不含邮箱验证等待）

---

## 第 0 步：准备（已完成，确认一下即可）

官网文件已打包成 **`zhuzibaishang-官网-cloudflare上传包.zip`**（在 `ai-group-chat/website/` 目录），里面只有 3 个文件：

- `index.html` —— 官网页面
- `icon.png` —— 应用图标
- `version.json` —— 版本信息（供以后应用内自动更新用）

> ⚠️ EXE（77MB）和 APK 没放进这个 zip，因为它们要传阿里云 OSS，不传 Cloudflare（Cloudflare 免费版单文件上限 25MB，EXE 放不下）。

---

## 第 1 步：注册 Cloudflare 账号（第一次才需要）

1. 打开浏览器，访问：**https://dash.cloudflare.com/sign-up**
2. 输入你的邮箱（推荐用常用邮箱，别用一次性邮箱），设置密码，点 **「Sign Up / 创建账户」**
3. 去邮箱收一封 Cloudflare 的验证邮件，点里面的 **「Verify Email」** 链接
4. 验证后会自动登录进入 Cloudflare 控制台（Dashboard）

> 全程免费，不需要绑信用卡。注册界面是英文为主，但按上面顺序点即可。

---

## 第 2 步：上传官网文件并部署（核心步骤）

1. 登录后，看**左侧菜单栏**，找到 **「Workers 和 Pages」**（英文界面叫 "Workers & Pages"），点它。

2. 进入后，点右上角蓝色的 **「创建 / Create」** 按钮。

3. 出现选择，选 **「Pages」** 这个标签页（不是 Workers）。

4. 接下来会问你要怎么连接，选 **「直接上传 / Upload assets（Direct Upload）」**。
   - ⚠️ 千万别选「连接到 Git / Connect to Git」，那个是给有 GitHub 仓库的人用的，更复杂。

5. 出现一个创建项目的表单：
   - **项目名称（Project name）**：填 `zhuzibaishang-aichat`
     （这个名字决定你的临时网址，所以叫这个比较直观）

6. 找到 **「上传资产 / Upload assets」** 区域，把准备好的 **`zhuzibaishang-官网-cloudflare上传包.zip`** 直接**拖进去**（或点该区域选择文件）。

7. 稍等它上传完（会列出 3 个文件），然后点 **「部署 / Deploy site」** 按钮。

8. 等几十秒到 1 分钟，页面显示部署成功，给你一个网址，形如：
   ```
   https://zhuzibaishang-aichat.pages.dev
   ```
   **这个网址先记下来**，此刻官网已经能通过它访问了（点开就能看到你的官网）。

> ✅ 到这里，"官网能访问"已经完成了。下面两步是把它换成你自己的域名 `ai-chat.zhuzibaishang.com`。

---

## 第 3 步：绑定你的自定义域名 ai-chat.zhuzibaishang.com

1. 在刚才的项目页面里，找到 **「自定义域 / Custom domains」** 这个标签页（通常在项目顶部 Tab 里），点进去。

2. 点 **「设置自定义域 / Set up a custom domain」** 按钮。

3. 在输入框填：**`ai-chat.zhuzibaishang.com`**，点 **「继续 / Continue」**。

4. 接下来 Cloudflare 会检测你的域名不在它名下，通常会给你**两个选项**：
   - 选项 A：把整个域名 `zhuzibaishang.com` 的 NS 服务器迁到 Cloudflare（改动大，先别选）
   - 选项 B：**「添加 CNAME 记录 / Add a CNAME record」** ← **选这个**
   
   Cloudflare 会告诉你一个**目标地址（CNAME target）**，一般就是 `zhuzibaishang-aichat.pages.dev`（或一个以 `.pages.dev` 结尾的值）。**记下这个值**。

5. 保持这个页面别关，打开新标签页去腾讯云操作（见第 4 步）。

---

## 第 4 步：去腾讯云 DNS 加一条 CNAME 记录

1. 新标签页打开腾讯云 DNS 解析控制台：**https://console.cloud.tencent.com/cns**

2. 在域名列表里找到并点进 **`zhuzibaishang.com`**。

3. 点 **「添加记录」** 按钮，按下面填：

   | 字段 | 填写内容 |
   |------|---------|
   | 主机记录 | `ai-chat` |
   | 记录类型 | `CNAME` |
   | 线路类型 | 默认 |
   | 记录值 | `zhuzibaishang-aichat.pages.dev`（Cloudflare 第3步告诉你的那个值） |
   | TTL | 600（默认即可） |

4. 点 **「保存」**。

---

## 第 5 步：回到 Cloudflare 完成验证 + 等证书

1. 回到 Cloudflare 那个页面，点 **「激活 / Activate」** 或 **「完成 / Done」**（让它去检查 DNS）。

2. 如果提示 DNS 还没生效，**别慌**，DNS 解析全球同步通常要 **几分钟到几小时**（一般 10 分钟内）。可以先去做别的，过会儿回来点 **「重试检查 / Retry」**。

3. 生效后，Cloudflare 会**自动签发免费的 HTTPS 证书**，这也要几分钟。

4. 最终在浏览器打开：**https://ai-chat.zhuzibaishang.com**
   - 看到你的官网 = 成功 ✅
   - 地址栏有绿色小锁 = HTTPS 证书也 OK ✅

---

## 第 6 步（可选）：让"下载"按钮真正能下载

官网里的下载按钮现在指向的是**占位符地址**（`OSS_BUCKET.oss-cn-hangzhou...`），需要等你把 EXE/APK 上传到阿里云 OSS 后，回来替换成真实地址。这一步等 OSS 弄好再说，**不影响官网本身上线**。

---

## 常见问题

**Q1：第 3 步没看到「添加 CNAME」选项，只有让我把 NS 迁过去？**
答：Cloudflare 界面偶尔会变。如果只有迁移 NS 的选项，你也可以：不绑自定义域，直接在腾讯云 DNS 手动加一条 `ai-chat` 的 CNAME 指向 `zhuzibaishang-aichat.pages.dev`，然后在 Cloudflare 项目里"添加自定义域"时填 `ai-chat.zhuzibaishang.com`，Cloudflare 会识别并继续。原理一样，只是顺序不同。

**Q2：域名一直打不开？**
答：先确认两步都做了——①腾讯云 DNS 里 `ai-chat` 的 CNAME 记录已保存；②Cloudflare 里自定义域状态是"激活 Active"。DNS 生效慢的话用 `https://dns.google/resolve?name=ai-chat.zhuzibaishang.com` 查一下解析结果。

**Q3：能不用 Cloudflare，直接用别的吗？**
答：未备案域名 + 想绑自己域名做官网，Cloudflare 是最省事的一条路。如果你愿意花 2～3 周做 ICP 备案，之后就能用阿里云 OSS 直接托管官网（但那就是另一套流程了）。

---

## 需要你提供给我、我就能帮你完成的

如果你把下面任一信息给我，我可以帮你把官网下载按钮的占位符一次性替换好：

1. 阿里云 OSS 的 Bucket 名称 + 地域（例如 `zhuzibaishang-download` + `oss-cn-hongkong`）
2. 或者蒲公英上 APK 的下载页地址

给我之后，我直接改好官网文件、重新打包，你重新拖进 Cloudflare 覆盖部署即可。
