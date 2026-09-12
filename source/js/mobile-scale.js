/**
 * 手机端"精密刻度尺"导航 v2 (mobile-scale.js)
 *
 * 设计来源: precision-scale.html(Claude 设计方案)。
 * 展开汉堡菜单后,以横向可拖拽的刻度尺替代原竖排长列表:
 *   · 无限循环:拖到最后一项无缝绕回第一项(三圈绘制 + 取模归一);
 *   · 动量惯性 + 吸附卡位(无定位红线、无装饰图形,纯文字更清爽);
 *   · 点击一级项:叶子(首页/关于…)直接 pjax 跳转;
 *     "文章/更多"这类带子级的项 -> 面板下方弹出二级子窗口展示子链接;
 *   · 语言切换独立为顶栏国旗按钮(见 header.pug / lang-switch.js)。
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var SPACING = 130; // 相邻导航项中心距(更紧凑)
  var HEIGHT = 64; // 刻度尺高度
  var BASELINE = 36; // 文字基线

  var built = false;
  var items = []; // { title, href, external, children|null }
  var menuEl = null;
  var toggleEl = null;
  var viewport = null;
  var svg = null;
  var subRow = null;
  var nsItems = [];
  var N = 0;
  var W3 = 0; // 一圈宽度
  var HALF = 0;

  var offset = 0;
  var velocity = 0;
  var dragging = false;
  var rafId = null;
  var lastX = 0;
  var lastT = 0;
  var downX = 0;
  var downY = 0;
  var downT = 0;
  var startOffset = 0;
  var activeParent = -1;

  /* ---- 拖拽/惯性参数(承袭 precision-scale.html) ---- */
  var DRAG_RESISTANCE = 0.82;
  var MAX_VELOCITY = 1.05;
  var MOMENTUM_MULTIPLIER = 8;
  var MOMENTUM_FRICTION = 0.9;
  var SNAP_STRENGTH = 0.17;
  var STOP_EPSILON = 0.05;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function closePanel() {
    if (menuEl) menuEl.classList.remove("active");
    if (toggleEl) toggleEl.classList.remove("active");
  }

  function navigate(href) {
    closePanel();
    if (window.__magzinePjax && typeof window.__magzinePjax.load === "function") {
      window.__magzinePjax.load(href, true); // pjax 无感跳转
    } else {
      location.href = href;
    }
  }

  /* ---- 收集一级菜单(语言项已挪到顶栏国旗,跳过) ---- */
  function collectItems(menu) {
    var list = [];
    Array.prototype.forEach.call(menu.children, function (el) {
      if (el.classList.contains("search-toggle")) return;
      if (el.classList.contains("has-submenu")) {
        var children = [];
        Array.prototype.forEach.call(
          el.querySelectorAll(".submenu-item"),
          function (a) {
            var href = a.getAttribute("href") || "";
            children.push({
              title: a.textContent.trim(),
              href: href,
              external: /^https?:\/\//i.test(href),
            });
          }
        );
        var link = el.querySelector(".nav-link");
        list.push({
          title: link ? link.textContent.trim() : "",
          href: "",
          external: false,
          children: children,
        });
        return;
      }
      if (el.matches("a.nav-item")) {
        var href = el.getAttribute("href") || "";
        // 语言项已挪到顶栏国旗按钮:lang-switch 会移除其 href 并打上
        // data-lang-switch-btn 标记,两种形态都要跳过
        if (href.indexOf("#lang-switch") !== -1) return;
        if (el.hasAttribute("data-lang-switch-btn")) return;
        list.push({
          title: el.textContent.trim(),
          href: href,
          external: /^https?:\/\//i.test(href),
          children: null,
        });
      }
    });
    return list;
  }

  /* ---- 循环数学 ---- */
  function yi(i) {
    return i * SPACING + SPACING / 2 - HALF;
  }
  function wrap(v) {
    return ((v % W3) + W3 * 1.5) % W3 - HALF;
  }
  function normalize(v) {
    return wrap(v);
  }
  function distOf(i) {
    return wrap(offset + yi(i));
  }
  function centeredIndex() {
    var best = 0;
    var bestD = Infinity;
    for (var i = 0; i < N; i++) {
      var d = Math.abs(distOf(i));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function update() {
    svg.style.transform = "translateX(calc(-50% + " + offset + "px))";
    var cx = window.innerWidth / 2;
    for (var k = 0; k < nsItems.length; k++) {
      var el = nsItems[k];
      var band = +el.getAttribute("data-band");
      var i = +el.getAttribute("data-i");
      var screenX = cx + offset + (band - 1) * W3 + yi(i);
      var dist = Math.abs(screenX - cx);
      var influence = Math.max(0, Math.min(1, 1 - dist / 110));
      influence = influence * influence * (3 - 2 * influence);
      el.style.transform = "scale(" + (1 + influence * 0.16) + ")";
      el.style.opacity = 0.35 + influence * 0.65;
      el.style.filter =
        "saturate(" +
        (0.25 + influence * 0.75) +
        ") brightness(" +
        (0.92 + influence * 0.08) +
        ")";
    }
  }

  /* ---- 物理:拖拽 / 惯性 / 吸附 ---- */
  function momentum() {
    if (dragging) return;
    if (Math.abs(velocity) > 0.02) {
      offset = normalize(offset + velocity * MOMENTUM_MULTIPLIER);
      velocity *= MOMENTUM_FRICTION;
      update();
      rafId = requestAnimationFrame(momentum);
    } else {
      snapTo(offset - distOf(centeredIndex()));
    }
  }

  function snapTo(target) {
    if (dragging) return;
    var diff = target - offset;
    if (Math.abs(diff) < STOP_EPSILON) {
      offset = normalize(target);
      update();
      return;
    }
    offset += diff * SNAP_STRENGTH;
    update();
    rafId = requestAnimationFrame(function () {
      snapTo(target);
    });
  }

  /* ---- 二级子窗口 ---- */
  function isCurrent(href) {
    if (!href || href.charAt(0) !== "/") return false;
    var path = location.pathname;
    if (path.length > 1 && path.charAt(path.length - 1) !== "/") path += "/";
    var norm = href.length > 1 && href.charAt(href.length - 1) !== "/" ? href + "/" : href;
    return norm === path;
  }

  function showSub(idx) {
    activeParent = idx;
    var it = items[idx];
    subRow.innerHTML = "";
    it.children.forEach(function (c) {
      var a = document.createElement("a");
      a.textContent = c.title;
      if (c.external) a.target = "_blank";
      a.rel = "noopener";
      if (isCurrent(c.href)) a.classList.add("active");
      a.addEventListener("click", function (e) {
        e.preventDefault();
        if (c.external) {
          window.open(c.href, "_blank", "noopener");
          return;
        }
        navigate(c.href);
      });
      subRow.appendChild(a);
    });
    subRow.classList.add("show");
  }

  function hideSub() {
    activeParent = -1;
    subRow.classList.remove("show");
  }

  /* ---- 点击 ---- */
  function tapNavigate(clientX) {
    var cx = window.innerWidth / 2;
    var rel = clientX - cx - offset;
    var best = -1;
    var bestD = SPACING / 2;
    for (var i = 0; i < N; i++) {
      var d = Math.abs(wrap(yi(i) - rel));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    var it = items[best];
    if (it.children && it.children.length) {
      // 一级路径带子级:在下方弹出/收起二级子窗口
      if (activeParent === best) hideSub();
      else showSub(best);
      return;
    }
    navigate(it.href);
  }

  /* ---- 构建 ---- */
  function currentPathIndex() {
    for (var i = 0; i < items.length; i++) {
      if (isCurrent(items[i].href)) return i;
      if (items[i].children) {
        for (var j = 0; j < items[i].children.length; j++) {
          if (isCurrent(items[i].children[j].href)) return i;
        }
      }
    }
    return 0;
  }

  function syncToCurrent() {
    var idx = currentPathIndex();
    offset = normalize(-yi(idx));
    update();
    var it = items[idx];
    if (it.children && it.children.length) showSub(idx);
    else hideSub();
  }

  function build(menu) {
    if (menu.querySelector(".nav-scale")) return;
    menuEl = menu;
    toggleEl = document.querySelector(".nav-toggle");
    items = collectItems(menu);
    N = items.length;
    if (!N) return;
    W3 = N * SPACING;
    HALF = W3 / 2;

    var panel = document.createElement("div");
    panel.className = "nav-scale";
    viewport = document.createElement("div");
    viewport.className = "nav-scale-viewport";
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W3 * 3 + " " + HEIGHT);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = W3 * 3 + "px";
    var track = document.createElementNS(NS, "g");
    svg.appendChild(track);

    // 三圈绘制:中圈为主,左右两圈保证无限循环无缝(纯文字,无装饰图形)
    for (var c = 0; c < 3; c++) {
      for (var i = 0; i < N; i++) {
        var x = c * W3 + i * SPACING + SPACING / 2;
        var g = document.createElementNS(NS, "g");
        g.setAttribute("class", "ns-item");
        g.setAttribute("data-band", c);
        g.setAttribute("data-i", i);
        var t = document.createElementNS(NS, "text");
        t.setAttribute("class", "ns-text");
        t.setAttribute("x", x);
        t.setAttribute("y", BASELINE);
        t.textContent = items[i].title;
        g.appendChild(t);
        track.appendChild(g);
      }
    }

    subRow = document.createElement("div");
    subRow.className = "nav-scale-sub";

    viewport.appendChild(svg);
    panel.appendChild(viewport);
    panel.appendChild(subRow);
    menu.insertBefore(panel, menu.firstChild);

    nsItems = panel.querySelectorAll(".ns-item");

    /* ---- 指针事件 ---- */
    viewport.addEventListener("pointerdown", function (e) {
      dragging = true;
      cancelAnimationFrame(rafId);
      lastX = e.clientX;
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
      startOffset = offset;
      velocity = 0;
      viewport.classList.add("dragging");
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var now = performance.now();
      var dt = Math.max(1, now - lastT);
      offset = normalize(startOffset + (e.clientX - downX) * DRAG_RESISTANCE);
      velocity = Math.max(
        -MAX_VELOCITY,
        Math.min(MAX_VELOCITY, ((e.clientX - lastX) * DRAG_RESISTANCE) / dt)
      );
      lastX = e.clientX;
      lastT = now;
      update();
    });

    function stopDrag(e) {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove("dragging");
      var dt = performance.now() - downT;
      var dx = e.clientX - downX;
      var dy = e.clientY - downY;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 400) {
        tapNavigate(e.clientX);
        snapTo(offset - distOf(centeredIndex()));
        return;
      }
      rafId = requestAnimationFrame(momentum);
    }

    viewport.addEventListener("pointerup", stopDrag);
    viewport.addEventListener("pointercancel", stopDrag);
    window.addEventListener("resize", function () {
      update();
    });
    document.addEventListener("pjax:complete", function () {
      syncToCurrent();
    });

    built = true;
  }

  // 暴露给 main.js:展开菜单时懒构建(此时文案已按当前语言翻译)
  window.__buildNavScale = function (menu) {
    if (!isMobile()) return;
    if (built) {
      syncToCurrent();
      return;
    }
    build(menu);
    syncToCurrent();
  };
})();
