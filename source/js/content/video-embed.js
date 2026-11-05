/**
 * 视频嵌入交互(全局,pjax 兼容):
 *  1. 虎牙等占位卡(.video-facade)点击后才插入 iframe —— 杜绝第三方自动播放;
 *  2. 占位卡的"单播放"效果:点开任一视频时,把其它已展开的占位卡收回到封面
 *     (收回即断开直播流,等效暂停)。其余平台的播放器位于跨域 iframe 内部,
 *     页面没有可靠的控制接口,按需求不做强制暂停。
 *  事件全部委托在 document/window 上,页面切换(pjax)无需重新绑定。
 */
(function () {
  "use strict";

  if (window.__magzineVideoEmbed) return;
  window.__magzineVideoEmbed = true;

  var CONTAINER_SEL = ".hexo-video-embed";

  function facadeInnerHtml() {
    return (
      '<span class="video-facade-btn" aria-hidden="true"></span>' +
      '<span class="video-facade-tip">点击加载 · 不自动播放</span>'
    );
  }

  function buildFacadeIframe(container) {
    var src = container.getAttribute("data-video-src");
    if (!src) return;
    var frame = document.createElement("iframe");
    frame.src = src;
    frame.title = "嵌入视频";
    frame.setAttribute("frameborder", "0");
    // 虎牙页面自身内容可能比 iframe 高,禁掉它的内部滚动条
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("allowfullscreen", "allowfullscreen");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
    );
    frame.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;border:0;";
    container.innerHTML = "";
    container.appendChild(frame);
    // ★ 已加载视频的占位卡纳入视口观察:滚出 150% 余量后自动收回
    if (videoIO) videoIO.observe(container);
  }

  /** 把除 exclude 外所有已展开的占位卡收回到封面(断开直播流,等效暂停)。 */
  function collapseOtherFacades(excludeEl) {
    var facades = document.querySelectorAll(
      CONTAINER_SEL + ".video-facade"
    );
    for (var i = 0; i < facades.length; i++) {
      var el = facades[i];
      if (el === excludeEl) continue;
      if (el.querySelector("iframe")) {
        el.innerHTML = facadeInnerHtml();
      }
    }
  }

  // 占位卡:点击父页面里的播放按钮 → 插入 iframe,并收回其它占位卡
  document.addEventListener(
    "click",
    function (e) {
      var container =
        e.target && e.target.closest ? e.target.closest(CONTAINER_SEL) : null;
      if (!container) return;
      if (
        container.hasAttribute("data-video-src") &&
        !container.querySelector("iframe")
      ) {
        buildFacadeIframe(container);
      }
      collapseOtherFacades(container);
    },
    true
  );

  // 用户点击 iframe 内部的播放按钮:父页面 window 失焦,
  // 此时 document.activeElement 即被点击的 iframe —— 借此收回其它占位卡
  window.addEventListener(
    "blur",
    function () {
      var active = document.activeElement;
      if (!active || active.tagName !== "IFRAME") return;
      var container = active.closest ? active.closest(CONTAINER_SEL) : null;
      if (!container) return;
      collapseOtherFacades(container);
    },
    true
  );

  /* ═════════ 视频按需加载(内存优化核心) ═════════
     文章里的所有第三方视频 iframe(B 站/YouTube/Twitter/TikTok 等):
     · 视口 ±1 屏以内:保持加载;
     · 滚出 ±1 屏:替换为占位卡(iframe 从 DOM 移除,跨域播放器整体释放);
     · 占位卡回到 ±1 屏:自动恢复 iframe(重新进入观看无需手动点击);
     · 占位卡点击:立即加载;
     · 任一视频开始播放时,收回其它已加载视频(单一播放)。
     打开页面时,视口外的视频直接就是占位卡——多视频文章内存不再暴涨。 */
  var videoIO =
    "IntersectionObserver" in window
      ? new IntersectionObserver(onVideoIO, { rootMargin: "100% 0px 100% 0px" })
      : null;

  function onVideoIO(entries) {
    entries.forEach(function (en) {
      var el = en.target;
      // 已加载的视频滚出 ±1 屏:收回成占位卡(释放跨域播放器内存)。
      // 重新加载一律通过点击占位卡——自动恢复会让视频在滚动时反复
      // 加载/销毁,这正是"滚动太卡"的来源
      if (el.tagName === "IFRAME" && !en.isIntersecting) toVideoFacade(el);
    });
  }

  function toVideoFacade(frame) {
    var src = frame.getAttribute("src");
    if (!src) return null;
    var container = document.createElement("div");
    container.className = "hexo-video-embed video-facade";
    container.setAttribute("data-video-src", src);
    container.style.cssText =
      "position:relative;display:block;width:" +
      cssLen(frame.getAttribute("width"), "100%") +
      ";height:" +
      cssLen(frame.getAttribute("height"), "360px") +
      ";" +
      (frame.getAttribute("style") || "");
    container.innerHTML = facadeInnerHtml();
    frame.parentNode.replaceChild(container, frame);
    if (videoIO) videoIO.observe(container);
    return container;
  }

  function scanVideoIframes() {
    if (!videoIO) return;
    // ★ 所有文章内视频初始一律隐藏为占位卡,点击后才加载
    document
      .querySelectorAll(".post-content iframe, .article-content iframe")
      .forEach(function (f) {
        if (f.closest(".video-facade")) return;
        if (f.closest(".article-modal-iframe")) return;
        toVideoFacade(f);
      });
  }

  document.addEventListener("DOMContentLoaded", scanVideoIframes);
  document.addEventListener("pjax:complete", function () {
    setTimeout(scanVideoIframes, 60);
  });

  // 迟加载的外部嵌入脚本(twitter/tiktok 等)重新插入 iframe 时,补挂观察
  var videoMO = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || !videoIO) return;
        if (n.tagName === "IFRAME" && n.closest(".post-content")) {
          videoIO.observe(n);
          return;
        }
        if (n.querySelectorAll)
          n.querySelectorAll(".post-content iframe").forEach(function (f) {
            videoIO.observe(f);
          });
      });
    });
  });
  document.addEventListener("DOMContentLoaded", function () {
    videoMO.observe(document.body, { childList: true, subtree: true });
  });
})();
