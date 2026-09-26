document.addEventListener("DOMContentLoaded", function () {
  // 1. 翻译字典(多语言)
  // 词条与语言元信息都维护在 themes/magzine/language/*.yml(zh.yml 为基准,
  // 其余每个 yml 一种语言;每份文件顶层的 _meta 提供按钮用的 flag/label),
  // 构建期由 scripts/other/lang-dict.js 合成为 js/core/lang-dict.js(需先于本文件加载):
  //   window.__MAGZINE_LANG_DICTS__ = { en: {中文:English}, ru: {中文:Русский}, ... }
  //   window.__MAGZINE_LANG_META__  = { ru: {flag:"🇷🇺", label:"Русский"}, ... }
  // 本文件不内置任何翻译词条与语言清单;旧字典备份见 language/translations-backup.js
  const LANG_DICTS = window.__MAGZINE_LANG_DICTS__ || {};
  const LANG_META = window.__MAGZINE_LANG_META__ || {};
  // 语言循环顺序:zh 为页面原始语言,其余语言按字典生成顺序追加
  const LANG_ORDER = ["zh"].concat(Object.keys(LANG_DICTS));

  function dictFor(lang) {
    return LANG_DICTS[lang] || {};
  }

  // 语言按钮展示信息:优先取 yml 的 _meta;缺失时用语言代码 + 🌐 兜底
  // (因此新增语言文件后按钮立即可用,不必改本文件)
  function langMeta(lang) {
    const m = LANG_META[lang] || {};
    return {
      flag: m.flag || (lang === "zh" ? "🇨🇳" : "🌐"),
      label: m.label || (lang === "zh" ? "中文" : lang),
    };
  }

  // 字典查表(带保底):当前语言缺译时回退英文,避免非中文界面露出中文。
  // 中文模式不做翻译,返回 null。
  function dictLookup(zh) {
    if (!zh || currentLang === "zh") return null;
    const own = translations[zh];
    if (own) return own;
    if (currentLang !== "en" && LANG_DICTS.en) {
      return LANG_DICTS.en[zh] || null;
    }
    return null;
  }

  // ==========================================
  // 2. 核心逻辑
  // ==========================================
  let currentLang = localStorage.getItem("site_lang") || "zh";
  if (LANG_ORDER.indexOf(currentLang) === -1) currentLang = "zh";

  // 当前语言的正向字典(中文 → 目标语言),随语言切换重绑
  let translations = dictFor(currentLang);
  // 逆向词典(目标语言 → 中文),用于无刷新切回中文
  let reverseTranslations = {};
  function rebuildReverse() {
    reverseTranslations = {};
    Object.keys(translations).forEach((zh) => {
      const val = translations[zh];
      if (val && !(val in reverseTranslations)) reverseTranslations[val] = zh;
    });
  }
  rebuildReverse();

  // ★ 观察器挂在 window 上:pjax 换页会重复执行整个初始化回调,
  //   若用闭包变量,每次都会新建一个观察器且旧的永不释放,
  //   切回中文时只断开最新一个,其余观察器会把中文又翻回英文
  if (!window.__langObserverRef) window.__langObserverRef = { observer: null };

  // ==========================================
  // 2.5 显式语言属性(data-i18n-*)支持
  // ==========================================
  // 模板可为元素输出成对的显式语言属性,优先级高于全局字典:
  //   data-i18n-zh / data-i18n-<lang>              → 元素文本
  //   data-i18n-<attr>-zh / data-i18n-<attr>-<lang> → 指定属性(如 data-i18n-alt-en)
  // <lang> 为当前语言(en/ja/...),与 language/ 目录下的 yml 文件同名。
  // 规则:
  //   非中文模式: 有对应语言属性就用它;没有则用 _zh 查字典;再没有保留原文。
  //   中文模式: 有 _zh 恢复 _zh;没有则恢复首次翻译前自动捕获的原文。
  //   每次都从属性重新渲染,绝不把已翻译文本再次喂给字典(幂等,可重复调用)。
  const TRANSLATABLE_ATTRS = [
    "title",
    "alt",
    "aria-label",
    "placeholder",
    "data-label",
    "data-title",
    "data-text",
  ];

  // 元素文本的显式属性处理;返回 true 表示该元素文本已由显式属性接管,
  // 调用方不应再把它的子文本节点交给字典(避免二次翻译)
  function applyExplicitText(el) {
    let zh = el.getAttribute("data-i18n-zh");
    if (zh === "") zh = null;
    // 显式译文属性跟随当前语言:data-i18n-en / data-i18n-ja / ...
    let langVal =
      currentLang === "zh"
        ? null
        : el.getAttribute("data-i18n-" + currentLang);
    if (langVal === "") langVal = null;
    // 英文兜底属性:非英文语言缺译文时按"除中文外都用英文"的约定回退
    let enVal =
      currentLang === "en" ? null : el.getAttribute("data-i18n-en");
    if (enVal === "") enVal = null;
    if (zh === null && langVal === null && enVal === null) return false;

    if (currentLang !== "zh") {
      let target = null;
      if (langVal) {
        target = langVal;
      } else if (zh) {
        // 先查当前语言的字典(可能含这条内容的译文,如番剧名),
        // 查不到再由下面的英文属性兜底
        target = dictLookup(zh);
      }
      if (target === null && enVal) {
        target = enVal; // 当前语言无译文 → 回退英文
      }
      if (target !== null) {
        // 模板只写了译文属性时,首次替换前自动捕获中文原文用于切回中文:
        // 纯文本元素存进 data-i18n-zh 属性(随节点移动/导入持久),
        // 含子元素的容器(如摘要 HTML)存 expando 属性保留原始 HTML;
        // data-i18n-captured 防止把已翻译的文本误存为"中文原文"
        if (!zh) {
          if (el.children.length === 0) {
            if (!el.hasAttribute("data-i18n-captured")) {
              el.setAttribute("data-i18n-zh", el.textContent);
              el.setAttribute("data-i18n-captured", "1");
            }
          } else if (el.__i18nOrigHtml === undefined) {
            el.__i18nOrigHtml = el.innerHTML;
          }
        }
        if (el.textContent !== target) el.textContent = target;
      }
    } else {
      if (zh) {
        if (el.textContent !== zh) el.textContent = zh;
      } else if (el.__i18nOrigHtml !== undefined) {
        if (el.innerHTML !== el.__i18nOrigHtml) {
          el.innerHTML = el.__i18nOrigHtml;
        }
      }
    }
    return true;
  }

  // 属性的显式翻译对;返回本次已接管的属性名集合(这些属性不再走字典)
  function applyExplicitAttrs(el) {
    const handled = [];
    TRANSLATABLE_ATTRS.forEach((attr) => {
      let zh = el.getAttribute("data-i18n-" + attr + "-zh");
      if (zh === "") zh = null;
      let langVal =
        currentLang === "zh"
          ? null
          : el.getAttribute("data-i18n-" + attr + "-" + currentLang);
      if (langVal === "") langVal = null;
      // 英文兜底:非英文语言缺译文时回退(与文本侧规则一致)
      let enVal =
        currentLang === "en"
          ? null
          : el.getAttribute("data-i18n-" + attr + "-en");
      if (enVal === "") enVal = null;
      if (zh === null && langVal === null && enVal === null) return;

      if (currentLang !== "zh") {
        let target = null;
        if (langVal) {
          target = langVal;
        } else if (zh) {
          // 先查当前语言字典,再回退英文属性(同文本侧规则)
          target = dictLookup(zh);
        }
        if (target === null && enVal) {
          target = enVal;
        }
        if (target !== null) {
          // 同 text:只写译文属性时先捕获原属性值(通常就是中文),只捕获一次
          if (
            !zh &&
            el.getAttribute(attr) &&
            !el.hasAttribute("data-i18n-" + attr + "-captured")
          ) {
            el.setAttribute("data-i18n-" + attr + "-zh", el.getAttribute(attr));
            el.setAttribute("data-i18n-" + attr + "-captured", "1");
          }
          if (el.getAttribute(attr) !== target) el.setAttribute(attr, target);
        }
      } else if (zh && el.getAttribute(attr) !== zh) {
        el.setAttribute(attr, zh);
      }
      handled.push(attr);
    });
    return handled;
  }

  // direction=false: 中文→目标语言;direction=true: 目标语言→中文(逆向词典)
  function translateNode(node, direction) {
    if (!node) return;

    const mapText = (text) =>
      direction ? reverseTranslations[text] : dictLookup(text);

    // 1. 处理纯文本节点
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue.trim();
      if (text) {
        const mapped = mapText(text);
        if (mapped) node.nodeValue = mapped;
      }
      return;
    }

    // 2. 处理元素节点
    if (node.nodeType === Node.ELEMENT_NODE) {
      // 脚本/样式的内容不参与翻译,避免改写字符串字面量
      if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;

      // (A) 显式双语属性优先于字典
      const explicitText = applyExplicitText(node);
      const explicitAttrs = applyExplicitAttrs(node);

      // (B) 无显式对的属性继续走全局字典
      TRANSLATABLE_ATTRS.forEach((attr) => {
        if (explicitAttrs.indexOf(attr) !== -1) return;
        const val = node.getAttribute(attr);
        if (val) {
          const mapped = mapText(val);
          if (mapped) node.setAttribute(attr, mapped);
        }
      });

      // (C) 文本被显式属性接管的元素不再递归子文本节点
      if (explicitText) return;

      // 递归处理子节点
      Array.from(node.childNodes).forEach((child) =>
        translateNode(child, direction),
      );
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

      // 先按当前语言算出目标文本;若元素已是目标格式则直接跳过(幂等,
      // 允许 MutationObserver 反复触发而不死循环)
      let target;
      if (currentLang === "en") {
        // === 英文模式 ===
        target = el.parentElement.classList.contains("archive-date")
          ? // 归档页: Feb 24
            dateObj.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : // 其他页: Jan 28, 2026
            dateObj.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
      } else if (currentLang === "zh") {
        // === 中文模式：统一转换为中文写法(如 2026年9月3日 / 归档 9月3日) ===
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        target = el.parentElement.classList.contains("archive-date")
          ? `${m}月${day}日`
          : `${y}年${m}月${day}日`;
      } else {
        // === 其他语言(日语等)统一国际格式:2026-9-14 / 归档 9-14 ===
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        target = el.parentElement.classList.contains("archive-date")
          ? `${m}-${day}`
          : `${y}-${m}-${day}`;
      }
      if (el.textContent.trim() === target) return;
      el.textContent = target;
    });
  }

  // ★ 暴露给全局
  window.i18n = {
    get: function (key) {
      if (currentLang !== "zh") {
        return dictLookup(key) || key;
      }
      return key;
    },
    // 带变量的文案:zhTemplate 为含 {n}/{t} 等占位符的中文模板,
    // 译文模板写在 language/*.yml 里(占位符写法保持一致),
    // 当前语言缺译时回退英文模板,再缺则原样返回中文模板
    format: function (zhTemplate, vars) {
      let tpl = zhTemplate;
      if (currentLang !== "zh") {
        tpl = dictLookup(zhTemplate) || zhTemplate;
      }
      Object.keys(vars || {}).forEach((k) => {
        tpl = tpl.split("{" + k + "}").join(String(vars[k]));
      });
      return tpl;
    },
    isEn: function () {
      return currentLang === "en";
    },
    lang: function () {
      return currentLang;
    },
    langs: function () {
      return LANG_ORDER.slice();
    },
    // 供动态创建的导航(手机端刻度尺)调用:原地切换语言
    applyLanguage: function (lang) {
      applyLanguage(lang);
    },
    translateNode: function (node) {
      if (currentLang !== "zh") {
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

  // ==========================================
  // 3. MutationObserver:收集 + 防抖批量翻译
  // ==========================================
  // 页面上存在大量高频 DOM 动画(打字机/几何漫游/音乐播放器进度等),
  // 若每条变更都同步翻译会造成持续高负载甚至卡死。
  // 策略:变更只入队,每 150ms 合并去重后统一处理一次;
  // 纯装饰容器直接跳过;翻译产生的自身变更会再入队,但幂等,一到两轮即收敛。
  const FLUSH_INTERVAL = 150;
  // 这些容器内的任何 DOM 变化都无需翻译(动画/自绘/进度条)
  const TRANSLATE_SKIP_SELECTOR = [
    "#background-shapes", // 关于页几何漫游
    ".hero-fx-layer", // 首页流体/水彩特效层
    ".hero-typing", // 打字机(高频重写文本)
    ".scroll-indicator",
    ".music-player",
    ".sakana-widget",
    "#sakana-widget",
    ".loading",
    "canvas",
    "svg",
    "script",
    "style",
  ].join(", ");

  function inSkipZone(node) {
    if (!node) return true;
    const el =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!(el && el.closest && el.closest(TRANSLATE_SKIP_SELECTOR));
  }

  const pendingNodes = new Set();
  let flushTimer = null;
  let translating = false;

  function queueTranslate(nodes) {
    nodes.forEach((n) => {
      if (n && !inSkipZone(n)) pendingNodes.add(n);
    });
    if (!flushTimer) {
      flushTimer = setTimeout(flushTranslations, FLUSH_INTERVAL);
    }
  }

  function flushTranslations() {
    flushTimer = null;
    if (pendingNodes.size === 0) return;
    if (translating) {
      // 上一轮还没跑完(理论上不会发生),推迟到下一拍
      flushTimer = setTimeout(flushTranslations, FLUSH_INTERVAL);
      return;
    }
    translating = true;
    try {
      const nodes = Array.from(pendingNodes);
      pendingNodes.clear();
      if (currentLang !== "zh") {
        nodes.forEach((n) => {
          if (n.isConnected) translateNode(n);
        });
      }
      // 任意语言下,动态加入的卡片日期都要按当前语言刷新(内部幂等)
      translateDates();
    } finally {
      translating = false;
    }
  }

  function setupObservers() {
    if (window.__langObserverRef.observer) return; // pjax 换页/重复初始化时不叠加观察器
    window.__langObserverRef.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          if (currentLang !== "zh") queueTranslate([mutation.target]);
          return;
        }
        if (mutation.type === "characterData") {
          if (currentLang !== "zh") queueTranslate([mutation.target]);
          return;
        }
        // childList:只需处理新增节点(删除无需翻译)
        if (mutation.addedNodes.length) {
          queueTranslate(mutation.addedNodes);
        }
      });
    });

    window.__langObserverRef.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-title", "aria-label", "data-label"],
    });
  }

  function disconnectObserver() {
    if (window.__langObserverRef.observer) {
      window.__langObserverRef.observer.disconnect();
      window.__langObserverRef.observer = null;
    }
  }

  // ★ 无刷新语言切换:在当前页面原地翻译,不再 location.reload()
  //   重复调用同一语言也是安全的:流程幂等,会先还原中文再重新翻译,
  //   因此即使初始化尚未完成时被外部调用,也不会出现"半翻译"状态
  function applyLanguage(lang) {
    if (LANG_ORDER.indexOf(lang) === -1) lang = "zh";

    // ★ 先断开观察器,翻译完成后再重开,避免翻译与观察器互相触发
    disconnectObserver();

    // ★ 任意切换都先回到中文基准:
    //   - 显式属性元素按 data-i18n-zh 恢复(currentLang 必须先置 zh,
    //     否则显式逻辑会把旧语言再刷一遍)
    //   - 字典元素用旧语言的逆向词典还原
    //   跨语言切换(如 en → ja)时,页面当前是英文,直接查日语字典查不到,
    //   必须先还原成中文再翻译到目标语言
    const fromLang = currentLang;
    currentLang = "zh";
    if (fromLang !== "zh") {
      translateNode(document.body, true);
    }

    currentLang = lang;
    localStorage.setItem("site_lang", lang);
    translations = dictFor(lang);
    rebuildReverse();

    if (lang !== "zh") {
      translatePage(); // 中文 → 目标语言
    } else {
      translateDates(); // 日期统一转换为中文写法
    }
    setupObservers();
    updateLangButtons();
    // 通知运行时自行生成文案的组件(搜索结果计数、"加载更多"按钮等)重绘
    document.dispatchEvent(
      new CustomEvent("langchange", { detail: { lang: lang } }),
    );
  }

  function updateLangButtons() {
    // 按钮展示"下一个语言"(点击即切换):zh → en → ja → ru → zh 循环
    const idx = LANG_ORDER.indexOf(currentLang);
    const next = LANG_ORDER[(idx + 1) % LANG_ORDER.length];
    document.querySelectorAll("[data-lang-switch-btn]").forEach((btn) => {
      if (btn.classList.contains("lang-toggle-mobile")) {
        // 手机端顶栏的国旗按钮:展示当前语言国旗
        btn.innerText = langMeta(currentLang).flag;
        return;
      }
      btn.innerText = langMeta(next).flag + " " + langMeta(next).label;
    });
  }

  function setupLanguageButton() {
    const buttons = document.querySelectorAll(
      'a[href*="#lang-switch"], .lang-toggle-mobile',
    );
    buttons.forEach((btn) => {
      btn.removeAttribute("href");
      btn.style.cursor = "pointer";
      btn.setAttribute("data-lang-switch-btn", "1");
      btn.onclick = (e) => {
        e.preventDefault();
        // 点击循环切换到下一个语言:zh → en → ja → zh
        const idx = LANG_ORDER.indexOf(currentLang);
        applyLanguage(LANG_ORDER[(idx + 1) % LANG_ORDER.length]);
      };
      updateLangButtons();
    });
  }

  // 非中文模式初始化时直接翻译整页;中文模式只统一日期写法
  if (currentLang !== "zh") {
    translatePage();
  } else {
    // 中文模式：扫描日期并统一转换为中文写法
    translateDates();
  }
  // 观察器所有语言都开启:非中文下翻译文本,中文下为动态加入的卡片转换日期
  setupObservers();

  setupLanguageButton();

  // ★ 初始化完成后广播一次当前语言:本脚本通过 inject 在页面脚本(main.js 等)
  //   之后加载,那些脚本初始化时 window.i18n 还没注册,只能拿到中文原文;
  //   这里补一次广播,让打字机、搜索、加载更多等自行生成文案的组件
  //   在首屏就切到正确语言,而不必等用户手动切换一次。
  document.dispatchEvent(
    new CustomEvent("langchange", { detail: { lang: currentLang } }),
  );
});
