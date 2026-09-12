/**
 * 视频嵌入交互(全局,pjax 兼容):
 *  1. 虎牙等占位卡(.video-facade)点击后才插入 iframe —— 杜绝第三方自动播放;
 *  2. 单视频播放策略:点击/聚焦任一视频时,自动暂停上一个在播的视频。
 *     - 点击发生在 iframe 内部(播放按钮等),父页面收不到 click 事件,
 *       因此用 window blur + document.activeElement 判定用户点了哪个 iframe;
 *     - YouTube(enablejsapi)/Vimeo 用 postMessage 优雅暂停;
 *     - 其余平台(B站/抖音卡片/Ins 卡片/FB 卡片/虎牙等)无跨域控制接口,
 *       统一重载回封面状态(等效暂停并回到起点)。
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
  }

  function pauseContainer(container) {
    // 占位卡(虎牙等):回到占位状态即等于停止直播流
    if (container.hasAttribute("data-video-src")) {
      container.innerHTML = facadeInnerHtml();
      return;
    }
    var frame = container.querySelector("iframe");
    if (!frame || !frame.src) return;

    // YouTube:enablejsapi 的 postMessage 暂停(无重载闪烁)
    if (/youtube(-nocookie)?\.com\/embed\//.test(frame.src)) {
      try {
        frame.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*"
        );
        return;
      } catch (err) { /* 跨域受限时退回重载 */ }
    }

    // Vimeo:player postMessage 暂停
    if (/player\.vimeo\.com/.test(frame.src)) {
      try {
        frame.contentWindow.postMessage({ method: "pause" }, "*");
        return;
      } catch (err) { /* 同上 */ }
    }

    // 其余平台:重载 iframe 回到未播放的封面状态
    frame.src = frame.src;
  }

  function activate(container) {
    var all = document.querySelectorAll(CONTAINER_SEL);
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el === container || !el.__magzineVideoActive) continue;
      pauseContainer(el);
      el.__magzineVideoActive = false;
    }
    container.__magzineVideoActive = true;
  }

  // 占位卡:点击父页面里的按钮 → 插入 iframe(同时触发下面的激活逻辑)
  document.addEventListener(
    "click",
    function (e) {
      var container =
        e.target && e.target.closest
          ? e.target.closest(CONTAINER_SEL)
          : null;
      if (!container) return;
      if (
        container.hasAttribute("data-video-src") &&
        !container.querySelector("iframe")
      ) {
        buildFacadeIframe(container);
      }
      activate(container);
    },
    true
  );

  // 用户点击 iframe 内部的播放按钮:父页面 window 失焦,
  // 此时 document.activeElement 即被点击的 iframe
  window.addEventListener(
    "blur",
    function () {
      var active = document.activeElement;
      if (!active || active.tagName !== "IFRAME") return;
      var container =
        active.closest ? active.closest(CONTAINER_SEL) : null;
      if (!container) return;
      activate(container);
    },
    true
  );
})();
