/**
 * 运行期翻译层(key 驱动)
 *
 * 页面始终由 Hexo 以中文渲染;本脚本不做任何"DOM 全页文本扫描",
 * 只认模板/脚本显式标出的通道,按当前语言重写文本与属性:
 *
 *   data-i18n-key            元素文本词条(模板 zh()+t() 输出)
 *   data-i18n-key-<attr>     元素属性词条(ta('placeholder', key) 输出)
 *   data-i18n-value          配置中文(菜单项/打字文案等),经"中文值→词条ID"
 *                            索引换译文,查不到保留原文
 *   data-i18n-value-<attr>   同上,属性版
 *   data-i18n-zh + data-i18n-<lang>       数据条目显式译文(about 卡片等)
 *   data-i18n-<attr>-zh / data-i18n-<attr>-<lang>  显式译文属性版
 *
 * 字典由构建期 scripts/other/lang-dict.js 从 language/*.yml 合成:
 *   window.__MAGZINE_LANG_DICTS__        { zh: {...}, en: {词条ID: 译文}, ... }
 *   window.__MAGZINE_LANG_VALUE_INDEX__  { 中文原文: 词条ID }
 *   window.__MAGZINE_LANG_META__         各语言按钮信息
 *
 * 因此:正文、标题、标签、分类等"内容"从不参与翻译——没有被标记
 * 就不会被碰;只有标了通道的元素会随语言切换。
 */
(function () {
  const LANG_DICTS = window.__MAGZINE_LANG_DICTS__ || {};
  const LANG_META = window.__MAGZINE_LANG_META__ || {};
  const VALUE_INDEX = window.__MAGZINE_LANG_VALUE_INDEX__ || {};
  // 语言循环顺序:zh 固定首位,其余按字母序(zh → en → ja → ru → zh)
  const LANG_ORDER = ["zh"].concat(
    Object.keys(LANG_DICTS)
      .filter(function (l) {
        return l !== "zh";
      })
      .sort(),
  );
  const LANG_SET = {};
  LANG_ORDER.forEach(function (l) {
    LANG_SET[l] = true;
  });

  let currentLang = localStorage.getItem("site_lang") || "zh";
  if (!LANG_SET[currentLang]) currentLang = "zh";

  function dictFor(lang) {
    return LANG_DICTS[lang] || {};
  }

  // 词条ID → 当前语言文案;缺译回退英文,再回退中文(绝不空白)
  function keyText(key) {
    if (!key) return null;
    const own = dictFor(currentLang)[key];
    if (own !== undefined) return own;
    if (currentLang !== "en" && LANG_DICTS.en) {
      const en = LANG_DICTS.en[key];
      if (en !== undefined) return en;
    }
    return LANG_DICTS.zh[key] !== undefined ? LANG_DICTS.zh[key] : null;
  }

  // 中文值 → 词条ID → 译文(仅用于显式标记的配置中文);查不到原样返回
  function valueText(zhValue) {
    if (!zhValue) return null;
    const key = VALUE_INDEX[zhValue];
    if (!key) return null;
    const own = dictFor(currentLang)[key];
    if (own !== undefined) return own;
    if (currentLang !== "en" && LANG_DICTS.en) {
      const en = LANG_DICTS.en[key];
      if (en !== undefined) return en;
    }
    return null;
  }

  // JS 侧取词入口:
  // - get(keyOrZhValue):词条ID或配置中文 → 当前语言文案;中文模式原样返回
  // - text(key):纯词条ID,中文模式也解析出 zh.yml 的规范文案
  // - format(keyOrTpl, vars):同 get,再填 {n}/{t} 占位符
  function get(keyOrZhValue) {
    if (currentLang === "zh") return keyOrZhValue;
    if (Object.prototype.hasOwnProperty.call(dictFor(currentLang), keyOrZhValue)) {
      return dictFor(currentLang)[keyOrZhValue];
    }
    const viaValue = valueText(keyOrZhValue);
    if (viaValue !== null) return viaValue;
    if (currentLang !== "en" && LANG_DICTS.en) {
      const en = LANG_DICTS.en[keyOrZhValue];
      if (en !== undefined) return en;
    }
    return keyOrZhValue;
  }

  function text(key) {
    if (currentLang === "zh") {
      const zh = LANG_DICTS.zh ? LANG_DICTS.zh[key] : undefined;
      return zh !== undefined ? zh : key;
    }
    return get(key);
  }

  function format(keyOrTpl, vars) {
    let tpl = keyOrTpl;
    if (currentLang === "zh") {
      const zh = LANG_DICTS.zh ? LANG_DICTS.zh[keyOrTpl] : undefined;
      tpl = zh !== undefined ? zh : keyOrTpl;
    } else {
      tpl = get(keyOrTpl);
    }
    Object.keys(vars || {}).forEach(function (k) {
      tpl = tpl.split("{" + k + "}").join(String(vars[k]));
    });
    return tpl;
  }

  // 把目标文本写进元素:纯文本元素整块替换;含子元素(图标+文字)只换
  // 第一个非空文本节点,避免吞掉 <i> 图标
  function setElementText(el, target) {
    const hasElementChild = el.children.length > 0;
    if (!hasElementChild) {
      if (el.textContent !== target) el.textContent = target;
      return;
    }
    const nodes = el.childNodes;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) {
        if (n.nodeValue !== target) n.nodeValue = target;
        return;
      }
    }
  }

  // ==========================================
  // 通道解析与套用
  // ==========================================
  function parseChannels(el) {
    const ch = {
      textExplicit: null, // data-i18n-zh
      textLang: null, // data-i18n-<lang>(数据条目显式译文)
      textKey: null, // data-i18n-key
      textValue: null, // data-i18n-value
      attrs: {}, // attr -> { zh, lang:{}, key, value }
    };
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      if (a.name.indexOf("data-i18n-") !== 0) continue;
      const rest = a.name.slice(10);
      if (rest === "captured") continue;
      if (rest === "key") {
        ch.textKey = a.value;
      } else if (rest === "value") {
        ch.textValue = a.value;
      } else if (rest === "zh") {
        ch.textExplicit = a.value;
      } else if (LANG_SET[rest]) {
        ch.textLang = ch.textLang || {};
        ch.textLang[rest] = a.value;
      } else {
        // 其余都是属性通道:data-i18n-<attr>-zh / -<lang> / data-i18n-key-<attr> / data-i18n-value-<attr>
        let attr = null;
        let kind = null;
        if (/^(.+)-zh$/.test(rest)) {
          attr = rest.slice(0, -3);
          kind = "zh";
        } else {
          for (let l = 0; l < LANG_ORDER.length; l++) {
            const lang = LANG_ORDER[l];
            if (rest.length > lang.length + 1 && rest.slice(-(lang.length + 1)) === "-" + lang) {
              attr = rest.slice(0, -(lang.length + 1));
              kind = "lang:" + lang;
              break;
            }
          }
        }
        if (!attr) {
          if (rest.indexOf("key-") === 0) {
            attr = rest.slice(4);
            kind = "key";
          } else if (rest.indexOf("value-") === 0) {
            attr = rest.slice(6);
            kind = "value";
          }
        }
        if (!attr) continue;
        // slot 必须带 lang 容器:显式属性译文(data-i18n-<attr>-<lang>)会写入它
        const slot = ch.attrs[attr] || (ch.attrs[attr] = { lang: {} });
        if (kind === "zh") slot.zh = a.value;
        else if (kind === "key") slot.key = a.value;
        else if (kind === "value") slot.value = a.value;
        else slot.lang[kind.slice(5)] = a.value;
      }
    }
    return ch;
  }

  function applyElement(el) {
    const ch = parseChannels(el);
    const hasText = ch.textExplicit !== null || ch.textLang || ch.textKey || ch.textValue;

    // ---- 元素文本 ----
    if (hasText) {
      if (currentLang === "zh") {
        // 还原中文:显式 _zh 优先,其次原捕获,词条/配置通道按字典回填
        if (ch.textExplicit !== null) {
          if (el.textContent !== ch.textExplicit) el.textContent = ch.textExplicit;
        } else if (el.__i18nOrigHtml !== undefined) {
          if (el.innerHTML !== el.__i18nOrigHtml) el.innerHTML = el.__i18nOrigHtml;
        } else if (ch.textKey) {
          const zh = LANG_DICTS.zh ? LANG_DICTS.zh[ch.textKey] : null;
          if (zh !== null) setElementText(el, zh);
        } else if (ch.textValue) {
          setElementText(el, ch.textValue);
        }
      } else {
        let target = null;
        if (ch.textLang) target = ch.textLang[currentLang] || ch.textLang.en || null;
        if (target === null && ch.textKey) target = get(ch.textKey);
        if (target === null && ch.textValue) target = get(ch.textValue);
        if (target !== null) {
          // 只有译文属性、没有 data-i18n-zh 的元素(如摘要 HTML):
          // 首次替换前捕获原文,供切回中文时精确还原
          if (ch.textExplicit === null && !el.hasAttribute("data-i18n-zh")) {
            if (el.children.length === 0) {
              if (!el.hasAttribute("data-i18n-captured")) {
                el.setAttribute("data-i18n-zh", el.textContent);
                el.setAttribute("data-i18n-captured", "1");
              }
            } else if (el.__i18nOrigHtml === undefined) {
              el.__i18nOrigHtml = el.innerHTML;
            }
          }
          setElementText(el, target);
        }
      }
    }

    // ---- 元素属性 ----
    Object.keys(ch.attrs).forEach(function (attr) {
      const slot = ch.attrs[attr];
      let target = null;
      if (currentLang === "zh") {
        if (slot.zh !== undefined) target = slot.zh;
        else if (slot.key) target = keyText(slot.key);
        else if (slot.value !== undefined) target = slot.value;
      } else {
        if (slot.lang) target = slot.lang[currentLang] || slot.lang.en || null;
        if (target === null && slot.key) target = get(slot.key);
        if (target === null && slot.value !== undefined) target = get(slot.value);
        // 只标了译文属性:首次替换前捕获原属性值(通常就是中文),只捕获一次
        if (target !== null && slot.zh === undefined && el.hasAttribute(attr) &&
            !el.hasAttribute("data-i18n-" + attr + "-captured")) {
          el.setAttribute("data-i18n-" + attr + "-zh", el.getAttribute(attr));
          el.setAttribute("data-i18n-" + attr + "-captured", "1");
        }
      }
      if (target !== null && el.getAttribute(attr) !== target) {
        el.setAttribute(attr, target);
      }
    });
  }

  // 对整棵子树套用当前语言(幂等:每次都从属性重新渲染)
  function applyTree(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.tagName !== "SCRIPT" && root.tagName !== "STYLE") applyElement(root);
    }
    if (root.querySelectorAll) {
      const all = root.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        const tag = el.tagName;
        if (tag === "SCRIPT" || tag === "STYLE") continue;
        applyElement(el);
      }
    }
  }

  // ==========================================
  // 日期格式(属性驱动,与文本翻译无关)
  // ==========================================
  function translateDates() {
    const dateElements = document.querySelectorAll(
      ".archive-date time, .article-date, .post-date time, .related-date time",
    );
    dateElements.forEach(function (el) {
      if (!el.hasAttribute("data-original-text")) {
        el.setAttribute("data-original-text", el.textContent.trim());
      }
      const dateStr =
        el.getAttribute("data-date-standard") || el.getAttribute("datetime");
      if (!dateStr) return;
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;

      let target;
      if (currentLang === "en") {
        target = el.parentElement.classList.contains("archive-date")
          ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : dateObj.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
      } else if (currentLang === "zh") {
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        target = el.parentElement.classList.contains("archive-date")
          ? m + "月" + day + "日" // i18n:allow(值通道/内容,有意保留的中文)
          : y + "年" + m + "月" + day + "日"; // i18n:allow(值通道/内容,有意保留的中文)
      } else {
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        target = el.parentElement.classList.contains("archive-date")
          ? m + "-" + day
          : y + "-" + m + "-" + day;
      }
      if (el.textContent.trim() === target) return;
      el.textContent = target;
    });
  }

  // ==========================================
  // 对外 API(脚本加载即注册,先于其它组件的初始化)
  // ==========================================
  window.i18n = {
    get: get,
    text: text,
    format: format,
    isEn: function () {
      return currentLang === "en";
    },
    lang: function () {
      return currentLang;
    },
    langs: function () {
      return LANG_ORDER.slice();
    },
    // 供 JS 动态创建的界面元素使用:打上 key 通道标记并立即填当前语言,
    // 之后语言切换会被 applyTree 一并刷新
    set: function (el, key) {
      if (!el) return;
      el.setAttribute("data-i18n-key", key);
      setElementText(el, text(key));
    },
    setAttr: function (el, attr, key) {
      if (!el) return;
      el.setAttribute("data-i18n-key-" + attr, key);
      const t = currentLang === "zh" ? text(key) : get(key);
      if (t !== null) el.setAttribute(attr, t);
    },
    applyLanguage: function (lang) {
      applyLanguage(lang);
    },
    translateNode: function (node) {
      if (currentLang !== "zh") applyTree(node);
    },
    translateDates: translateDates,
  };

  // 观察器挂在 window 上:pjax 换页会重复执行初始化,
  // 不叠加观察器,切语言时也只操作同一个
  if (!window.__langObserverRef) window.__langObserverRef = { observer: null };

  // 动态插入的节点(加载更多/pjax/查看器)只需要补一次通道套用;
  // 只监听 childList:JS 侧文案一律在写入时经 i18n 取词,不存在
  // "先写中文再被观察器纠正"的路径
  function setupObservers() {
    if (window.__langObserverRef.observer) return;
    window.__langObserverRef.observer = new MutationObserver(function (mutations) {
      let hasAdded = false;
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length) hasAdded = true;
      });
      if (hasAdded && currentLang !== "zh") {
        mutations.forEach(function (mutation) {
          Array.from(mutation.addedNodes).forEach(function (n) {
            if (n.nodeType === Node.ELEMENT_NODE) applyTree(n);
          });
        });
      }
      // 任意语言下,动态加入的卡片日期都按当前语言刷新(内部幂等)
      if (hasAdded) translateDates();
    });
    window.__langObserverRef.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function disconnectObserver() {
    if (window.__langObserverRef.observer) {
      window.__langObserverRef.observer.disconnect();
      window.__langObserverRef.observer = null;
    }
  }

  // 无刷新语言切换:applyTree 幂等,任意切换都从属性整体重渲染
  function applyLanguage(lang) {
    if (LANG_ORDER.indexOf(lang) === -1) lang = "zh";
    disconnectObserver();
    currentLang = lang;
    localStorage.setItem("site_lang", lang);
    applyTree(document.body);
    translateDates();
    setupObservers();
    updateLangButtons();
    // 通知运行时自行生成文案的组件(搜索计数、AI 面板等)重绘
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: lang } }));
  }

  function updateLangButtons() {
    // 按钮展示"下一个语言"(点击即切换):zh → en → ja → ru → zh 循环
    const idx = LANG_ORDER.indexOf(currentLang);
    const next = LANG_ORDER[(idx + 1) % LANG_ORDER.length];
    function meta(lang) {
      const m = LANG_META[lang] || {};
      return {
        flag: m.flag || (lang === "zh" ? "🇨🇳" : "🌐"),
        label: m.label || (lang === "zh" ? "中文" : lang), // i18n:allow(值通道/内容,有意保留的中文)
      };
    }
    document.querySelectorAll("[data-lang-switch-btn]").forEach(function (btn) {
      if (btn.classList.contains("lang-toggle-mobile")) {
        btn.innerText = meta(currentLang).flag;
        return;
      }
      btn.innerText = meta(next).flag + " " + meta(next).label;
    });
  }

  function setupLanguageButton() {
    document
      .querySelectorAll('a[href*="#lang-switch"], .lang-toggle-mobile')
      .forEach(function (btn) {
        btn.removeAttribute("href");
        btn.style.cursor = "pointer";
        btn.setAttribute("data-lang-switch-btn", "1");
        btn.onclick = function (e) {
          e.preventDefault();
          const idx = LANG_ORDER.indexOf(currentLang);
          applyLanguage(LANG_ORDER[(idx + 1) % LANG_ORDER.length]);
        };
        updateLangButtons();
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // 非中文模式初始化时套用一次;中文模式下 applyTree 也安全(幂等还原)
    if (currentLang !== "zh") {
      applyTree(document.body);
    }
    translateDates();
    setupObservers();
    setupLanguageButton();
    // 广播当前语言:打字机、搜索、加载更多等自行生成文案的组件
    // 监听它按当前语言重绘
    document.dispatchEvent(
      new CustomEvent("langchange", { detail: { lang: currentLang } }),
    );
  });
})();
