# GitHub 发布网页完整教程（0 基础版）

> 跟着一步步做，大约 10 分钟就能让手机通过网址打开你的网页。

---

## 第一步：注册 GitHub 账号（如果你还没有）

1. 打开浏览器，访问 **https://github.com**
2. 点击右上角的 **"Sign up"**（注册）按钮
3. 输入你的**邮箱地址**（可以收邮件的就行）
4. 设置一个**密码**
5. 用户名（Username）填一个你喜欢的名字（只能是英文、数字和短横线，比如 `xiaoya-cangxu`）
6. 按提示完成验证（可能会有几道选图片的题目）
7. 注册完成后去邮箱点击验证链接

---

## 第二步：下载并安装 GitHub Desktop

GitHub Desktop 是一个图形界面工具，不用敲命令就能上传文件。

1. 访问 **https://desktop.github.com**
2. 点击大大的紫色 **"Download for macOS"** 按钮
3. 下载完成后，打开安装包（.zip 文件），把 GitHub Desktop 拖到"应用程序"文件夹
4. 打开 GitHub Desktop（在启动台里找，或者按 Cmd+空格搜索"GitHub Desktop"）
5. 第一次打开会让你登录：点击 **"Sign in to GitHub.com"**，会弹出浏览器让你授权，点授权即可
6. 授权完成后回到 GitHub Desktop，填一下你的名字和邮箱（用于记录谁提交了代码，随便填也行）

---

## 第三步：在 GitHub Desktop 中上传项目

这一步是把你下载文件夹里的 `cangxu-shishi` 上传到 GitHub 网站。

### 3.1 添加本地项目

1. 打开 GitHub Desktop
2. 点击左上角的菜单：**File → Add Local Repository...**（文件 → 添加本地仓库）
3. 点击 **"Choose..."**（选择）按钮
4. 在弹出的文件选择窗口中，找到左侧的**"下载"**（Downloads）文件夹
5. 点击里面的 **`cangxu-shishi`** 文件夹（点一下选中，不要双击进去）
6. 点击右下角的 **"Open"**（打开）
7. 回到添加窗口，点击 **"Add Repository"**（添加仓库）

### 3.2 如果提示"不是 Git 仓库"

添加后可能会弹出提示说 "This directory does not appear to be a Git repository"（这个文件夹似乎不是 Git 仓库），这是正常的。

1. 点击提示下方的 **"create a repository"**（创建一个仓库）链接
2. 填写信息：
   - **Name**（名称）：保持 `cangxu-shishi` 即可
   - **Description**（描述）：可以填 `仓序食时 - 个人记账与库存管理工具`，也可以不填
   - **Local Path**（本地路径）：不用改，应该已经指向你的下载/cangxu-shishi 文件夹
   - **Git Ignore**：选择 **None**
   - **Initialize this repository with a README**：**不要勾选！**（重要）
3. 点击 **"Create Repository"**（创建仓库）

### 3.3 第一次提交（保存）

1. 创建后，GitHub Desktop 主界面左侧会列出所有文件（index.html、app.js 等）
2. 在左下角找到 **"Summary"**（摘要）输入框，输入：`第一次提交：仓序食时完整网页`
3. 下方的 **"Description"** 留空即可
4. 点击蓝色的 **"Commit to main"**（提交到 main 分支）按钮

### 3.4 发布到 GitHub 网站

1. 提交后，界面顶部会出现一个蓝色的 **"Publish repository"**（发布仓库）按钮，点击它
2. 在弹出的窗口中：
   - **Name**：保持 `cangxu-shishi`
   - **Description**：可选填
   - **Keep this code private**（保持代码私有）：**先勾选上**（等下我们会改成公开）
   - **Organization**：选你的个人账号（默认就是）
3. 点击 **"Publish Repository"**
4. 等待几秒钟，顶部按钮变成 **"Fetch origin"** 或 **"Push origin"** 就说明上传成功了

> 💡 此时文件已经上传到 GitHub 网站了，但因为是私有仓库，别人看不到，GitHub Pages 也无法开启。下一步要把仓库改成公开。

---

## 第四步：把仓库改成公开（必须）

GitHub Pages（免费发布网页的功能）要求仓库是公开的。

1. 打开浏览器，访问 **https://github.com** 并登录
2. 你应该能在左侧看到 `cangxu-shishi` 仓库，点击进入
   - 如果看不到，点击右上角你的头像 → Your repositories（你的仓库），里面就能找到
3. 进入仓库页面后，点击页面上方的 **"Settings"**（设置）选项卡（在仓库名右边的一排标签中，可能需要点 `...` 展开）
4. 滚动到页面**最底部**，找到 **"Danger Zone"**（危险区域）这个红色标题的区域
5. 找到 **"Change repository visibility"**（更改仓库可见性）这一项
6. 点击右边的 **"Change visibility"** 按钮
7. 选择 **"Make public"**（设为公开）
8. 会弹出确认框，输入它要求的文字（通常是让你输入仓库名 `cangxu-shishi` 或 `你的用户名/cangxu-shishi`）
9. 点击确认按钮
10. 仓库名旁边会从 `Private`（灰色锁图标）变成 `Public`（绿色图标），说明公开成功了

> ⚠️ 公开仓库意味着任何人都可以看到你的代码，但他们只能看，不能修改。你的数据（记账记录等）不会存在代码里，那些存在你浏览器本地和 Supabase 云端，所以不用担心隐私问题。

---

## 第五步：开启 GitHub Pages（发布网页）

1. 在仓库页面中，再次点击 **"Settings"**（设置）
2. 在左侧菜单中找到并点击 **"Pages"**（页面）
   - 如果左侧菜单没有完全展开，往下滚动找，在 "Code and automation" 分类下
3. 你会看到 "GitHub Pages" 的设置页面
4. 在 **"Source"**（来源）部分：
   - 第一个下拉框默认可能是 "Deploy from a branch"，保持这个
   - 下面有 **"Branch"**（分支）选项，第一个下拉框选 **`main`**
   - 第二个下拉框（文件夹）选 **`/ (root)`**（根目录）
5. 点击旁边的 **"Save"**（保存）按钮
6. 保存后页面顶部会显示一个蓝色提示框，说 "Your site is ready to be deployed" 或类似内容，还有一个加载中的图标
7. **等待 1-3 分钟**（不要反复刷新，第一次部署比较慢）
8. 刷新页面，顶部提示框会变成绿色，显示：
   > `Your site is live at https://你的用户名.github.io/cangxu-shishi/`
9. 点击这个网址，就能看到你的网页了！

> 💡 如果 5 分钟后还显示 "Your site is being deployed..." 或者点链接显示 404，等几分钟再试。GitHub Pages 第一次部署确实比较慢。

---

## 第六步：用手机打开

1. 确保手机连上网络（WiFi 或流量都行）
2. 打开手机浏览器（Safari、Chrome 都可以）
3. 在地址栏输入刚才的网址：`https://你的用户名.github.io/cangxu-shishi/`
   - 注意：把 `你的用户名` 换成你实际的 GitHub 用户名
   - 比如用户名是 `xiaoya2024`，那网址就是 `https://xiaoya2024.github.io/cangxu-shishi/`
4. 网页应该就能正常打开了！

### 把网页添加到手机主屏幕（像 App 一样使用）

**iPhone（Safari）：**
1. 在 Safari 中打开网页
2. 点击底部中间的分享按钮（方框+上箭头图标）
3. 往下滑，找到 **"添加到主屏幕"**
4. 名字可以改成"仓序食时"，点击右上角"添加"
5. 主屏幕上就会出现一个图标，点击就能打开网页，像 App 一样

**Android（Chrome）：**
1. 在 Chrome 中打开网页
2. 点击右上角三个点（更多）
3. 选择 **"添加到主屏幕"**
4. 确认名字后点击"添加"

---

## 第七步：以后更新了代码怎么同步到 GitHub？

以后你让我修改了网页代码（比如新增功能、修复 bug），需要重新上传到 GitHub，步骤很简单：

1. 先把最新的文件复制到"下载/cangxu-shishi"（我会帮你做）
2. 打开 GitHub Desktop
3. 左侧会自动显示哪些文件被修改了
4. 在左下角 **Summary** 输入框写一句说明，比如：`修复了饮食记录编辑问题`
5. 点击 **"Commit to main"**
6. 点击右上角的 **"Push origin"**（推送到远程）
7. 等待 1-2 分钟，GitHub Pages 会自动更新，刷新手机就能看到最新版

> 💡 每次提交后 GitHub Pages 需要 1-2 分钟来更新网站，不是即时的。如果手机看到的还是旧版本，多刷新几次或等一会儿。

---

## 常见问题

**Q：打开网址显示 404？**
A：1）确认仓库已经设为 Public；2）确认 Pages 设置中 Branch 选了 `main` 和 `/ (root)` 并点了 Save；3）等 3-5 分钟再试。

**Q：手机能打开但显示空白？**
A：可能是文件路径问题。检查仓库根目录下是否有 `index.html` 文件（不是在子文件夹里）。在仓库页面应该能直接看到 index.html。

**Q：GitHub Desktop 里 "Publish repository" 按钮是灰色的？**
A：说明你还没做第一次 Commit。先在左下角 Summary 填内容，点 "Commit to main"，按钮就会变成蓝色可点击。

**Q：怎么知道我的 GitHub 用户名？**
A：登录 GitHub 后，点击右上角头像，旁边显示的就是你的用户名。也可以看浏览器地址栏，`github.com/` 后面的就是你的用户名。

**Q：我想修改仓库名怎么办？**
A：在仓库 Settings 页面最顶部可以改名字，但改完后 Pages 的网址也会变，需要重新配置。建议一开始就确定好名字不要改。

**Q：别人能看到我记录的账吗？**
A：不能。网页是公开的，但你的记账数据存在你自己的浏览器和 Supabase 账号里，别人访问这个网址看到的是他们自己的空白页面，和你的数据完全隔离。

---

## 现在你可以做的事

完成以上步骤后，你就拥有了一个：
- ✅ 电脑和手机都能通过网址访问的网页
- ✅ 可以添加到手机主屏幕像 App 一样使用
- ✅ 后续配置 Supabase 后，电脑和手机数据自动同步

如果哪一步卡住了，告诉我：
1. 你做到了第几步
2. 屏幕上显示了什么（文字描述或截图）
3. 我会帮你解决
