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
})();
