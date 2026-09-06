/**
 * PJAX 无感刷新 (自研轻量实现,无第三方依赖)
 *
 * 核心原则:导航时只替换 <main.main> 与 <title>,页面其余部分
 * (导航栏、音乐播放器、桌宠、Sakana、封面、波浪、页脚)全部保留。
 * 因此:
 *   - 切换页面时音乐不会中断(含移动端);
 *   - 桌宠不会重置位置;
 *   - 搜索框、语言切换按钮等头部元素只需绑定一次。
 *
 * 仅对白名单内的页面启用 pjax(首页/关于/友链/追番/照片墙/万花筒/
 * 归档/分类/标签 及其分页、分类/标签详情页)。文章页等重脚本页面
 * 自动回退为整页加载,保证评论区、TOC、AI 摘要等不受影响。
 *
 * 换页完成后做三件事:
 *   1. 重放新内容里的 <script>(about 页的几何背景动画等);
 *   2. 更新导航栏 active 状态;
 *   3. 在 document 上重新派发 DOMContentLoaded,唤醒所有页面脚本
 *      (main.js/search.js 等已加幂等守卫,不会重复绑定)。
 */
(function () {
  "use strict";

  if (window.__magzinePjax) return;
  window.__magzinePjax = true;

  // 历史滚动交给 pjax 管理,避免浏览器自动恢复与我们的 swap 打架
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var SWAP_SELECTOR = "main.main";
  // 音乐播放器元素引用(它是 body 常驻元素,需防意外脱离文档)
  var playerRef = document.querySelector(".music-player");

  // ---------- 白名单 ----------
  function normalizePath(p) {
    if (p.length > 1 && p.charAt(p.length - 1) !== "/") return p + "/";
    return p;
  }

  function isPjaxPath(pathname) {
    pathname = normalizePath(pathname);
    if (pathname === "/" || /^\/page\/\d+\/$/.test(pathname)) return true; // 首页及其分页
    if (/\.[a-z0-9]+$/i.test(pathname)) return false; // 带扩展名的是资源文件
    if (isPostPath(pathname)) return true;
    // 关于/友链/追番/万花筒/照片墙/归档/分类/标签(含详情页与分页)
    return /^\/(about|link|anime|murmur|wall|archives|categories|tags)(\/|$)/.test(
      pathname,
    );
  }

  // 文章页路径(:year/:month/:day/:title/)
  function isPostPath(pathname) {
    return /^\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+\/$/.test(normalizePath(pathname));
  }

  // ---------- 点击拦截 ----------
  document.addEventListener("click", function (e) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;

    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a || a.dataset.pjax === "off") return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;

    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || /^(mailto|tel|javascript):/i.test(href))
      return;

    var url;
    try {
      url = new URL(a.href, location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== location.origin) return;
    if (!isPjaxPath(url.pathname)) return;

    // 同一页面:仅滚动回顶部,不重新加载
    if (url.pathname === location.pathname && url.search === location.search) {
      if (!url.hash) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return; // 同页锚点交给浏览器
    }

    e.preventDefault();
    load(url.href, true);
  });

  // ---------- 前进/后退 ----------
  var currentKey = location.pathname + location.search;
  var previousPath = location.pathname; // 上一个页面路径(判断"从文章返回主页")

  window.addEventListener("popstate", function () {
    var key = location.pathname + location.search;
    if (key === currentKey) return; // 仅 hash 变化,浏览器已自行处理
    currentKey = key;
    if (!isPjaxPath(location.pathname)) {
      location.reload();
      return;
    }
    load(location.href, false);
  });

  // ---------- 模态窗口 iframe 内的浏览 ----------
  // 文章在模态窗口(iframe)里阅读时,点击文内的分类/标签徽章会由 iframe 自己的
  // pjax 在模态内打开"相关分类/相关标签"页,再点文章则继续在当前模态内查看
  // (article-modal.js 已禁止 iframe 内再创建第二层模态)。
  // 这里不需要任何拦截——保持 iframe 内自然导航即可。

  // ---------- 加载与替换 ----------
  var abortCtrl = null;
  var timedOut = false;
  var scrollMem = {};

  function load(href, push) {
    if (abortCtrl) abortCtrl.abort();
    timedOut = false;
    abortCtrl =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      timedOut = true;
      if (abortCtrl) abortCtrl.abort();
    }, 10000);

    scrollMem[location.href] = window.scrollY;

    // 离开主页列表前,记录分页进度与滚动位置(供手机端从文章返回时恢复)
    if (location.pathname === "/" || /^\/page\/\d+\/$/.test(location.pathname)) {
      var lmb = document.querySelector(".load-more-btn");
      try {
        sessionStorage.setItem(
          "homeListState",
          JSON.stringify({
            page: lmb ? parseInt(lmb.getAttribute("data-current-page")) || 1 : 1,
            scrollY: window.scrollY,
          }),
        );
      } catch (err) {}
    }

    previousPath = location.pathname;
    currentKey =
      new URL(href, location.href).pathname +
      new URL(href, location.href).search;

    var oldMain = document.querySelector(SWAP_SELECTOR);
    document.dispatchEvent(new CustomEvent("pjax:send"));
    if (oldMain) {
      oldMain.style.transition = "opacity 0.25s ease";
      oldMain.style.opacity = "0.3";
    }

    fetch(href, { signal: abortCtrl ? abortCtrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var newMain = doc.querySelector(SWAP_SELECTOR);
        var oldMain = document.querySelector(SWAP_SELECTOR);
        if (!newMain || !oldMain)
          throw new Error("pjax: 目标页面缺少 " + SWAP_SELECTOR);

        // ★ 先更新地址栏,再替换内容并重建脚本:
        //   页面内嵌脚本(twikoo 等)重建执行时会用 location.pathname
        //   决定拉取哪个页面的评论,此刻 URL 必须已经是新页面,
        //   否则会把上一个页面的评论拉进来。
        var newTitle = doc.title || document.title;
        var detachedScripts = [];
        var found = newMain.querySelectorAll("script");
        for (var i = 0; i < found.length; i++) {
          detachedScripts.push(found[i]);
          found[i].parentNode.removeChild(found[i]);
        }

        if (push) history.pushState({ pjax: true }, "", href);

        document.title = newTitle;
        oldMain.replaceWith(newMain); // 跨 document 节点会被自动 adopt
        reexecuteScripts(detachedScripts, newMain);

        // 淡入
        newMain.style.transition = "opacity 0.25s ease";
        newMain.style.opacity = "0.3";
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            newMain.style.opacity = "1";
          });
        });

        afterSwap(push);
        document.dispatchEvent(new CustomEvent("pjax:complete"));
      })
      .catch(function (err) {
        if (err && err.name === "AbortError" && !timedOut) return; // 被更新的导航取代
        location.href = href; // 出错兜底:整页跳转
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  // 按原顺序重建 <script> 才会执行(about 页几何动画、anime 页 Artplayer/HLS、
  // 各页面内嵌的 twikoo 初始化等)。src 脚本必须 async=false:
  // 动态插入的脚本默认 async,会出现"初始化脚本先于库执行"导致评论加载失败。
  function reexecuteScripts(detached, root) {
    detached.forEach(function (old) {
      var s = document.createElement("script");
      for (var i = 0; i < old.attributes.length; i++) {
        s.setAttribute(old.attributes[i].name, old.attributes[i].value);
      }
      if (old.src) s.async = false;
      s.textContent = old.textContent;
      root.appendChild(s);
    });
  }

  function afterSwap(push) {
    updateNavActive();

    // 语言包:为新内容补充日期翻译(英文模式下的文本由 MutationObserver 自动翻译)
    if (window.i18n && typeof window.i18n.translateDates === "function") {
      try {
        window.i18n.translateDates();
      } catch (e) {}
    }

    // 唤醒所有依赖 DOMContentLoaded 的页面脚本
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // ★ 兜底规则(承袭旧 ojax-init):评论/数学公式在新容器中重新加载
    setTimeout(function () {
      var twikooEl = document.getElementById("twikoo");
      if (
        twikooEl &&
        twikooEl.childElementCount === 0 &&
        typeof window.twikoo !== "undefined" &&
        window.twikooEnvId
      ) {
        try {
          window.twikoo.init({
            envId: window.twikooEnvId,
            el: "#twikoo",
            path: location.pathname, // 显式指定当前页路径
          });
        } catch (e) {}
      }
    }, 1500);
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      try {
        window.MathJax.typesetPromise();
      } catch (e) {}
    }

    // ★ 音乐播放器防丢失:文章模态窗口等逻辑可能移动过播放器,
    //   若它意外脱离了文档,放回 body(音频不会断)
    if (playerRef && !document.body.contains(playerRef)) {
      document.body.appendChild(playerRef);
    }

    // 滚动位置:新页面回顶部,后退则恢复原位置
    if (push) {
      var restored = false;
      // ★ 手机端:从文章返回主页(点 Logo/首页)时,恢复离开前的列表并定位
      if (
        location.pathname === "/" &&
        window.innerWidth <= 768 &&
        isPostPath(previousPath)
      ) {
        try {
          var hs = JSON.parse(
            sessionStorage.getItem("homeListState") || "null",
          );
          if (hs && ((hs.page || 1) > 1 || (hs.scrollY || 0) > 150)) {
            document.dispatchEvent(
              new CustomEvent("home:restore", { detail: hs }),
            );
            restored = true;
          }
        } catch (err) {}
      }
      if (!restored) window.scrollTo(0, 0);
    } else {
      var saved = scrollMem[location.href];
      window.scrollTo(0, typeof saved === "number" ? saved : 0);
    }
  }

  // ---------- 导航栏 active 状态 ----------
  function updateNavActive() {
    var path = normalizePath(location.pathname);
    var items = document.querySelectorAll(
      ".nav-menu a.nav-item, .nav-menu a.submenu-item",
    );
    Array.prototype.forEach.call(items, function (a) {
      var href = a.getAttribute("href") || "";
      var active = false;
      if (href.charAt(0) === "/" && href.indexOf("//") !== 0) {
        var link = normalizePath(href.split("#")[0].split("?")[0]);
        if (link === "/") {
          active = path === "/" || /^\/page\/\d+\/$/.test(path);
        } else {
          active = path === link || path.indexOf(link) === 0;
        }
      }
      a.classList.toggle("active", active);
    });
  }

  // 暴露编程式导航(供模态窗口 message 接管等使用)
  window.__magzinePjax = { load: load };
})();
