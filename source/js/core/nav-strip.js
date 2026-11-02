/**
 * 桌面端菜单条溢出翻页(mobile-scale.js 的桌面对应物)
 *
 * 导航菜单项一律 white-space: nowrap(见 main.css):宽度足够时左右箭头
 * 自动隐藏;不够时 .nav-strip 内部横向滚动,两侧显示左右小三角翻动,
 * 彻底取代"菜单文字折行变形"的旧行为(俄语长词/长站名场景)。
 * 语言切换按钮钉在 .nav-right 最右侧,不参与这套挤压。
 */
(function () {
  "use strict";

  var menu = document.querySelector(".nav-menu");
  var strip = menu && menu.querySelector(".nav-strip");
  var prev = menu && menu.querySelector(".nav-strip-arrow.prev");
  var next = menu && menu.querySelector(".nav-strip-arrow.next");
  if (!menu || !strip || !prev || !next) return;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function update() {
    if (isMobile()) {
      // 手机端菜单由 nav-scale 刻度尺接管,箭头永不出现
      prev.hidden = true;
      next.hidden = true;
      return;
    }
    var overflow = strip.scrollWidth - strip.clientWidth > 1;
    prev.hidden = !overflow;
    next.hidden = !overflow;
    if (overflow) {
      // 已滚到头的一侧箭头置灰
      prev.disabled = strip.scrollLeft <= 1;
      next.disabled =
        strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1;
    }
  }

  function page(dir) {
    // 每次翻约一屏的 60%,平滑滚动
    strip.scrollBy({ left: dir * strip.clientWidth * 0.6, behavior: "smooth" });
  }

  prev.addEventListener("click", function () {
    page(-1);
  });
  next.addEventListener("click", function () {
    page(1);
  });
  strip.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  /* ---- 子菜单定位:.submenu 已改 fixed(见 main.css),脱离滚动裁剪;
         悬停时把面板放到触发项正下方,超出视口右侧则往回收 ---- */
  var openPair = null;

  function positionSub(item, sub) {
    var r = item.getBoundingClientRect();
    var w = sub.offsetWidth || 150;
    var left = Math.min(r.left, window.innerWidth - w - 12);
    sub.style.left = Math.max(8, left) + "px";
    sub.style.top = r.bottom + 10 + "px";
  }

  strip.querySelectorAll(".nav-item.has-submenu").forEach(function (item) {
    var sub = item.querySelector(".submenu");
    if (!sub) return;
    item.addEventListener("mouseenter", function () {
      positionSub(item, sub);
      openPair = [item, sub];
    });
  });

  function repositionOpen() {
    if (openPair && openPair[0].matches(":hover")) {
      positionSub(openPair[0], openPair[1]);
    } else {
      openPair = null;
    }
  }

  strip.addEventListener("scroll", repositionOpen);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen, { passive: true });

  // 语言切换会改写菜单文字与语言按钮宽度;字体就位、音乐播放器挂载
  // 也会改变可用宽度,这些时机后都重新测量一次
  document.addEventListener("langchange", function () {
    setTimeout(update, 50);
  });
  window.addEventListener("load", update);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(update);
  }
  document.addEventListener("pjax:complete", update);

  update();
})();
