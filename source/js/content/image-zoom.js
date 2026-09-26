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
    // ★ 幂等守卫:direct 模式下文章页经 pjax 加载,pjax 换页会重新派发
    //   DOMContentLoaded;若无守卫,每换一页就往 body 叠加一个一模一样的
    //   查看器,点击空白/关闭按钮一次只关掉最上层,看起来就要点很多次。
    //   查看器节点挂在 body(pjax 只替换 main),单实例可跨页面复用,
    //   打开时的图片列表是点击当下查询的,无需重建。
    if (window.__imageViewerInit) return;
    window.__imageViewerInit = true;

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
      <div class="viewer-close" aria-label="关闭">
        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
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
    const viewerClose = imageViewer.querySelector(".viewer-close");

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
      if (anim) cancelAnimationFrame(panRaf); // 动画接管时终止惯性滑行
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

    /* ============ 底部缩略图 v2(全量胶片条,固定槽位中心裁剪) ============ */
    function renderThumbs() {
      const show = showThumbs();
      thumbsEl.style.display = show ? "flex" : "none";
      if (!show) return;
      // 已渲染过且数量一致:只更新 active 态,避免每次切换重建(拖动滚动位置也不丢)
      if (
        thumbsEl.childElementCount === state.images.length &&
        thumbsEl.dataset.rendered === "1"
      ) {
        thumbsEl.querySelectorAll(".thumb").forEach((t, i) => {
          t.classList.toggle("active", i === state.index);
        });
        const active = thumbsEl.querySelector(".thumb.active");
        if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
        return;
      }

      thumbsEl.innerHTML = "";
      thumbsEl.dataset.rendered = "1";
      state.images.forEach((im, i) => {
        const t = document.createElement("div");
        t.className = "thumb" + (i === state.index ? " active" : "");
        const img = document.createElement("img");
        img.src = im.currentSrc || im.src;
        img.draggable = false;
        img.loading = "lazy"; // 图多时按视口距离再下载
        img.decoding = "async";
        t.appendChild(img);
        t.addEventListener("click", (e) => {
          e.stopPropagation();
          if (i !== state.index) switchTo(i);
        });
        thumbsEl.appendChild(t);
      });

      const active = thumbsEl.querySelector(".thumb.active");
      if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
    }

    /* ---- 缩略图条:鼠标按住空白/任意处左右拖动滚动(参考参考站交互) ---- */
    (function thumbDragScroll() {
      let sd = null; // strip drag
      thumbsEl.addEventListener("mousedown", (e) => {
        e.preventDefault(); // 阻止图片原生拖拽/文本选择
        sd = {
          startX: e.clientX,
          startScroll: thumbsEl.scrollLeft,
          lastX: e.clientX,
          lastT: Date.now(),
          vx: 0,
          moved: false,
        };
        thumbsEl.classList.add("dragging");
      });
      document.addEventListener("mousemove", (e) => {
        if (!sd) return;
        const dx = e.clientX - sd.startX;
        if (Math.abs(dx) > 5) sd.moved = true;
        const now = Date.now();
        const dt = Math.max(1, now - sd.lastT);
        sd.vx = (e.clientX - sd.lastX) / dt; // px/ms
        sd.lastX = e.clientX;
        sd.lastT = now;
        thumbsEl.scrollLeft = sd.startScroll - dx;
      });
      document.addEventListener("mouseup", () => {
        if (!sd) return;
        const { vx, moved } = sd;
        sd = null;
        thumbsEl.classList.remove("dragging");
        // ★ 只有真正拖动过才吞掉随后的 click;原地点击必须放行,
        //   否则点缩略图不切图(旧实现用 class 判断,而 class 移除时机晚于 click)
        thumbDragMoved = moved;
        if (!moved) return;
        // 轻微惯性滚动
        let v = vx * 16;
        const decel = () => {
          if (Math.abs(v) < 0.5) return;
          thumbsEl.scrollLeft -= v;
          v *= 0.92;
          requestAnimationFrame(decel);
        };
        requestAnimationFrame(decel);
      });
      // 拖动后的那次 click 吞掉(用旗标,不用 class——class 移除可能晚于 click)
      let thumbDragMoved = false;
      thumbsEl.addEventListener("click", (e) => {
        if (thumbDragMoved) {
          thumbDragMoved = false;
          e.stopPropagation();
        }
      }, true);
    })();

    /* ============ 丝滑切换(贝塞尔曲线滑动;fromDx ≠ 0 时衔接拖动手势) ============ */
    function switchTo(index, animate = true, fromDx = 0) {
      if (index < 0 || index >= state.images.length) return;
      if (index === state.index) return;
      const dir = index > state.index ? 1 : -1;

      if (!animate || slideBusy) {
        loadImage(index);
        return;
      }
      slideBusy = true;

      const enterNew = () => {
        loadImage(index);
        // 新图从另一侧滑入
        stage.style.transition = "none";
        stage.style.transform = `translateX(${dir * (fromDx ? 42 : 18)}%) scale(${fromDx ? 0.97 : 0.94})`;
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
      };

      if (fromDx) {
        // ★ 拖动提交:从当前拖动位置顺着原方向快速滑出,衔接手势不回跳
        stage.style.transition = "none";
        stage.style.transform = `translateX(${fromDx}px)`;
        void stage.offsetWidth; // 强制回流,让起始位置先生效
        stage.style.transition =
          "transform 0.26s cubic-bezier(0.5, 0, 0.75, 0.45), opacity 0.26s ease";
        stage.style.transform = `translateX(${dir * -60}vw)`;
        stage.style.opacity = "0";
        setTimeout(enterNew, 260);
        return;
      }

      // 当前图滑出(点击切换:淡出缩放)
      stage.style.transition =
        "transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.4s ease";
      stage.style.transform = `translateX(${dir * -18}%) scale(0.94)`;
      stage.style.opacity = "0";
      setTimeout(enterNew, 240);
    }

    /* ============ 打开 / 关闭 ============ */
    // 模态 iframe 内打开/关闭全屏查看器时通知父页面:
    // 父页面的桌宠(z 2000)盖在模态之上,会挡住 iframe 内的查看器,
    // 父页面收到消息后临时把桌宠沉到模态之下
    function notifyParentViewer(open) {
      // 直链模式:本页面就是父页面,直接静音/恢复桌宠粒子
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

    function openViewer(clickedImg) {
      // 全篇统一序列:轮播图里的图片和普通文章图片一起按出现顺序翻阅
      // (轮播图自身的点击由 carousel.js 调 window.openImageViewer 进入)
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
      notifyParentViewer(true);
    }

    function closeViewer() {
      imageViewer.classList.remove("active");
      document.body.style.overflow = "";
      stage.style.transform = "";
      stage.style.opacity = "";
      slideBusy = false;
      notifyParentViewer(false);
    }

    // 暴露给轮播图等外部模块:点击轮播图当前图片时打开查看器
    window.openImageViewer = openViewer;

    // 事件委托:点击文章内图片打开(pjax 换页后依旧有效)
    // 轮播图内的图片 pointer-events:none,点击落在轮播容器上,
    // 由 carousel.js 统一调用 openImageViewer,这里不会重复触发
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

    // 右上角关闭按钮(电脑端/手机端常驻,不受"隐藏控件"状态影响)
    viewerClose.addEventListener("click", (e) => {
      e.stopPropagation();
      closeViewer();
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

    /* ============ 电脑端:左右拖动切换图片(1:1 跟手 + 橡皮筋 + 甩动) ============ */
    let drag = null;
    let clickTimer = null; // 延迟切换 ui-hidden,避免双击(缩放)误触发
    let lastImgClick = 0; // 识别双击:300ms 内第二次 mouseup 取消待定的切换
    // ★ rAF 合帧:高回报率鼠标(500-1000Hz)下,逐事件写 style 会造成
    //   每秒数百次样式重算 → 拖动一卡一卡。事件只记录坐标,每帧统一写一次。
    let dragRaf = 0;
    function scheduleDragFrame() {
      if (dragRaf) return;
      dragRaf = requestAnimationFrame(() => {
        dragRaf = 0;
        if (!drag) return;
        if (state.zoomed) {
          movePan(drag.curX, drag.curY);
          return;
        }
        if (slideBusy) return;
        // 1:1 跟手;到尽头后施加橡皮筋阻尼(越拖越紧)
        let dx = drag.dx;
        const canPrev = state.index > 0;
        const canNext = state.index < state.images.length - 1;
        if (dx > 0 && !canPrev) dx *= 0.32;
        if (dx < 0 && !canNext) dx *= 0.32;
        stage.style.transform = `translateX(${dx}px)`;
        // 两侧预览图轻微视差,增强"拖动整卷胶片"的动感
        if (peekPrev.style.display !== "none")
          peekPrev.style.transform = `translateX(${Math.min(0, dx) * 0.12}px)`;
        if (peekNext.style.display !== "none")
          peekNext.style.transform = `translateX(${Math.max(0, dx) * 0.12}px)`;
      });
    }

    imageViewer.addEventListener("mousedown", (e) => {
      if (!imageViewer.classList.contains("active")) return;
      if (e.target.closest(".viewer-toolbar, .nav-btn, .viewer-thumbs, .viewer-peek, .viewer-close"))
        return;
      drag = {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastT: Date.now(),
        curX: e.clientX,
        curY: e.clientY,
        vx: 0,
        dx: 0,
        dy: 0,
      };
      // 拖动期间:关闭过渡、提升合成层(整个手势只写一次)
      stage.style.transition = "none";
      stage.style.willChange = "transform";
      // 放大状态下按住 → 准备平移(带惯性与回弹,见 movePan)
      if (state.zoomed) {
        startPan(e.clientX, e.clientY);
        stage.classList.add("panning");
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const now = Date.now();
      const dt = Math.max(1, now - drag.lastT);
      drag.vx = (e.clientX - drag.lastX) / dt; // px/ms
      drag.lastX = e.clientX;
      drag.lastT = now;
      drag.dx = e.clientX - drag.startX;
      drag.dy = e.clientY - drag.startY;
      drag.curX = e.clientX;
      drag.curY = e.clientY;
      scheduleDragFrame(); // ★ 每帧最多写一次 style
    });
    // ★ 拖动释放后会紧接着派发 click(落在空白处=关闭查看器),
    //   拖过的那次 click 必须吞掉,否则"抓住空白处切图"变成"拖一下就关了"
    let suppressViewerClick = false;
    imageViewer.addEventListener(
      "click",
      (e) => {
        if (suppressViewerClick) {
          suppressViewerClick = false;
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );

    document.addEventListener("mouseup", (e) => {
      if (!drag) return;
      const dx = drag.dx;
      const dy = drag.dy;
      const vx = drag.vx; // px/ms,最后一次移动的瞬时速度
      const movedFar = Math.abs(dx) > 6 || Math.abs(dy) > 6;
      const wasZoomed = state.zoomed;
      drag = null;
      cancelAnimationFrame(dragRaf);
      stage.style.willChange = "";
      if (movedFar) suppressViewerClick = true;
      if (wasZoomed) {
        stage.classList.remove("panning");
        releasePan(vx, 0); // ★ 放开手:平移惯性滑行 + 边界回弹
        return;
      }
      stopPan();
      if (slideBusy) return;
      // 回弹两侧预览图的视差
      peekPrev.style.transform = "";
      peekNext.style.transform = "";
      const vw = window.innerWidth;
      const canPrev = state.index > 0;
      const canNext = state.index < state.images.length - 1;
      // ★ 甩动判定:拖过 12% 视口宽,或快速甩动(>0.6px/ms)
      const goNext = canNext && (-dx > vw * 0.12 || vx < -0.6) && dx < 0;
      const goPrev = canPrev && (dx > vw * 0.12 || vx > 0.6) && dx > 0;
      if (goNext || goPrev) {
        switchTo(state.index + (goNext ? 1 : -1), true, dx);
        return;
      }
      // 未达阈值:弹性滑回原位
      stage.style.transition =
        "transform 0.45s cubic-bezier(0.22, 1.4, 0.36, 1)";
      stage.style.transform = "translateX(0)";
      if (!movedFar && e.target === viewImage) {
        // 单击图片(非拖动):切换"左右缩略图/上一张下一张按钮/底部缩略图"的显隐。
        // 双击缩放会连触发两次 mouseup,300ms 内的第二次视为双击,取消待定的切换
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
    let touchRaf = 0; // 触摸拖动 rAF 合帧
    let latestTouch = null;

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

    /* ---- 放大后的平移(手机单指/电脑鼠标拖动共用) ----
       ★ 2026-09 手感升级(参考 PhotoSwipe):
       拖动时边界软夹紧(橡皮筋:越界位移按 35% 衰减,拖得越远越紧);
       松手后带惯性滑行(每帧速度 ×0.92 衰减),触碰边界立即弹性回位;
       电脑端/手机端共用同一套手感。 */
    let panRaf = 0;

    function startPan(x, y) {
      // 基于起始时刻的渲染矩形,计算本次手势 tx/ty 的合法区间
      // (图片边缘拖到视口边界为止;图小于视口时区间收敛为一点=居中锁定)
      const rect = viewImage.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rawMinX = state.tx + (vw - rect.width) - rect.left;
      const rawMaxX = state.tx + (0 - rect.left);
      const rawMinY = state.ty + (vh - rect.height) - rect.top;
      const rawMaxY = state.ty + (0 - rect.top);
      pan = {
        startX: x,
        startY: y,
        startTx: state.tx,
        startTy: state.ty,
        minX: Math.min(rawMinX, rawMaxX),
        maxX: Math.max(rawMinX, rawMaxX),
        minY: Math.min(rawMinY, rawMaxY),
        maxY: Math.max(rawMinY, rawMaxY),
      };
    }

    function softClamp(v, min, max) {
      if (v < min) return min + (v - min) * 0.35; // 橡皮筋:越界部分 35% 衰减
      if (v > max) return max + (v - max) * 0.35;
      return v;
    }

    function movePan(x, y) {
      if (!pan) return;
      state.tx = softClamp(pan.startTx + (x - pan.startX), pan.minX, pan.maxX);
      state.ty = softClamp(pan.startTy + (y - pan.startY), pan.minY, pan.maxY);
      applyTransform(false);
    }

    /* 松手:惯性滑行,到边界弹性回位(vx/vy 单位 px/ms) */
    function releasePan(vx, vy) {
      cancelAnimationFrame(panRaf);
      let vX = Math.max(-60, Math.min(60, (vx || 0) * 16)); // px/帧
      let vY = Math.max(-60, Math.min(60, (vy || 0) * 16));
      if (Math.abs(vX) < 0.4 && Math.abs(vY) < 0.4) {
        springBack();
        return;
      }
      const step = () => {
        vX *= 0.92;
        vY *= 0.92;
        state.tx += vX;
        state.ty += vY;
        const over =
          state.tx < pan.minX - 0.5 ||
          state.tx > pan.maxX + 0.5 ||
          state.ty < pan.minY - 0.5 ||
          state.ty > pan.maxY + 0.5;
        if (over || (Math.abs(vX) < 0.15 && Math.abs(vY) < 0.15)) {
          springBack();
          return;
        }
        applyTransform(false);
        panRaf = requestAnimationFrame(step);
      };
      panRaf = requestAnimationFrame(step);
    }

    function springBack() {
      state.tx = Math.max(pan.minX, Math.min(pan.maxX, state.tx));
      state.ty = Math.max(pan.minY, Math.min(pan.maxY, state.ty));
      applyTransform(true); // 过冲位置平滑插值回边界
    }

    function stopPan() {
      pan = null;
    }

    imageViewer.addEventListener(
      "touchstart",
      (e) => {
        if (!imageViewer.classList.contains("active")) return;
        if (e.target.closest(".viewer-toolbar, .nav-btn, .viewer-thumbs, .viewer-close")) {
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
          touch.lastT = Date.now();
          touch.panV = null; // 清掉上一轮速度,防止误判甩动
          touch.moved = false;
          latestTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          stage.style.transition = "none";
          stage.style.willChange = "transform";
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
        if (e.target.closest(".viewer-toolbar, .nav-btn, .viewer-thumbs, .viewer-close"))
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
        const t0 = e.touches[0];
        const dx = t0.clientX - touch.lastX;
        const now = Date.now();
        const dt = Math.max(1, now - (touch.lastT || now));
        // ★ 速度追踪对单指全程开启(放大平移的惯性与未放大的甩动判定都要用)
        if (!touch.panV)
          touch.panV = { x: 0, y: 0, lastX: t0.clientX, lastY: t0.clientY };
        touch.panV.x = (t0.clientX - touch.panV.lastX) / dt;
        touch.panV.y = (t0.clientY - touch.panV.lastY) / dt;
        touch.panV.lastX = t0.clientX;
        touch.panV.lastY = t0.clientY;
        touch.lastX = t0.clientX;
        touch.lastT = now;
        if (
          Math.abs(t0.clientX - touch.startX) > 10 ||
          Math.abs(t0.clientY - touch.startY) > 10
        )
          touch.moved = true;

        if (filmstrip) {
          touch.filmstripOffset += dx;
          stage.style.transform = `scale(0.62) translateX(${touch.filmstripOffset * 0.6}px)`;
          return;
        }

        // ★ 触摸同样 rAF 合帧:部分安卓触控采样率高于刷新率,
        //   逐事件写 style 会掉帧,每帧统一应用一次
        latestTouch = { x: t0.clientX, y: t0.clientY };
        if (touchRaf) return;
        touchRaf = requestAnimationFrame(() => {
          touchRaf = 0;
          const tt = latestTouch;
          if (!tt) return;
          if (state.zoomed) {
            movePan(tt.x, tt.y);
            return;
          }
          // 未放大:左右滑动跟手(1:1 + 尽头橡皮筋,与电脑端一致)
          let dxTotal = tt.x - touch.startX;
          if (Math.abs(dxTotal) > 6 && !slideBusy) {
            const canPrev = state.index > 0;
            const canNext = state.index < state.images.length - 1;
            if (dxTotal > 0 && !canPrev) dxTotal *= 0.32;
            if (dxTotal < 0 && !canNext) dxTotal *= 0.32;
            stage.style.transform = `translateX(${dxTotal}px)`;
          }
        });
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
        cancelAnimationFrame(touchRaf);
        touchRaf = 0;
        stage.style.willChange = "";

        // ★ 放大状态松手:先结算平移惯性(速度来自最后一帧触摸),再清基准
        if (state.zoomed && pan) {
          const pv = touch.panV || { x: 0, y: 0 };
          releasePan(pv.x, pv.y);
          touch.panV = null;
          stopPan();
        } else {
          stopPan();
        }

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

        // ★ 甩动速度参与判定:快速轻扫也能切换(与电脑端一致的手感)
        const flickV = touch.panV ? touch.panV.x : 0;
        const flicked = Math.abs(flickV) > 0.55 && Math.abs(dxTotal) > 24;
        if (
          touch.moved &&
          (Math.abs(dxTotal) > 60 || flicked) &&
          Math.abs(dxTotal) > Math.abs(dyTotal)
        ) {
          // 滑动切换
          if (dxTotal < 0 && state.index < state.images.length - 1)
            switchTo(state.index + 1, true, dxTotal);
          else if (dxTotal > 0 && state.index > 0)
            switchTo(state.index - 1, true, dxTotal);
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
