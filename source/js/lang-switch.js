document.addEventListener("DOMContentLoaded", function () {
  // 1. 定义翻译字典
  const translations = {
    // 主界面
    胡杨怕火: "Huyangpahuo",
    "传递笑容魔法的Ciallo～(∠・ω< )⌒☆":
      "Ciallo, the Smiling Magician~ (∠・ω< )⌒☆",
    关于我: "About Me",
    首页: "Home",
    "© 2025 胡杨怕火. 保留所有权利.":
      "© 2025 Huyangpahuo. All rights reserved.",

    // 关于
    暂无数据: "No Data",
    关于: "About",
    称呼: "Name",
    年龄: "Age",
    "19岁": "19 years old",
    大学: "University",
    河南师范大学软件工程: "Henan Normal University, Software Engineering",
    爱好: "Hobbies",
    做游戏和绘画: "Making games and drawing",
    擅长: "Skills",
    吃饱睡睡饱吃: "Eat well, sleep well, repeat",
    身份: "Identity",
    二次元爱好者: "Anime Enthusiast",
    我的技能点: "My Skill Points",

    //
    碎碎念: "Random Thoughts",
    "大家好! 欢迎来到我的个人Blog空间":
      "Hello everyone! Welcome to my personal blog space.",
    "我会不定期的分享一些有关各个学科的知识的(当然我也是各个领域的彩笔),同时Unity和Godot游戏开发的一些想法也会写进去":
      "I’ll occasionally share some bits of knowledge from various fields (though I’m pretty much a noob in all of them 😅). I’ll also write about some ideas related to Unity and Godot game development.",
    "本人没什么实力只会当CV小白捏,完全是啥也不懂的半吊子,离不开GPT,Gemini还有Claude三个大神   @_@":
      "Honestly, I don’t have much skill—just a beginner who mostly copy-pastes stuff. I’m basically a half-baked learner who doesn’t understand much and can’t live without GPT, Gemini, and Claude, the three great gods @_@",

    //联系方式
    联系方式: "Contact",
    邮箱: "Email",
    哔哩哔哩: "Bilibili",

    //卡片文字
    逃离后室: "Escape the Backrooms",
    在不断的切出层级中探寻生的希望:
      "Search for hope of survival through endless shifting levels",
    下次窃皮者来的时候不要堵门你尔朵隆吗:
      "Next time the Skin Stealer comes, don’t block the door, you idiot",

    小丑牌: "Balatro",
    一旦拥有爱不释手: "Once you start, you can’t put it down",
    结果就是玩上瘾了: "And that’s how I got completely addicted",

    看门狗: "Watchdog",
    赋予游戏以美国都市的真实感:
      "Brings a realistic American city atmosphere to life",
    "没错,我是嘉豪": "That's Right, I'm Alanwalker",

    我的世界: "Minecraft",
    "生存探索无限,创造缔造奇迹":
      "Infinite survival and exploration, endless creative possibilities",
    准备好进服务器偷别人家了吗孩子们:
      "Ready to join the server and loot other people’s houses, kids?",

    师父: "Sifu",
    抬手不是抱歉: "Every move is a strike, not an apology",
    "这,即是武德.jpg": "This… is martial virtue.jpg",

    米塔: "MiSide",
    满足了我对二次元的所有幻想: "Fulfills all my anime fantasies",
    "幻想死了 狗头狗头狗头": "Fantasy ruined. skull skull skull",

    // 归档
    归档: "Archives",

    // 分类
    分类: "Categories",
    所有分类: "All Categories",
    暂无分类: "No Categories",
    阅读全文: "Read More",
    开始为您的文章添加分类: "Start Adding Categories to Your Posts",
    返回首页: "Back to Home",
    共有: "Total",
    篇文章: "Posts",
    相关分类: "Category",
    返回所有分类: "Back to All Categories",

    // 标签
    标签: "Tags",
    暂无标签: "No Tags",
    开始为您的文章添加标签: "Start Adding Tags to Your Posts",
    探索与: "Discover",
    相关的所有文章: "related posts",
    返回所有标签: "Back to All Tags",

    // 友链
    友链: "Links",
    传送门: "Portals",
    "暂无友链数据，请在 source/_data/link.yml 中添加友链信息":
      "No link data found. Please add entries to source/_data/link.yml",
    有志者事竟成多么美好的世界呀:
      "Where there's a will there's a way kind of beautiful",
    添加友链: "Add Link",
    "欢迎大家添加友链哦：": "Everyone is welcome to exchange links!",
    "这是我的友链 ~(=^_^)ノ☆ ：": "Here’s my site ~(=^_^)ノ☆:",
    只要你们愿意看我的中二文章都可以添加我的友链哦:
      "As long as you're willing to read my edgy articles, feel free to add my link~",
    "使用以下模板在评论区告诉我你的友链😃我一定会看的!：":
      "Use the template below and leave your info in the comments 😃 I’ll definitely check it out!",
    "我会一直视奸你们的哈哈哈  o(￣ヘ￣o＃) ~":
      "I’ll be watching all of you from the shadows haha o(￣ヘ￣o＃) ~",

    摄影和剪辑: "Photography & Video Editing",
    像素画和二次元绘画: "Pixel Art & Anime-style Illustration",
    Logo和矢量图设计: "Logo & Vector Design",
    各种计算机语言: "Programming Languages",
    Blender建模: "Blender Modeling",
    计算机图形学: "Computer Graphics",
    微信小程序: "WeChat Mini Program Development",
    游戏制作: "Game Development",
    写小说: "Novel Writing",
    我的世界模组制作: "Minecraft Modding",
    英语: "English",
    日语: "Japanese",
    前端和数据库: "Frontend & Database Development",
    安卓应用制作: "Android App Development",

    // 评论区
    评论区: "Comments",
    昵称: "Nickname",
    网址: "URL",
    必填: "Required",
    选填: "Optional",
    预览: "Preview",
    发送: "Submit",
    没有评论: "No Comments",
    Twikoo评论加载成功: "Twikoo comments loaded successfully",

    //追番
    追番: "Anime",
    我的追番: "My Anime List",
    "暂无追番数据，请确保已在 source/_data/anime/ 目录下创建了 yml 文件":
      "No anime data found. Please make sure anime.yml exists in source/_data/anime/",
    已观看: "Watched",
    点击观看: "Click to Watch",
    "正在加载...": "Loading...",
    "选集/换源": "Episodes/Sources",
    "加载中...": "Loading...",
    选集: "Episodes",
    播放列表: "Playlist",
    登场角色: "Characters",

    "即将自动播放下一集...": "Next episode will play automatically...",
    "已经是最后一集了~": "This is the last episode~",
    该源暂无集数数据: "No episode data for this source",
    "未配置 bangumi_url":
      "Please configure bangumi_url in source/_data/anime.yml",
    "无法解析 Bangumi ID":
      "Failed to parse Bangumi ID. Please check your anime.yml",
    暂无角色信息: "No character information available",
    "加载失败，请检查网络":
      "Failed to load. Please check your network connection",

    //番的名称
    咒术回战乙骨忧太篇: "Jujutsu Kaisen 0",
    咒术回战第一季: "Jujutsu Kaisen Season 1",
    咒术回战第二季: "Jujutsu Kaisen Season 2",
    咒术回战第三季: "Jujutsu Kaisen Season 3",
    JOJO的奇妙冒险: "JoJo's Bizarre Adventure",
    "JOJO的奇妙冒险 星尘远征军": "JoJo's Bizarre Adventure: Stardust Crusaders",
    "JOJO的奇妙冒险 星尘远征军 埃及篇":
      "JoJo's Bizarre Adventure: Stardust Crusaders – Battle in Egypt",
    "JOJO的奇妙冒险 黄金之风": "JoJo's Bizarre Adventure: Golden Wind",
    "JOJO的奇妙冒险 不灭钻石":
      "JoJo's Bizarre Adventure: Diamond Is Unbreakable",
    "JOJO的奇妙冒险 石之海": "JoJo's Bizarre Adventure: Stone Ocean",
    "JOJO的奇妙冒险 飙马野郎": "JoJo's Bizarre Adventure: Steel Ball Run",
    "岸边露伴 一动也不动": "Thus Spoke Kishibe Rohan",
    间谍过家家第一季: "SPY×FAMILY Season 1",
    间谍过家家第二季: "SPY×FAMILY Season 2",
    "间谍过家家 代号白": "SPY×FAMILY CODE: White",
    工作细胞第一季: "Cells at Work! Season 1",
    工作细胞第二季: "Cells at Work! Season 2",
    工作细胞BLACK: "Cells at Work! CODE BLACK",
    石纪元第一季: "Dr. Stone Season 1",
    石纪元第二季: "Dr. Stone: Stone Wars",
    石纪元龙水篇: "Dr. Stone: Ryusui",
    石纪元第三季: "Dr. Stone: New World",
    石纪元第四季: "Dr. Stone: Science Future",
    进击的巨人第一季: "Attack on Titan Season 1",
    进击的巨人第二季: "Attack on Titan Season 2",
    进击的巨人第三季: "Attack on Titan Season 3",
    进击的巨人第四季: "Attack on Titan Final Season",
    电锯人: "Chainsaw Man",
    电锯人蕾塞篇: "Chainsaw Man – The Movie: Reze Arc",

    // 更多
    更多: "More",
    我的另一个网站: "My another Site",
    "我的另二个网站(狗头)": "My Other Site (Doge)",
    我的Github小号: "My Github Alternate Account",
    我的Gitee: "My Gitee",
    我的CDSN: "My CSDN",

    // 隐藏内容
    点击查看隐藏内容: "Click to reveal hidden content",
    " (点击恢复)": " (Click to hide again)",

    // AI摘要
    阿罗娜: "Alona",
    介绍自己: "Introduce",
    来点灵感: "Inspiration",
    生成AI简介: "Generate Summary",
    "老师好, 我是阿罗娜, 一个基于OpenAI GPT-4o的强大语言模型, 今天有什么可以帮到您? 😊":
      "Hello Sensei! I am Alona, powered by OpenAI GPT-4o. How can I help you today? 😊",
    "生成中. . .": "Generating...",
    "请等待. . .": "Please wait...",
    "Alona请求AI出错了，请稍后再试。":
      "Alona encountered an error while requesting AI. Please try again later.",

    // 文章
    文章: "Writings",
    "点击阅读->": "Click to Read ->",
    目录: "Directory",
    无目录: "No Directory",
    "← 上一篇": "← Previous",
    "下一篇 →": "Next →",
    加载更多文章: "Load More Articles",
    " 加载中...": "Loading...",
    "没有了哦~": "No more articles~",
    加载文章失败: "Error loading articles",
    分钟: "min",
    字: "words",

    // 搜索
    "搜索文章...": "Search Articles...",
    搜索索引未加载: "Search index not loaded",
    没有找到相关结果: "No results found",

    // 图片
    上一张: "Previous",
    下一张: "Next",
    "旋转90°": "Rotate 90°",
    锁定方向: "Lock Orientation",
    保存图片: "Save Image",

    // 分享文章
    分享这篇文章到: "Share this article",
    推特: "Twitter",
    脸书: "Facebook",
    领英: "LinkedIn",
    微信: "WeChat",
    微博: "Weibo",
    点击复制链接: "Copy Link",
    "已复制!": "Copied!",
    "链接已复制到剪切板!": "Link copied to clipboard!",
    微信扫一扫分享: "WeChat Scan to Share",
    '打开微信，点击底部的"发现"，使用"扫一扫"即可将网页分享至朋友圈。':
      "Open WeChat, tap 'Discover', use 'Scan' to share this page to Moments.",

    // 代码折叠
    展开代码: "Expand Code",
    折叠代码: "Collapse Code",
    复制成功: "Copy successful!",
    复制失败: "Copy failed",
    未找到代码内容: "Code content not found",

    //封面
    欢迎来到我的奇妙世界: "Welcome to my wonderful world",
    开始你的旅行: "Start Your Journey",

    //调色盘
    自定义主题色: "Custom Theme Color",

    //sakana
    切换角色: "Switch Character",

    // 音乐播放器
    展开播放器: "Expand Player",
    收起播放器: "Collapse Player",
    上一首: "Previous",
    下一首: "Next",
    列表循环: "Loop List",
    单曲循环: "Loop One",
    "播放/暂停": "Play/Pause",
    未在播放: "Not Playing",
    "请在 _config.yml 中配置歌曲": "Please configure songs in _config.yml",

    //照片墙
    在这里留下你的足迹: "Leave your mark here",
    留言: "Leave a Message",
    留言板: "Message Board",
    照片墙: "PhotoWall",

    //桌宠
    //drag
    "放开我!!!": "Let go of me!!!",
    "救命啊!!!": "Help!!!",
    "我讨厌你~呜呜": "I hate you~ boohoo",
    //click
    不要老是戳我呀: "Stop poking me",
    "真讨厌!": "So annoying!",
    "你又点我了!": "You poked me again!",
    //rightClick
    不要右键点我听到没有: "Don't right-click me, got it?",
    干什么啊: "What are you doing?",
    //fall
    哼: "Hmph",
    哎呀: "Ouch",
    //idle
    你怎么不理我了: "Why are you ignoring me?",
    快点和我说话: "Talk to me!",
    我好无聊啊: "I'm so bored",
    老师我想听歌: "Sensei, I want to listen to music",
    我好困啊: "I'm so sleepy",
    "可以放首歌吗我想听歌!!!":
      "Can you play a song? I want to listen to music!!!",
    不要右键戳我: "Don't right-click me",

    //桌宠设置面板
    全局音乐控制: "Global Music Control",
    未加载音乐: "No music loaded",
    角色音效: "Character Sound Effects",
    静音: "Mute",
    取消静音: "Unmute",

    //mermaid
    放大: "Zoom In",
    缩小: "Zoom Out",
    重置: "Reset Zoom",
    复制源码: "Copy Source Code",
    "已复制 ✓": "Copied ✓",
    已复制: "Copied",
    全屏查看: "View Fullscreen",
    展开图表: "Expand Chart",
    折叠图表: "Collapse Chart",

    //表格
    复制表格: "Copy Table",
    展开表格: "Expand Table",
    折叠表格: "Collapse Table",

    //碎碎念
    万花筒: "Murmur",
    "暂无碎碎念，去记录点什么吧~": "No murmurs yet, go record something~",
  };

  // ==========================================
  // 2. 核心逻辑
  // ==========================================
  let currentLang = localStorage.getItem("site_lang") || "zh";

  // 通用节点翻译函数
  function translateNode(node) {
    if (!node) return;

    // 1. 处理纯文本节点
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue.trim();
      if (text && translations[text]) {
        node.nodeValue = translations[text];
      }
      return;
    }

    // 2. 处理元素节点
    if (node.nodeType === Node.ELEMENT_NODE) {
      // (A) 翻译 data-label
      const label = node.getAttribute("data-label");
      if (label && translations[label]) {
        node.setAttribute("data-label", translations[label]);
      }

      // (B) ★★★ 关键修复：翻译 data-title ★★★
      const dataTitle = node.getAttribute("data-title");
      if (dataTitle && translations[dataTitle]) {
        node.setAttribute("data-title", translations[dataTitle]);
      }

      // (C) 翻译 title 属性
      const title = node.getAttribute("title");
      if (title && translations[title]) {
        node.setAttribute("title", translations[title]);
      }

      // (D) 翻译 placeholder
      if (["INPUT", "TEXTAREA"].includes(node.tagName)) {
        const placeholder = node.getAttribute("placeholder");
        if (placeholder && translations[placeholder]) {
          node.setAttribute("placeholder", translations[placeholder]);
        }
      }

      // (E) 翻译 data-text (用于 CSS content)
      const dataText = node.getAttribute("data-text");
      if (dataText && translations[dataText]) {
        node.setAttribute("data-text", translations[dataText]);
      }

      // (F) 翻译 aria-label
      const ariaLabel = node.getAttribute("aria-label");
      if (ariaLabel && translations[ariaLabel]) {
        node.setAttribute("aria-label", translations[ariaLabel]);
      }

      // 递归处理子节点
      Array.from(node.childNodes).forEach(translateNode);
    }
  }

  // ★★★ 新增：日期翻译辅助函数 (还原原味中文) ★★★
  function translateDates() {
    const dateElements = document.querySelectorAll(
      ".archive-date time, .article-date, .post-date time, .related-date time",
    );

    dateElements.forEach((el) => {
      // 1. 如果没有保存过原始文本，先存起来（这就是你 Hexo 生成的默认中文格式）
      if (!el.hasAttribute("data-original-text")) {
        el.setAttribute("data-original-text", el.textContent.trim());
      }

      // 2. 获取标准日期用于英文转换
      const dateStr =
        el.getAttribute("data-date-standard") || el.getAttribute("datetime");
      if (!dateStr) return;

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;

      if (currentLang === "en") {
        // === 英文模式：转换格式 ===
        if (el.parentElement.classList.contains("archive-date")) {
          // 归档页: Feb 24
          el.textContent = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        } else {
          // 其他页: Jan 28, 2026
          el.textContent = dateObj.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
      } else {
        // === 中文模式：还原原本的样子 ===
        // 直接从属性里拿回最初的文本，不再自己拼格式
        const originalText = el.getAttribute("data-original-text");
        if (originalText) {
          el.textContent = originalText;
        }
      }
    });
  }

  // ★ 暴露给全局
  window.i18n = {
    get: function (key) {
      if (currentLang === "en" && translations[key]) {
        return translations[key];
      }
      return key;
    },
    isEn: function () {
      return currentLang === "en";
    },
    translateNode: function (node) {
      if (currentLang === "en") {
        translateNode(node);
      }
    },
    // ★★★ 新增：将日期翻译函数也暴露出来供外部调用 ★★★
    translateDates: translateDates,
  };

  function translatePage() {
    translateNode(document.body);
    // 翻译日期
    translateDates();
  }

  function setupObservers() {
    if (currentLang !== "en") return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // 监听到属性变化时，触发翻译
        if (mutation.type === "attributes") {
          translateNode(mutation.target);
          return;
        }

        mutation.addedNodes.forEach(translateNode);
        if (mutation.type === "characterData") translateNode(mutation.target);
        if (mutation.type === "childList") {
          mutation.target.childNodes.forEach(translateNode);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      // 👇 关键修改：把 aria-label 也加入监听阵营！
      attributeFilter: ["data-title", "aria-label"],
    });
  }

  function setupLanguageButton() {
    const buttons = document.querySelectorAll('a[href*="#lang-switch"]');
    buttons.forEach((btn) => {
      btn.innerText = currentLang === "en" ? "🇨🇳 中文" : "🇺🇸 English";
      btn.removeAttribute("href");
      btn.style.cursor = "pointer";
      btn.onclick = (e) => {
        e.preventDefault();
        const newLang = currentLang === "en" ? "zh" : "en";
        localStorage.setItem("site_lang", newLang);
        location.reload();
      };
    });
  }

  // 即使是中文模式，也要运行 translateDates 来保存原始文本
  // 这样当用户点击切换时，我们才有东西可以还原
  if (currentLang === "en") {
    translatePage();
    setupObservers();
  } else {
    // 如果当前是中文，只需扫描一遍把原始日期存进属性里，不改内容
    translateDates();
  }

  setupLanguageButton();
});
