/**
 * ============================================
 * 图片查看器 (image-zoom.js)
 *
 * 电脑端:
 *   - 背景随明暗模式变化(暗:透明黑 / 亮:模糊透明白)
 *   - 两种切换方式(config.yml image_viewer.desktop_switch_mode):
 *       "buttons" 上一张/下一张按钮
 *       "peek"    两侧半透明预览图,点击后贝塞尔曲线丝滑切换
 *   - 旋转/锁定/保存按钮紧贴查看界面上边缘,默认隐藏,鼠标靠近出现,离开 1 秒后隐藏
 *   - 底部缩略图:本图 + 前 3 张 + 后 3 张(圆角,固定高度,随图切换)
 *   - 滚轮切换图片;双击以点击位置为中心放大,再双击复原;点击空白处关闭
 *   - 按住左右拖动可切换图片(不支持自由拖动);放大后拖动改为平移
 *   - 单击图片:隐藏/显示"两侧缩略图 + 上一张/下一张按钮 + 底部缩略图"
 *     (工具栏显隐逻辑独立,不受影响)
 *
 * 手机端:
 *   - 相册式左右滑动翻阅,图片等比铺满屏幕(上下留空白用于点击退出)
 *   - 单击图片显示/隐藏 工具栏+缩略图;点击上下空白退出
 *   - 双指捏合缩放:以双指中点为锚点,内容跟手不跳动;
 *     合拢(缩小手势)进入胶片模式(显示前后图片,可左右滚动查看)
 *   - 放大后单指拖动平移查看不同区域,不触发左右切换;双击恢复原状
 *
 * 锁定按钮:锁定后,当前旋转角度会应用到之后切换的所有图片。
 * ============================================
 */

(function () {
  "use strict";

  function getDist(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* ============ 配置 ============ */
    const cfg = Object.assign(
      {
        desktop_thumbnails: true,
        mobile_thumbnails: true,
        desktop_switch_mode: "peek",
      },
      (window.theme && window.theme.image_viewer) || {},
    );

    const isMobile = () => window.innerWidth <= 768;
    const usePeekMode = () => !isMobile() && cfg.desktop_switch_mode === "peek";
    const useButtonsMode = () => !isMobile() && cfg.desktop_switch_mode !== "peek";
    const showThumbs = () => (isMobile() ? !!cfg.mobile_thumbnails : !!cfg.desktop_thumbnails);

    /* ============ 图标 ============ */
    const icons = {
      rotate:
        '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
      lock: '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
      unlock:
        '<svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>',
      download:
        '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
    };

    /* ============ DOM ============ */
    const imageViewer = document.createElement("div");
    imageViewer.className = "image-viewer";
    imageViewer.innerHTML = `
      <div class="viewer-stage">
        <img src="" alt="" class="view-image" draggable="false">
      </div>
      <div class="viewer-peek prev"><img src="" alt="" draggable="false"></div>
      <div class="viewer-peek next"><img src="" alt="" draggable="false"></div>
      <div class="nav-btn prev" data-title="上一张">❮</div>
      <div class="nav-btn next" data-title="下一张">❯</div>
      <div class="viewer-toolbar">
        <button class="toolbar-btn rotate-btn" data-title="旋转90°">${icons.rotate}</button>
        <button class="toolbar-btn lock-btn" data-title="正向锁定">${icons.lock}</button>
        <button class="toolbar-btn download-btn" data-title="保存图片">${icons.download}</button>
      </div>
      <div class="viewer-thumbs"></div>
    `;
    document.body.appendChild(imageViewer);

    const stage = imageViewer.querySelector(".viewer-stage");
    const viewImage = imageViewer.querySelector(".view-image");
    const peekPrev = imageViewer.querySelector(".viewer-peek.prev");
    const peekNext = imageViewer.querySelector(".viewer-peek.next");
    const peekPrevImg = peekPrev.querySelector("img");
    const peekNextImg = peekNext.querySelector("img");
    const navPrev = imageViewer.querySelector(".nav-btn.prev");
    const navNext = imageViewer.querySelector(".nav-btn.next");
    const toolbar = imageViewer.querySelector(".viewer-toolbar");
    const btnRotate = imageViewer.querySelector(".rotate-btn");
    const btnLock = imageViewer.querySelector(".lock-btn");
    const btnDownload = imageViewer.querySelector(".download-btn");
    const thumbsEl = imageViewer.querySelector(".viewer-thumbs");

    // 手动触发一次翻译(动态插入的元素)
    if (window.i18n && window.i18n.translateNode) {
      window.i18n.translateNode(imageViewer);
    }

    /* ============ 状态 ============ */
    const state = {
      images: [], // 可查看的图片元素列表
      index: 0,
      rotation: 0, // 当前旋转角度
      locked: false, // 锁定:切换图片时保留旋转角度
      scale: 1,
      origin: "center", // 缩放中心
      tx: 0, // 缩放平移补偿(像素,用于捏合锚点跟手/放大后单指平移)
      ty: 0,
      zoomed: false, // 双击/双指放大状态
    };

    let slideBusy = false; // 切换动画进行中(防连点)

    /* ============ 变换应用 ============ */
    function applyTransform(anim) {
      viewImage.style.transition = anim
        ? "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)"
        : "none";
      viewImage.style.transformOrigin = state.origin;
      viewImage.style.transform = `translate(${state.tx}px, ${state.ty}px) rotate(${state.rotation}deg) scale(${state.scale})`;
    }

    /* ============ 加载某一张图(立即切换,无黑闪;状态按锁定规则处理) ============ */
    function loadImage(index) {
      if (index < 0 || index >= state.images.length) return;
      state.index = index;
      // 立即换图,不做透明度过渡
      const target = state.images[index];
      viewImage.src = target.currentSrc || target.src;
      viewImage.alt = target.alt || "";
      // 切换后的状态:缩放/位移复原;旋转按锁定规则处理
      state.scale = 1;
      state.zoomed = false;
      state.origin = "center";
      state.tx = 0;
      state.ty = 0;
      if (!state.locked) state.rotation = 0;
      applyTransform(false);
      updateNavDisabled();
      updatePeek();
      renderThumbs();
    }

    function updateNavDisabled() {
      navPrev.classList.toggle("disabled", state.index <= 0);
      navNext.classList.toggle(
        "disabled",
        state.index >= state.images.length - 1,
      );
    }

    /* ============ 两侧半透明预览图(peek 模式 / 手机胶片模式) ============ */
    function updatePeek() {
      const showPeek = usePeekMode() || filmstrip;
      peekPrev.style.display = showPeek && state.index > 0 ? "flex" : "none";
      peekNext.style.display =
        showPeek && state.index < state.images.length - 1 ? "flex" : "none";
      if (state.index > 0)
        peekPrevImg.src = state.images[state.index - 1].currentSrc || state.images[state.index - 1].src;
      if (state.index < state.images.length - 1)
        peekNextImg.src =
          state.images[state.index + 1].currentSrc ||
          state.images[state.index + 1].src;
      if (filmstrip) {
        peekPrev.style.opacity = "0.6";
        peekNext.style.opacity = "0.6";
      }
    }

    /* ============ 底部缩略图(本图 + 前/后各 N 张) ============ */
    function renderThumbs() {
      const range = isMobile() ? 2 : 3;
      const show = showThumbs();
      thumbsEl.style.display = show ? "flex" : "none";
      if (!show) return;

      thumbsEl.innerHTML = "";
      const start = Math.max(0, state.index - range);
      const end = Math.min(state.images.length - 1, state.index + range);

      for (let i = start; i <= end; i++) {
        const t = document.createElement("div");
        t.className = "thumb" + (i === state.index ? " active" : "");
        const img = document.createElement("img");
        img.src = state.images[i].currentSrc || state.images[i].src;
        img.draggable = false;
        t.appendChild(img);
        // 距离越远透明度越低
        const dist = Math.abs(i - state.index);
        t.style.opacity = String(Math.max(0.3, 1 - dist * 0.18));
        if (i === state.index) t.classList.add("active");
        t.addEventListener("click", (e) => {
          e.stopPropagation();
          if (i !== state.index) switchTo(i);
        });
        thumbsEl.appendChild(t);
      }

      // 手机端:当前缩略图滚动居中
      const active = thumbsEl.querySelector(".thumb.active");
      if (active && isMobile()) {
        active.scrollIntoView({ block: "nearest", inline: "center" });
      }
    }

    /* ============ 丝滑切换(贝塞尔曲线滑动) ============ */
    function switchTo(index, animate = true) {
      if (index < 0 || index >= state.images.length) return;
      if (index === state.index) return;
      const dir = index > state.index ? 1 : -1;

      if (!animate || slideBusy) {
        loadImage(index);
        return;
      }
      slideBusy = true;
      // 当前图滑出
      stage.style.transition =
        "transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.4s ease";
      stage.style.transform = `translateX(${dir * -18}%) scale(0.94)`;
      stage.style.opacity = "0";
      setTimeout(() => {
        loadImage(index);
        // 新图从另一侧滑入
        stage.style.transition = "none";
        stage.style.transform = `translateX(${dir * 18}%) scale(0.94)`;
        stage.style.opacity = "0";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            stage.style.transition =
              "transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.4s ease";
            stage.style.transform = "translateX(0) scale(1)";
            stage.style.opacity = "1";
            setTimeout(() => {
              stage.style.transition = "none";
              slideBusy = false;
            }, 420);
          });
        });
      }, 240);
    }

    /* ============ 打开 / 关闭 ============ */
    function openViewer(clickedImg) {
      const imgs = Array.from(document.querySelectorAll(".post-content img"));
      if (imgs.length === 0) return;
      state.images = imgs;
      const idx = Math.max(
        0,
        imgs.findIndex((im) => im === clickedImg),
      );
      // 依据端别应用配置类
      imageViewer.classList.toggle("mobile", isMobile());
      imageViewer.classList.toggle("mode-buttons", useButtonsMode());
      imageViewer.classList.toggle("mode-peek", usePeekMode());
      imageViewer.classList.remove("controls-hidden", "filmstrip", "ui-hidden");
      loadImage(idx);
      imageViewer.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeViewer() {
      imageViewer.classList.remove("active");
      document.body.style.overflow = "";
      stage.style.transform = "";
      stage.style.opacity = "";
      slideBusy = false;
    }

    // 事件委托:点击文章内图片打开(pjax 换页后依旧有效)
    document.addEventListener("click", function (e) {
      const img = e.target.closest(".post-content img");
      if (img) openViewer(img);
    });

    // 点击空白处(stage/viewer 自身)关闭
    imageViewer.addEventListener("click", (e) => {
      if (e.target === stage || e.target === imageViewer) closeViewer();
    });

    // 点击两侧半透明预览图 → 丝滑切换
    peekPrev.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!slideBusy && state.index > 0) switchTo(state.index - 1);
    });
    peekNext.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!slideBusy && state.index < state.images.length - 1)
        switchTo(state.index + 1);
    });

    // 上一张/下一张按钮(buttons 模式) → 与 peek 同样的丝滑切换
    navPrev.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!slideBusy && state.index > 0) switchTo(state.index - 1);
    });
    navNext.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!slideBusy && state.index < state.images.length - 1)
        switchTo(state.index + 1);
    });

    /* ============ 工具栏:旋转 / 锁定 / 保存 ============ */
    btnRotate.addEventListener("click", (e) => {
      e.stopPropagation();
      state.rotation += 90;
      applyTransform(true);
    });

    // 锁定:锁定后当前旋转角度应用到之后切换的所有图片
    btnLock.addEventListener("click", (e) => {
      e.stopPropagation();
      state.locked = !state.locked;
      btnLock.classList.toggle("active", state.locked);
      btnLock.innerHTML = state.locked ? icons.unlock : icons.lock;
      btnLock.dataset.title = state.locked ? "解除锁定" : "正向锁定";
    });

    btnDownload.addEventListener("click", (e) => {
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = viewImage.src;
      link.download =
        viewImage.src.split("/").pop().split("?")[0] ||
        `image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });

    /* ============ 双击缩放(点击哪里放大哪里;手机端双击仅用于复原) ============ */
    function toggleZoomAt(clientX, clientY) {
      if (state.zoomed) {
        state.zoomed = false;
        state.scale = 1;
        state.origin = "center";
        state.tx = 0;
        state.ty = 0;
      } else {
        const rect = viewImage.getBoundingClientRect();
        state.origin = `${clientX - rect.left}px ${clientY - rect.top}px`;
        state.scale = 2.2;
        state.zoomed = true;
      }
      applyTransform(true);
    }

    viewImage.addEventListener("dblclick", (e) => {
      e.preventDefault();
      // 手机端双击不放大:只允许"双击恢复原状"(放大逻辑由双指捏合承担);
      // 电脑端保持双击以点击位置为中心放大/复原
      if (!isMobile() || state.zoomed) {
        toggleZoomAt(e.clientX, e.clientY);
      }
    });

    /* ============ 滚轮:切换图片 ============ */
    imageViewer.addEventListener(
      "wheel",
      (e) => {
        if (!imageViewer.classList.contains("active")) return;
        e.preventDefault();
        if (slideBusy) return;
        if (e.deltaY > 0 && state.index < state.images.length - 1)
          switchTo(state.index + 1);
        else if (e.deltaY < 0 && state.index > 0) switchTo(state.index - 1);
      },
      { passive: false },
    );

    /* ============ 电脑端:左右拖动切换图片 / 单击图片隐藏切换类控件 ============ */
    let drag = null;
    let clickTimer = null; // 延迟切换 ui-hidden,避免双击(缩放)误触发
    let lastImgClick = 0; // 识别双击:300ms 内第二次 mouseup 取消待定的切换
    imageViewer.addEventListener("mousedown", (e) => {
      if (!imageViewer.classList.contains("active")) return;
      if (e.target.closest(".viewer-toolbar, .nav-btn, .viewer-thumbs, .viewer-peek"))
        return;
      drag = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
      // 放大状态下按住图片 → 准备平移
      if (state.zoomed) startPan(e.clientX, e.clientY);
    });
    document.addEventListener("mousemove", (e) => {
      if (!drag) return;
      drag.dx = e.clientX - drag.startX;
      drag.dy = e.clientY - drag.startY;
      if (state.zoomed) {
        // 放大状态下拖动 = 平移查看不同区域(不触发切换)
        movePan(e.clientX, e.clientY);
        return;
      }
      // 跟手预览(阻尼),不支持自由拖动
      if (!slideBusy) {
        stage.style.transition = "none";
        stage.style.transform = `translateX(${drag.dx * 0.35}px)`;
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (!drag) return;
      const dx = drag.dx;
      const dy = drag.dy;
      const movedFar = Math.abs(dx) > 6 || Math.abs(dy) > 6;
      const wasZoomed = state.zoomed;
      drag = null;
      stopPan();
      if (slideBusy) return;
      if (wasZoomed) return; // 放大状态下鼠标拖动用于平移,不做切换
      stage.style.transition =
        "transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)";
      stage.style.transform = "translateX(0) scale(1)";
      if (dx < -60 && state.index < state.images.length - 1) {
        switchTo(state.index + 1);
      } else if (dx > 60 && state.index > 0) {
        switchTo(state.index - 1);
      } else if (!movedFar && e.target === viewImage) {
        // 单击图片(非拖动):切换"左右缩略图/上一张下一张按钮/底部缩略图"的显隐。
        // 双击缩放会连触发两次 mouseup,300ms 内的第二次视为双击,取消待定的切换
        // (工具栏的显隐逻辑独立,不受影响)
        const now = Date.now();
        const isSecondClick = now - lastImgClick < 300;
        lastImgClick = now;
        if (isSecondClick) {
          clearTimeout(clickTimer); // 双击:交给 dblclick 缩放,不切换控件
        } else {
          clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            imageViewer.classList.toggle("ui-hidden");
          }, 280);
        }
      }
    });

    /* ============ 电脑端工具栏自动隐藏 ============ */
    let toolbarTimer = null;
    function showToolbar() {
      clearTimeout(toolbarTimer); // 悬停期间保持显示
      toolbar.classList.add("visible");
    }
    function scheduleHide() {
      clearTimeout(toolbarTimer);
      toolbarTimer = setTimeout(() => {
        toolbar.classList.remove("visible");
      }, 1000); // 离开 1 秒后自然隐藏
    }
    imageViewer.addEventListener("mousemove", (e) => {
      if (isMobile()) return;
      // 鼠标靠近查看界面正上方区域时出现
      if (e.clientY <= 130) {
        showToolbar();
      } else {
        scheduleHide();
      }
    });
    // 鼠标停在工具栏上(即使不再移动)也保持显示;离开工具栏才渐隐
    toolbar.addEventListener("mouseenter", showToolbar);
    toolbar.addEventListener("mouseleave", scheduleHide);
    imageViewer.addEventListener("mouseleave", () => {
      if (isMobile()) return;
      scheduleHide();
    });

    /* ============ 手机端触摸:滑动切换 / 单击控件 / 双击复原 / 双指缩放 / 缩小进入胶片模式 ============ */
    let touch = {
      startX: 0,
      startY: 0,
      lastX: 0,
      moved: false,
      onControls: false,
      // 双指缩放(锚点跟手,中心点坐标恒定)
      pinch: false,
      pinchStartDist: 0,
      pinchStartScale: 1,
      pinchStartTx: 0,
      pinchStartTy: 0,
      pinchMid: { x: 0, y: 0 },
      acX: 0,
      acY: 0,
      lastTapTime: 0,
      lastTapX: 0,
      lastTapY: 0,
      tapTimer: null,
      filmstripOffset: 0,
    };
    let filmstrip = false;
    let pan = null; // 放大后的平移基准(手机单指/电脑鼠标共用)

    function enterFilmstrip() {
      filmstrip = true;
      imageViewer.classList.add("filmstrip");
      touch.filmstripOffset = 0;
      // 进入胶片前复位图片自身的缩放,避免变换叠加
      state.zoomed = false;
      state.scale = 1;
      state.origin = "center";
      state.tx = 0;
      state.ty = 0;
      applyTransform(false);
      // 胶片模式:左右两侧露出前后图片
      stage.style.transform = "scale(0.62)";
      updatePeek();
    }

    /* ---- 双指缩放:锚点取双指中点,内容点跟手不跳动 ----
       数学模型:rendered(q) = Ac + t + R·(s·(q − C)),C=图片布局中心,Ac=中心绝对位置。
       捏合时要求"初始中点下的内容点 p0 始终渲染在当前双指中点处",
       两帧联立消去 R 后得到闭式解:t = mid − Ac − (s/s0)·(mid0 − Ac − t0)。
       因此 origin 固定为 center,无需切换 transform-origin,任何旋转角下都成立。 */
    function initPinch(e) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      touch.pinch = true;
      touch.pinchStartDist = getDist(t0, t1);
      touch.pinchStartScale = state.scale;
      touch.pinchStartTx = state.tx;
      touch.pinchStartTy = state.ty;
      touch.pinchMid = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };
      // 布局值(offset*)不受 transform 影响,整个手势期间恒定
      touch.acX = viewImage.offsetLeft + viewImage.offsetWidth / 2;
      touch.acY = viewImage.offsetTop + viewImage.offsetHeight / 2;
      state.origin = "center";
    }

    function applyPinch(e) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = getDist(t0, t1);
      const ratio = dist / (touch.pinchStartDist || dist);
      const s0 = touch.pinchStartScale;

      // 未放大状态下继续合拢 → 进入胶片模式(显示左右缩略图)
      if (s0 <= 1.02 && ratio < 0.92) {
        enterFilmstrip();
        touch.lastX = (t0.clientX + t1.clientX) / 2;
        return;
      }

      const s = Math.min(3, Math.max(1, s0 * ratio));
      const k = s / s0;
      const mid = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };
      state.scale = s;
      state.tx = mid.x - touch.acX - k * (touch.pinchMid.x - touch.acX - touch.pinchStartTx);
      state.ty = mid.y - touch.acY - k * (touch.pinchMid.y - touch.acY - touch.pinchStartTy);
      state.zoomed = s > 1.02;
      applyTransform(false);
    }

    function endPinch() {
      touch.pinch = false;
      touch.pinchStartDist = 0;
      pan = null;
      // 轻微捏合(几乎没放大):带动画弹回原状
      if (state.scale <= 1.02) {
        state.zoomed = false;
        state.scale = 1;
        state.origin = "center";
        state.tx = 0;
        state.ty = 0;
        applyTransform(true);
      }
    }

    /* ---- 放大后的平移(手机单指/电脑鼠标拖动共用),限制图片不拖出视口 ---- */
    function startPan(x, y) {
      pan = {
        startX: x,
        startY: y,
        startTx: state.tx,
        startTy: state.ty,
        rect: viewImage.getBoundingClientRect(),
      };
    }

    function movePan(x, y) {
      if (!pan || pan.startX === null) return;
      const rect = pan.rect;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      function clampAxis(base, delta, size, vp) {
        const lo = Math.min(0, vp - size);
        const hi = Math.max(0, vp - size);
        const pos = Math.max(lo, Math.min(base + delta, hi));
        return pos - base;
      }
      state.tx = pan.startTx + clampAxis(rect.left, x - pan.startX, rect.width, vw);
      state.ty = pan.startTy + clampAxis(rect.top, y - pan.startY, rect.height, vh);
      applyTransform(false);
    }

    function stopPan() {
      pan = null;
    }

    imageViewer.addEventListener(
      "touchstart",
      (e) => {
        if (!imageViewer.classList.contains("active")) return;
        if (e.target.closest(".viewer-toolbar, .nav-btn, .viewer-thumbs")) {
          // 触摸起点在控件上:重置滑动状态,避免随后的点击被当成滑动
          touch.moved = false;
          touch.onControls = true;
          return;
        }
        touch.onControls = false;

        if (e.touches.length === 1) {
          touch.startX = e.touches[0].clientX;
          touch.startY = e.touches[0].clientY;
          touch.lastX = e.touches[0].clientX;
          touch.moved = false;
          // 放大状态下单指按住 → 准备平移
          if (state.zoomed && !touch.pinch) {
            startPan(e.touches[0].clientX, e.touches[0].clientY);
          }
        } else if (e.touches.length === 2) {
          clearTimeout(touch.tapTimer); // 双指按下取消待定的单击动作
          initPinch(e);
        }
      },
      { passive: false },
    );

    imageViewer.addEventListener(
      "touchmove",
      (e) => {
        if (!imageViewer.classList.contains("active")) return;
        if (e.target.closest(".viewer-toolbar, .nav-btn, .viewer-thumbs"))
          return;
        e.preventDefault();

        if (e.touches.length === 2) {
          if (filmstrip) {
            // 胶片模式:跟随手指左右滚动
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            touch.filmstripOffset += midX - (touch.lastX || midX);
            touch.lastX = midX;
            stage.style.transform = `scale(0.62) translateX(${touch.filmstripOffset * 0.6}px)`;
            return;
          }
          if (!touch.pinch) initPinch(e);
          applyPinch(e);
          touch.moved = true;
          return;
        }

        // 单指
        const dx = e.touches[0].clientX - touch.lastX;
        touch.lastX = e.touches[0].clientX;
        if (
          Math.abs(e.touches[0].clientX - touch.startX) > 10 ||
          Math.abs(e.touches[0].clientY - touch.startY) > 10
        )
          touch.moved = true;

        if (filmstrip) {
          touch.filmstripOffset += dx;
          stage.style.transform = `scale(0.62) translateX(${touch.filmstripOffset * 0.6}px)`;
          return;
        }

        if (state.zoomed) {
          // 放大后单指拖动 = 平移查看不同区域(不触发左右切换)
          movePan(e.touches[0].clientX, e.touches[0].clientY);
          return;
        }

        // 未放大:左右滑动预览(阻尼跟随)
        if (!touch.moved || Math.abs(e.touches[0].clientX - touch.startX) > 10) {
          const dxTotal = e.touches[0].clientX - touch.startX;
          if (Math.abs(dxTotal) > 6 && !slideBusy) {
            stage.style.transition = "none";
            stage.style.transform = `translateX(${dxTotal * 0.4}px)`;
          }
        }
      },
      { passive: false },
    );

    imageViewer.addEventListener(
      "touchend",
      (e) => {
        if (!imageViewer.classList.contains("active")) return;

        if (filmstrip) {
          // 松手:根据位移决定切换或弹回
          const offset = touch.filmstripOffset;
          filmstrip = false;
          imageViewer.classList.remove("filmstrip");
          peekPrev.style.opacity = "";
          peekNext.style.opacity = "";
          if (offset < -50 && state.index < state.images.length - 1) {
            switchTo(state.index + 1);
          } else if (offset > 50 && state.index > 0) {
            switchTo(state.index - 1);
          } else {
            stage.style.transition =
              "transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)";
            stage.style.transform = "";
            setTimeout(() => (stage.style.transition = "none"), 400);
            updatePeek();
          }
          touch.filmstripOffset = 0;
          return;
        }

        // 双指结束:结算缩放状态
        if (touch.pinch) {
          if (e.touches.length === 0) {
            endPinch();
          } else if (e.touches.length === 1) {
            // 剩一根手指:结束捏合,转入单指平移(若仍处于放大状态)
            touch.pinch = false;
            touch.moved = true;
            const t = e.touches[0];
            if (state.zoomed) startPan(t.clientX, t.clientY);
          }
          return;
        }
        stopPan();

        // 双指结束后不处理单击逻辑
        if (e.touches.length > 0) return;
        // 触摸起点在控件上(旋转/锁定/保存按钮):不执行滑动/单击逻辑
        if (touch.onControls) {
          touch.onControls = false;
          return;
        }

        const dxTotal = e.changedTouches[0].clientX - touch.startX;
        const dyTotal = e.changedTouches[0].clientY - touch.startY;
        const isTap = !touch.moved && Math.abs(dxTotal) < 10 && Math.abs(dyTotal) < 10;

        // 放大状态下:松手不做切换/复原,仅由平移结束收尾
        if (state.zoomed) return;

        if (touch.moved && Math.abs(dxTotal) > 60) {
          // 滑动切换
          if (dxTotal < 0 && state.index < state.images.length - 1)
            switchTo(state.index + 1);
          else if (dxTotal > 0 && state.index > 0) switchTo(state.index - 1);
          else {
            stage.style.transition =
              "transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)";
            stage.style.transform = "";
          }
          return;
        }

        // 滑动幅度不足:弹回
        if (touch.moved) {
          stage.style.transition =
            "transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)";
          stage.style.transform = "";
          return;
        }

        if (!isTap) return;

        // 单击/双击判定(300ms 内两次点击同一位置 = 双击)
        const now = Date.now();
        const x = e.changedTouches[0].clientX;
        const y = e.changedTouches[0].clientY;
        const isDoubleTap =
          now - touch.lastTapTime < 300 &&
          Math.abs(x - touch.lastTapX) < 40 &&
          Math.abs(y - touch.lastTapY) < 40;

        if (isDoubleTap) {
          clearTimeout(touch.tapTimer);
          touch.lastTapTime = 0;
          if (state.zoomed) {
            // 双击:仅用于把放大的图片恢复原状(手机端不放大)
            toggleZoomAt(x, y);
          }
          return;
        }

        touch.lastTapTime = now;
        touch.lastTapX = x;
        touch.lastTapY = y;
        // 单击:图片上 → 显示/隐藏控件;空白处 → 关闭
        touch.tapTimer = setTimeout(() => {
          const hit = document.elementFromPoint(x, y);
          if (hit && hit.classList.contains("view-image")) {
            // 图片上单击:切换控件显示
            imageViewer.classList.toggle("controls-hidden");
          } else if (hit && (hit === imageViewer || hit.classList.contains("viewer-stage"))) {
            closeViewer(); // 上下空白处单击退出
          }
        }, 260);
      },
      { passive: false },
    );

    /* ============ 键盘 ============ */
    document.addEventListener("keydown", (e) => {
      if (!imageViewer.classList.contains("active")) return;
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft" && state.index > 0) switchTo(state.index - 1);
      if (
        e.key === "ArrowRight" &&
        state.index < state.images.length - 1
      )
        switchTo(state.index + 1);
    });
  });
})();
