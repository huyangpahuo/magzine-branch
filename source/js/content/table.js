/**
 * table.js — Table enhancement: collapse, horizontal scroll, fullscreen viewer.
 *
 * • Tables with more than TABLE_COLLAPSE_ROWS rows get a fade + "展开表格" toggle.
 * • ALL tables get horizontal scroll via mouse-wheel (vertical delta → horizontal).
 * • Fullscreen viewer is self-contained (no external dependency).
 * • Copy button copies the full table as HTML (with TSV fallback).
 */

(function () {
  "use strict";

  var TABLE_COLLAPSE_ROWS = 8;
  var WHEEL_MULTIPLIER = 3;

  /* ── Icons ─────────────────────────────────────────────────────────── */
  var I_FULLSCREEN =
    '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
  var I_COPY =
    '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
  var I_ZOOM_IN =
    '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2z"/></svg>';
  var I_ZOOM_OUT =
    '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"/></svg>';
  var I_ZOOM_RESET =
    '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';
  var I_ROTATE =
    '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
  var I_RESET =
    '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

  function isMobile() {
    return window.innerWidth <= 768;
  }

  /* ── Copy table as HTML (fallback: TSV) ─────────────────────────────── */
  function copyTable(table, noticeEl) {
    var html = table.outerHTML;
    var tsv = tableToTsv(table);

    function flash() {
      if (!noticeEl) return;
      noticeEl.style.opacity = "1";
      setTimeout(function () {
        noticeEl.style.opacity = "0";
      }, 1500);
    }

    if (
      typeof ClipboardItem !== "undefined" &&
      navigator.clipboard &&
      navigator.clipboard.write
    ) {
      try {
        var item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([tsv], { type: "text/plain" }),
        });
        navigator.clipboard
          .write([item])
          .then(flash)
          .catch(function () {
            navigator.clipboard.writeText(tsv).then(flash).catch(flash);
          });
        return;
      } catch (e) {}
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(tsv).then(flash).catch(flash);
    } else {
      var ta = document.createElement("textarea");
      ta.value = tsv;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {}
      ta.remove();
      flash();
    }
  }

  /* ── Convert table → TSV (fallback for copy) ────────────────────────── */
  function tableToTsv(table) {
    return Array.from(table.querySelectorAll("tr"))
      .map(function (tr) {
        return Array.from(tr.querySelectorAll("th,td"))
          .map(function (td) {
            return (td.innerText || td.textContent).replace(/\t/g, " ").trim();
          })
          .join("\t");
      })
      .join("\n");
  }

  /* ── Horizontal scroll via vertical mouse-wheel ─────────────────────── */
  function attachHScroll(scrollEl) {
    scrollEl.addEventListener(
      "wheel",
      function (e) {
        if (e.shiftKey) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        var isScrollable = this.scrollWidth > this.clientWidth;
        if (!isScrollable) return;
        var delta = e.deltaY * WHEEL_MULTIPLIER;
        var atLeft = this.scrollLeft <= 0;
        var atRight =
          Math.ceil(this.scrollLeft + this.clientWidth) >= this.scrollWidth;
        if (delta > 0 && !atRight) {
          e.preventDefault();
          this.scrollLeft += delta;
        } else if (delta < 0 && !atLeft) {
          e.preventDefault();
          this.scrollLeft += delta;
        }
      },
      { passive: false },
    );
  }

  /* ── Self-contained fullscreen viewer ──────────────────────────────── */
  var viewer = null;

  function getViewer() {
    if (viewer) return viewer;

    var overlay = document.createElement("div");
    overlay.className = "table-viewer";

    // Mobile uses a flex-centering container (like image-zoom's
    // .image-viewer-container) so CSS handles fit-to-screen naturally.
    var container = document.createElement("div");
    container.className = "table-viewer-container";

    var stage = document.createElement("div");
    stage.className = "table-viewer-stage";

    var closeBtn = document.createElement("div");
    closeBtn.className = "table-viewer-close";
    closeBtn.innerHTML = "&times;";

    var toolbar = document.createElement("div");
    toolbar.className = "table-viewer-toolbar";

    container.appendChild(stage);
    overlay.appendChild(container);
    overlay.appendChild(closeBtn);
    overlay.appendChild(toolbar);
    document.body.appendChild(overlay);

    // Pan/zoom/rotate/lock state
    var scale = 1;
    var fitScale = 1;
    var tx = 0;
    var ty = 0;
    var rotation = 0;
    var isLocked = false;
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var lastTouchX = 0;
    var lastTouchY = 0;
    var startDist = 0;
    var startScale = 1;

    // Desktop: stage absolutely positioned (top:50%, left:50%), transform
    //   carries the full translate(-50%+tx, -50%+ty) + scale.
    // Mobile: overlay is a flex container, stage is CSS-centered.
    //   transform is purely translate(tx,ty) rotate(deg) scale(s) — just
    //   like image-zoom's viewImage transform model.
    function updateTransform(animate) {
      stage.style.transition = animate
        ? "transform 0.3s cubic-bezier(0.25,0.8,0.25,1)"
        : "none";
      if (isMobile()) {
        stage.style.transform =
          "translate(" +
          tx +
          "px," +
          ty +
          "px) rotate(" +
          rotation +
          "deg) scale(" +
          scale +
          ")";
      } else {
        stage.style.transform =
          "translate(calc(-50% + " +
          tx +
          "px), calc(-50% + " +
          ty +
          "px)) scale(" +
          scale +
          ")";
      }
    }

    function resetTransform(animate) {
      scale = fitScale;
      tx = 0;
      ty = 0;
      rotation = 0;
      updateTransform(animate !== false);
    }

    var mobileResetBtn = null;

    // 模态 iframe 内打开/关闭时通知父页面沉底桌宠(同 image-zoom.js)
    function notifyParentViewer(open) {
      if (window.PetLayers) {
        if (open) window.PetLayers.muteParticles();
        else window.PetLayers.unmuteParticles();
      }
      if (window.parent !== window) {
        try {
          window.parent.postMessage({ type: "magzine-viewer", open: open }, "*");
        } catch (err) {}
      }
    }

    function open(table, onToolbar) {
      stage.innerHTML = "";
      tx = 0;
      ty = 0;
      rotation = 0;
      isLocked = false;
      mobileResetBtn = null;

      // Clone the table into a styled container
      var wrap = document.createElement("div");
      wrap.className = "table-viewer-content";
      wrap.appendChild(table.cloneNode(true));
      stage.appendChild(wrap);

      // ── Build toolbar ────────────────────────────────────────────
      toolbar.innerHTML = "";

      if (isMobile()) {
        // Mobile toolbar: Copy · Lock · Rotate  (image-zoom style)
        var mobileCopyBtn = document.createElement("button");
        mobileCopyBtn.className = "table-viewer-btn";
        mobileCopyBtn.setAttribute("data-title", "复制表格");
        mobileCopyBtn.innerHTML = I_COPY;
        mobileCopyBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          copyTable(table, null);
          mobileCopyBtn.setAttribute("data-title", "已复制 ✓");
          setTimeout(function () {
            mobileCopyBtn.setAttribute("data-title", "复制表格");
          }, 1500);
        });

        mobileResetBtn = document.createElement("button");
        mobileResetBtn.className = "table-viewer-btn reset-btn";
        mobileResetBtn.setAttribute("data-title", "复原");
        mobileResetBtn.innerHTML = I_RESET;
        mobileResetBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          // 一键恢复原状:旋转角度/缩放/平移全部复位
          rotation = 0;
          isLocked = false;
          resetTransform(true);
          mobileResetBtn.classList.remove("active");
        });

        var mobileRotateBtn = document.createElement("button");
        mobileRotateBtn.className = "table-viewer-btn rotate-btn";
        mobileRotateBtn.setAttribute("data-title", "旋转90°");
        mobileRotateBtn.innerHTML = I_ROTATE;
        mobileRotateBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          rotation += 90;
          updateTransform(true);
        });

        toolbar.appendChild(mobileCopyBtn);
        toolbar.appendChild(mobileResetBtn);
        toolbar.appendChild(mobileRotateBtn);

        // Mobile: measure the stage's natural size and compute a fitScale so
        // the entire table is visible at once — same logic as desktop, but using
        // the CSS-centered coordinate system (transform is pure tx/ty offset).
        stage.style.transition = "none";
        stage.style.transform = "translate(0,0) rotate(0deg) scale(1)";
        var stageW = stage.offsetWidth;
        var stageH = stage.offsetHeight;
        var availW = window.innerWidth * 0.95;
        var availH = window.innerHeight * 0.65;
        scale =
          stageW > 0 && stageH > 0
            ? Math.min(1, availW / stageW, availH / stageH)
            : 1;
        fitScale = scale;

        stage.style.opacity = "0.5";
        overlay.classList.add("active");
        notifyParentViewer(true);
        document.body.style.overflow = "hidden";
        void stage.offsetWidth;
        stage.style.transition = "opacity 0.15s ease";
        stage.style.opacity = "1";
      } else {
        // Desktop toolbar: Copy · divider · Zoom In · Zoom Out · Reset
        if (typeof onToolbar === "function") onToolbar(toolbar);

        if (toolbar.children.length > 0) {
          var divider = document.createElement("div");
          divider.className = "table-viewer-toolbar-divider";
          toolbar.appendChild(divider);
        }

        function makeBtn(title, icon, onClick) {
          var btn = document.createElement("button");
          btn.className = "table-viewer-btn";
          btn.setAttribute("data-title", title);
          btn.innerHTML = icon;
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            onClick();
          });
          return btn;
        }

        toolbar.appendChild(
          makeBtn("放大", I_ZOOM_IN, function () {
            scale = Math.min(scale * 1.25, 10);
            updateTransform(true);
          }),
        );
        toolbar.appendChild(
          makeBtn("缩小", I_ZOOM_OUT, function () {
            scale = Math.max(scale / 1.25, 0.1);
            updateTransform(true);
          }),
        );
        toolbar.appendChild(
          makeBtn("重置", I_ZOOM_RESET, function () {
            resetTransform(true);
          }),
        );

        // Measure stage at natural size to compute fitScale
        stage.style.transition = "none";
        stage.style.transform = "translate(-50%, -50%) scale(1)";
        var stageW = stage.offsetWidth;
        var stageH = stage.offsetHeight;
        var availW = window.innerWidth * 0.9;
        var availH = window.innerHeight * 0.72;

        fitScale =
          stageW > 0 && stageH > 0
            ? Math.min(1, availW / stageW, availH / stageH)
            : 1;

        scale = fitScale * 0.85;
        updateTransform(false);
        overlay.classList.add("active");
        notifyParentViewer(true);
        document.body.style.overflow = "hidden";
        void stage.offsetWidth;
        scale = fitScale;
        updateTransform(true);
      }
    }

    function close() {
      overlay.classList.remove("active");
      document.body.style.overflow = "";
      notifyParentViewer(false);
      isLocked = false;
      if (mobileResetBtn) mobileResetBtn.classList.remove("active");
    }

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target === container) close();
    });
    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("active")) return;
      if (e.key === "Escape") close();
    });

    // Orientation change: reset unless locked (mirrors image-zoom)
    window.addEventListener("orientationchange", function () {
      if (!overlay.classList.contains("active")) return;
      if (isLocked) return;
      setTimeout(function () {
        resetTransform(true);
      }, 300);
    });

    // Wheel zoom
    overlay.addEventListener(
      "wheel",
      function (e) {
        if (!overlay.classList.contains("active")) return;
        e.preventDefault();
        scale = Math.min(Math.max(0.1, scale * (e.deltaY < 0 ? 1.1 : 0.9)), 10);
        updateTransform(false);
      },
      { passive: false },
    );

    // Mouse drag
    // ★ 拖动惯性(与图片查看器同款手感):追踪瞬时速度,松手后滑行衰减
    var dragVel = { x: 0, y: 0, lastX: 0, lastY: 0, lastT: 0 };
    var momentumRaf = 0;
    function glide() {
      cancelAnimationFrame(momentumRaf);
      var vX = Math.max(-60, Math.min(60, dragVel.x * 16));
      var vY = Math.max(-60, Math.min(60, dragVel.y * 16));
      var step = function () {
        vX *= 0.92;
        vY *= 0.92;
        if (Math.abs(vX) < 0.15 && Math.abs(vY) < 0.15) return;
        tx += vX;
        ty += vY;
        updateTransform(false);
        momentumRaf = requestAnimationFrame(step);
      };
      momentumRaf = requestAnimationFrame(step);
    }

    var lastTouchSingle = false;
    var touchRaf2 = 0; // 触摸平移 rAF 合帧
    // 触摸松手:单指平移结束时触发惯性滑行
    overlay.addEventListener("touchend", function () {
      cancelAnimationFrame(touchRaf2);
      touchRaf2 = 0;
      if (lastTouchSingle) glide();
      lastTouchSingle = false;
    });

    stage.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      isDragging = true;
      cancelAnimationFrame(momentumRaf);
      startX = e.clientX - tx;
      startY = e.clientY - ty;
      dragVel = { x: 0, y: 0, lastX: e.clientX, lastY: e.clientY, lastT: Date.now() };
      latestPtr = { x: e.clientX, y: e.clientY };
      stage.style.willChange = "transform";
      stage.style.cursor = "grabbing";
      e.preventDefault();
    });
    // ★ rAF 合帧:事件只记录坐标,每帧最多写一次 style(高回报率鼠标防卡顿)
    var panRaf = 0;
    var latestPtr = { x: 0, y: 0 };
    document.addEventListener("mousemove", function (e) {
      if (!isDragging) return;
      e.preventDefault();
      var now = Date.now();
      var dt = Math.max(1, now - dragVel.lastT);
      dragVel.x = (e.clientX - dragVel.lastX) / dt;
      dragVel.y = (e.clientY - dragVel.lastY) / dt;
      dragVel.lastX = e.clientX;
      dragVel.lastY = e.clientY;
      dragVel.lastT = now;
      latestPtr.x = e.clientX;
      latestPtr.y = e.clientY;
      if (panRaf) return;
      panRaf = requestAnimationFrame(function () {
        panRaf = 0;
        tx = latestPtr.x - startX;
        ty = latestPtr.y - startY;
        updateTransform(false);
      });
    });
    document.addEventListener("mouseup", function () {
      if (isDragging) {
        isDragging = false;
        stage.style.willChange = "";
        stage.style.cursor = "grab";
        glide();
      }
    });

    // Touch pinch/pan — bound to overlay so panning works when the
    // finger starts on the dark background outside the stage.
    overlay.addEventListener(
      "touchstart",
      function (e) {
        if (e.target.closest(".table-viewer-toolbar, .table-viewer-close"))
          return;
        if (e.touches.length === 1) {
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          lastTouchSingle = false;
          startDist = Math.hypot(
            e.touches[1].clientX - e.touches[0].clientX,
            e.touches[1].clientY - e.touches[0].clientY,
          );
          startScale = scale;
        }
      },
      { passive: false },
    );

    overlay.addEventListener(
      "touchmove",
      function (e) {
        if (e.target.closest(".table-viewer-toolbar, .table-viewer-close"))
          return;
        e.preventDefault();
        if (e.touches.length === 1) {
          lastTouchSingle = true;
          var nowT = Date.now();
          var dtT = Math.max(1, nowT - (dragVel.lastT || nowT));
          dragVel.x = (e.touches[0].clientX - (dragVel.lastX || e.touches[0].clientX)) / dtT;
          dragVel.y = (e.touches[0].clientY - (dragVel.lastY || e.touches[0].clientY)) / dtT;
          dragVel.lastX = e.touches[0].clientX;
          dragVel.lastY = e.touches[0].clientY;
          dragVel.lastT = nowT;
          // rAF 合帧:采样率高于刷新率的触屏逐事件写 style 会掉帧
          var dxT = e.touches[0].clientX - lastTouchX;
          var dyT = e.touches[0].clientY - lastTouchY;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
          if (touchRaf2) return;
          touchRaf2 = requestAnimationFrame(function () {
            touchRaf2 = 0;
            tx += dxT;
            ty += dyT;
            updateTransform(false);
          });
        } else if (e.touches.length === 2) {
          var newDist = Math.hypot(
            e.touches[1].clientX - e.touches[0].clientX,
            e.touches[1].clientY - e.touches[0].clientY,
          );
          if (newDist > 0 && startDist > 0) {
            scale = Math.min(
              Math.max(0.1, startScale * (newDist / startDist)),
              10,
            );
            updateTransform(false);
          }
        }
      },
      { passive: false },
    );

    viewer = { open: open, close: close };
    return viewer;
  }

  /* ── Open fullscreen for a table ────────────────────────────────────── */
  function openFullscreen(table) {
    var v = getViewer();
    v.open(table, function (toolbar) {
      // Desktop-only copy button (mobile has its own in the unified toolbar)
      var notice = document.createElement("span");
      notice.className = "table-viewer-copy-notice";
      notice.textContent = "已复制";

      var cpBtn = document.createElement("button");
      cpBtn.className = "table-viewer-btn";
      cpBtn.setAttribute("data-title", "复制表格");
      cpBtn.innerHTML = I_COPY;
      cpBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        copyTable(table, notice);
        cpBtn.setAttribute("data-title", "已复制 ✓");
        setTimeout(function () {
          cpBtn.setAttribute("data-title", "复制表格");
        }, 1500);
      });

      toolbar.appendChild(cpBtn);
      toolbar.appendChild(notice);
    });
  }

  /* ── Main init ──────────────────────────────────────────────────────── */
  function initTables() {
    document
      .querySelectorAll(".post-content table, #article-container table")
      .forEach(function (table) {
        if (
          table.closest("figure.highlight") ||
          table.closest(".highlight-tools")
        )
          return;
        if (table.parentElement.classList.contains("table-wrapper")) return;

        var rows = table.querySelectorAll("tr").length;
        var needsCollapse = rows > TABLE_COLLAPSE_ROWS;

        var wrapper = document.createElement("div");
        wrapper.className = "table-wrapper";
        var box = document.createElement("div");
        box.className = "table-box";
        table.parentNode.insertBefore(box, table);
        box.appendChild(wrapper);
        wrapper.appendChild(table);
        attachHScroll(wrapper);

        var toolbar = document.createElement("div");
        toolbar.className = "table-toolbar";

        var copyNotice = document.createElement("span");
        copyNotice.className = "table-copy-notice";
        copyNotice.textContent = "已复制";

        var cpBtn = document.createElement("button");
        cpBtn.className = "table-toolbar-btn";
        cpBtn.setAttribute("data-title", "复制表格");
        cpBtn.setAttribute("aria-label", "复制表格");
        cpBtn.innerHTML = I_COPY;
        cpBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          copyTable(table, copyNotice);
          cpBtn.setAttribute("data-title", "已复制 ✓");
          setTimeout(function () {
            cpBtn.setAttribute("data-title", "复制表格");
          }, 1500);
        });

        var fsBtn = document.createElement("button");
        fsBtn.className = "table-toolbar-btn";
        fsBtn.setAttribute("data-title", "全屏查看");
        fsBtn.setAttribute("aria-label", "全屏查看");
        fsBtn.innerHTML = I_FULLSCREEN;
        fsBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          openFullscreen(table);
        });

        toolbar.appendChild(copyNotice);
        toolbar.appendChild(cpBtn);
        toolbar.appendChild(fsBtn);
        box.parentNode.insertBefore(toolbar, box);

        if (needsCollapse) {
          box.classList.add("table-collapsed");

          var toggleBtn = document.createElement("button");
          toggleBtn.className = "table-toggle";
          toggleBtn.textContent = "展开表格";
          toggleBtn.addEventListener("click", function () {
            var isCollapsed = box.classList.contains("table-collapsed");
            box.classList.toggle("table-collapsed", !isCollapsed);
            box.classList.toggle("table-expanded", isCollapsed);
            toggleBtn.textContent = isCollapsed ? "折叠表格" : "展开表格";
            // 折叠回去时复位横向滚动,否则停在半途看着像内容缺了一截
            if (isCollapsed) wrapper.scrollLeft = 0;
          });

          box.parentNode.insertBefore(toggleBtn, box.nextSibling);
        }
      });
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTables);
  } else {
    initTables();
  }
})();
