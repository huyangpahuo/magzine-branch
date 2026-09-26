/**
 * carousel.js | 文章内图片轮播交互(配合 scripts/tag/carousel.js 生成的 HTML)
 *
 * 功能:
 *   - 左右箭头 / 圆点 / 键盘方向键切换,循环播放;
 *   - 自动播放(interval=0 时关闭),悬停、触摸、拖动时暂停,离开后恢复;
 *   - 电脑端鼠标拖拽、手机端手指滑动均可跟手切换;
 *   - 滚出视口时暂停自动播放(IntersectionObserver);
 *   - pjax 换页会重新触发 DOMContentLoaded,用 data-carousel-ready 保证幂等。
 */
(function () {
  "use strict";

  function initCarousel(root) {
    if (root.hasAttribute("data-carousel-ready")) return;
    root.setAttribute("data-carousel-ready", "");

    var track = root.querySelector(".carousel-track");
    var slides = root.querySelectorAll(".carousel-slide");
    var dots = root.querySelectorAll(".carousel-dot");
    var captions = root.querySelectorAll(".carousel-caption");
    var counter = root.querySelector(".carousel-counter");
    var count = slides.length;
    if (!track || !count) return;

    var index = 0;
    var timer = null;
    var hovering = false;
    var inView = true;
    var interval = parseInt(root.getAttribute("data-interval"), 10) || 0;

    function render() {
      track.style.transform = "translateX(" + -index * 100 + "%)";
      for (var i = 0; i < count; i++) {
        slides[i].classList.toggle("active", i === index);
      }
      dots.forEach(function (d, i) {
        d.classList.toggle("active", i === index);
      });
      captions.forEach(function (c) {
        // caption 只在对应图片显示时出现,按 data-index 匹配(不是列表下标)
        c.classList.toggle(
          "active",
          parseInt(c.getAttribute("data-index"), 10) === index,
        );
      });
      if (counter) counter.textContent = index + 1 + " / " + count;
    }

    // 取模实现双向循环:go(-1) 到最后一张,go(count) 回到第一张
    function go(i) {
      index = ((i % count) + count) % count;
      render();
      restart();
    }

    /* ---------- 自动播放 ---------- */

    function tick() {
      go(index + 1);
    }

    function shouldPlay() {
      return interval > 0 && count > 1 && !hovering && inView && !dragging;
    }

    function start() {
      if (!shouldPlay() || timer) return;
      timer = setInterval(tick, interval);
    }

    function stop() {
      clearInterval(timer);
      timer = null;
    }

    function restart() {
      stop();
      start();
    }

    root.addEventListener("mouseenter", function () {
      hovering = true;
      stop();
    });
    root.addEventListener("mouseleave", function () {
      hovering = false;
      start();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          inView = entries[0].isIntersecting;
          inView ? start() : stop();
        },
        { threshold: 0.3 }
      ).observe(root);
    } else {
      inView = false; // 老浏览器拿不到可见性,保守起见不自动播
    }

    /* ---------- 键盘(轮播获得焦点时) ---------- */

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(index + 1);
      }
    });

    /* ---------- 圆点 / 箭头 ---------- */

    dots.forEach(function (d) {
      d.addEventListener("click", function () {
        go(parseInt(d.getAttribute("data-index"), 10) || 0);
      });
    });
    if (root.querySelector(".carousel-prev")) {
      root.querySelector(".carousel-prev").addEventListener("click", function () {
        go(index - 1);
      });
      root.querySelector(".carousel-next").addEventListener("click", function () {
        go(index + 1);
      });
    }

    /* ---------- 拖拽 / 触摸滑动 ---------- */
    /* 监听挂在 viewport 上,配合 setPointerCapture:事件随元素销毁而消失,
       pjax 反复换页不会在 window 上堆积监听器。
       捕获是"懒"的:按下时立刻捕获会吞掉箭头/圆点的 click(指针事件被
       重定向到 viewport),所以拖动超过 5px 才真正捕获。 */

    var dragging = false;
    var captured = false;
    var pointerId = 0;
    var startX = 0;
    var currentDelta = 0;
    var viewport = root.querySelector(".carousel-viewport");

    function dragStart(e) {
      if (count < 2) return;
      // 箭头/圆点是普通点击,不当作拖拽起点
      if (e.target.closest(".carousel-arrow, .carousel-dot")) return;
      dragging = true;
      captured = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      currentDelta = 0;
      stop();
    }

    function dragMove(x) {
      if (!dragging) return;
      currentDelta = x - startX;
      if (!captured && Math.abs(currentDelta) > 5) {
        captured = true;
        track.style.transition = "none";
        // 后续 pointer 事件持续派发给 viewport,即使指针移出轮播区域
        try {
          viewport.setPointerCapture(pointerId);
        } catch (_) {
          /* 老浏览器不支持时仅跟手范围小一点,不影响功能 */
        }
      }
      if (!captured) return;
      // 边缘阻力:第一张往右拉、最后一张往左拉时衰减一半
      var atEdge = (index === 0 && currentDelta > 0) || (index === count - 1 && currentDelta < 0);
      var dx = atEdge ? currentDelta / 2 : currentDelta;
      track.style.transform =
        "translateX(calc(" + -index * 100 + "% + " + dx + "px))";
    }

    function dragEnd() {
      if (!dragging) return;
      dragging = false;
      if (captured) {
        track.style.transition = "";
        // 拖动超过视口宽度 1/5 即翻页
        var width = viewport ? viewport.offsetWidth : root.offsetWidth;
        var threshold = width / 5;
        if (currentDelta <= -threshold) go(index + 1);
        else if (currentDelta >= threshold) go(index - 1);
        else render();
      }
      start();
    }

    viewport.addEventListener("pointerdown", dragStart);
    viewport.addEventListener("pointermove", function (e) {
      if (dragging) dragMove(e.clientX);
    });
    viewport.addEventListener("pointerup", dragEnd);
    viewport.addEventListener("pointercancel", dragEnd);
    // 双保险:拦掉原生拖拽(鼠标拖动时会拖出半透明图片重影)
    viewport.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });

    /* ---------- 点击图片 → 打开图片查看器 ---------- */
    /* 拖动翻页(captured=true)不算点击;箭头/圆点有自己的处理。
       image-zoom.js 会针对轮播图只在这一组图片之间翻阅。 */
    viewport.addEventListener("click", function (e) {
      if (e.target.closest(".carousel-arrow, .carousel-dot")) return;
      if (captured) return;
      var img = slides[index] && slides[index].querySelector("img");
      if (img && typeof window.openImageViewer === "function") {
        window.openImageViewer(img);
      }
    });

    /* ---------- 启动 ---------- */

    render();
    start();
  }

  function initAll() {
    document.querySelectorAll(".carousel").forEach(initCarousel);
  }

  // pjax 换页会重新派发 DOMContentLoaded,initCarousel 内部幂等
  document.addEventListener("DOMContentLoaded", initAll);
})();
