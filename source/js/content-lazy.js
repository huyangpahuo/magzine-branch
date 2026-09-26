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

  /* ---------- 1. 大块内容按视口渲染(一次性注入全局样式) ---------- */
  var style = document.createElement("style");
  style.textContent = [
    ".post-content figure.highlight,",
    ".post-content pre,",
    ".post-content table,",
    ".post-content figure,",
    ".post-content .mermaid-wrapper,",
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

    /* ---------- 3. 视频滚出视口 / 页面后台 → 暂停 ---------- */
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
