/**
 * ============================================
 * 内容按视口加载 (content-lazy.js)
 *
 * 思路来自 Astro 的 client:visible:看不见的内容不渲染、不下载。
 * 模态窗口(iframe 内的文章页)和直链页面都生效——这里是文章页自己
 * 的文档,IntersectionObserver/content-visibility 都以当前文档为根。
 *
 * 1. CSS content-visibility:auto —— 代码块(figure.highlight/table)、
 *    表格、图表、公式、视频等大块内容离开视口后,浏览器自动跳过其
 *    布局与绘制,滚动回来立即恢复。代码墙/巨表页面不再卡。
 *    contain-intrinsic-size 的 auto 会记住上次真实高度,滚动条不跳。
 * 2. 图片/iframe 补齐 loading=lazy —— 浏览器原生按视口距离下载,
 *    看不见的图片和嵌入播放器不发起请求。
 * 3. 原生 <video> 滚出视口或页面切后台时自动暂停(停止解码与流量)。
 */
(function () {
  "use strict";

  if (window.__magzineContentLazy) return;
  window.__magzineContentLazy = true;

  /* ---------- 1. 大块内容按视口渲染(一次性注入全局样式) ----------
     ★ 只作用于"没有绝对定位装饰物"的容器:
       - 表格用 table.js 运行时生成的 .table-wrapper(普通 div),
         直接给 table/figure.highlight 加 content-visibility 会破坏
         代码块的 table 列宽布局与 mermaid 全屏按钮(paint containment 裁剪);
       - 代码块/mermaid 不在此列:代码块有自身折叠(max-height)兜底,
         mermaid 已是按视口懒渲染。
  */
  var style = document.createElement("style");
  style.textContent = [
    ".post-content mjx-container,",
    ".post-content .hexo-video-embed,",
    ".post-content iframe,",
    ".post-content video {",
    "  content-visibility: auto;",
    "  contain-intrinsic-size: auto 320px;",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  function init() {
    /* ---------- 2. 图片 / iframe 原生懒加载补齐 ---------- */
    document
      .querySelectorAll(".post-content img:not([loading])")
      .forEach(function (img) {
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
      });

    document
      .querySelectorAll(".post-content iframe:not([loading])")
      .forEach(function (frame) {
        frame.setAttribute("loading", "lazy");
      });

    setupReadingReveal();
    setupVideoPause();
  }

  /* ---------- 4. 阅读显现(reading-reveal,参考 Astro 博客) ----------
     正文元素进入视口时淡入 + 轻微上移,一次性。
     ★ 只作用于"绝不会被脚本移动/替换"的元素白名单:
       table.js 会把 table 包进 .table-wrapper、mermaid.js 会用
       .mermaid-wrapper 替换 pre、代码块/折叠/标签组件也是 div——
       div 和 table 一律不参与,否则替换后的新元素没被观察,
       会永远停留在 opacity:0(表格/图表"消失"事故的根因)。
     ★ class 由 JS 添加:JS 失效时内容正常显示(渐进增强);
     ★ 尊重系统"减少动态效果"设置。 */
  var REVEAL_SELECTOR = [
    ".post-content > p",
    ".post-content > h1", ".post-content > h2", ".post-content > h3",
    ".post-content > h4", ".post-content > h5", ".post-content > h6",
    ".post-content > ul", ".post-content > ol",
    ".post-content > blockquote", ".post-content > hr",
  ].join(", ");

  function setupReadingReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    var content = document.querySelector(".post-content");
    if (!content || content.classList.contains("reading-reveal")) return;

    var items = [];
    content.querySelectorAll(":scope > *").forEach(function (el) {
      if (!el.matches("p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, hr"))
        return;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) {
        // ★ 首屏内元素:立即标记为已显现。
        //   (CSS 会隐藏所有匹配元素,如果不标记,首屏文字会被永久藏起
        //    ——这正是"正文闪现后消失/标题下方大段空白"的根因)
        el.classList.add("revealed");
        return;
      }
      items.push(el);
    });
    if (items.length === 0) return; // 没有待显现项时不挂隐藏样式,零风险

    content.classList.add("reading-reveal");

    if (!document.getElementById("reading-reveal-style")) {
      var st = document.createElement("style");
      st.id = "reading-reveal-style";
      st.textContent = [
        ".post-content.reading-reveal > p,",
        ".post-content.reading-reveal > h1, .post-content.reading-reveal > h2,",
        ".post-content.reading-reveal > h3, .post-content.reading-reveal > h4,",
        ".post-content.reading-reveal > h5, .post-content.reading-reveal > h6,",
        ".post-content.reading-reveal > ul, .post-content.reading-reveal > ol,",
        ".post-content.reading-reveal > blockquote, .post-content.reading-reveal > hr {",
        "  opacity: 0;",
        "  transform: translateY(14px);",
        "  transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),",
        "              transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);",
        "}",
        ".post-content.reading-reveal > .revealed {",
        "  opacity: 1;",
        "  transform: none;",
        "}",
      ].join("\n");
      document.head.appendChild(st);
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          // 交错显现:同批进入的元素按 DOM 顺序错开 40ms
          var el = en.target;
          var delay = Math.min(el.dataset.revealIdx * 40, 240);
          el.dataset.revealIdx = "0";
          setTimeout(function () {
            el.classList.add("revealed");
          }, delay);
        });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    items.forEach(function (el, i) {
      el.dataset.revealIdx = String(Math.min(i % 6, 5));
      io.observe(el);
    });
  }

  /* ---------- 3. 视频滚出视口 / 页面后台 → 暂停 ---------- */
  function setupVideoPause() {
    var videos = document.querySelectorAll(
      ".post-content video:not([data-clazy])",
    );
    if (videos.length === 0) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) {
            var v = en.target;
            if (!v.paused) v.pause();
          }
        });
      },
      { rootMargin: "150% 0px" },
    );

    videos.forEach(function (v) {
      v.setAttribute("data-clazy", "1");
      io.observe(v);
      v.addEventListener("play", function onPlay() {
        // 播放时才挂后台暂停监听,避免无谓监听
        v.removeEventListener("play", onPlay);
        document.addEventListener("visibilitychange", function onVis() {
          if (document.hidden && !v.paused) v.pause();
          if (v.ended) document.removeEventListener("visibilitychange", onVis);
        });
      });
    });
  }

  // 首次加载 + pjax 换页(pjax-init 会重新派发 DOMContentLoaded)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
    });
  } else {
    init();
    document.addEventListener("DOMContentLoaded", function () {
      init();
    });
  }
})();
