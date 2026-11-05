// Music Player - Floating Music Player
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initMusicPlayer();
  });

  function initMusicPlayer() {
    const player = document.querySelector(".music-player");
    if (!player) return;

    // pjax: 播放器常驻不替换,只绑定一次。
    // 重复绑定会让播放/暂停一次点击触发两次(等于没按),播放状态也会被打断
    if (player.dataset.playerBound) return;
    player.dataset.playerBound = "1";

    const audio = document.querySelector(".music-player-audio");
    const toggleBtn = player.querySelector(".music-player-toggle");
    const toggleIcon = toggleBtn ? toggleBtn.querySelector("i") : null;

    const playerStyle = player.dataset.style || "pill";
    const mobileStyle = player.dataset.mobileStyle || playerStyle;
    const pcPosition = player.dataset.pcPosition || "floating";

    // ★ 桌面/手机允许配置不同形态(style + mobile_style):两个面板都保留
    //   在 DOM 中,由 applyStyleScope 按当前宽度切换显示哪一个
    const pillMini = player.querySelector(".music-player-pill");
    const cardMini = player.querySelector(".music-player-card");
    if (!pillMini || !cardMini) return;

    function activeStyle() {
      return window.innerWidth <= 768 ? mobileStyle : playerStyle;
    }
    function applyStyleScope() {
      const active = activeStyle();
      player.classList.toggle("style-pill", active === "pill");
      player.classList.toggle("style-card", active === "card");
    }
    // 对两个面板同时执行同一操作:隐藏形态的控件状态也保持同步
    function eachMini(fn) {
      [pillMini, cardMini].filter(Boolean).forEach(fn);
    }
    function miniEls(selector) {
      const out = [];
      eachMini((m) => {
        const el = m.querySelector(selector);
        if (el) out.push(el);
      });
      return out;
    }

    // ----- UI 定位逻辑 -----
    // ★ 统一入口 placePlayer():桌面按配置嵌入导航栏或悬浮;手机端固定左下角。
    //   初始化与跨越 768 分界的 resize 都会调用,避免形态切换后样式错乱;
    //   模态窗口打开期间(in-modal-mode)不重新放置,由 article-modal 接管
    function placePlayer() {
      if (player.classList.contains("in-modal-mode")) return;

      applyStyleScope();

      if (window.innerWidth > 768) {
        if (pcPosition === "header") {
          const navLogo = document.querySelector(".nav-logo");
          if (navLogo) {
            if (navLogo.nextElementSibling !== player) {
              navLogo.insertAdjacentElement("afterend", player);
            }
            player.classList.add("in-header");
            player.classList.remove("is-floating");
            player.classList.remove("collapsed");
          }
        } else {
          player.classList.add("is-floating");
          player.classList.remove("in-header");
          setTimeout(() => {
            const startTop = Math.max(
              0,
              (window.innerHeight - player.offsetHeight) / 2,
            );
            player.style.top = startTop + "px";
            player.style.left = "20px";
            player.style.bottom = "auto";
            player.style.right = "auto";
          }, 50);
          if (!player.dataset.draggable) {
            player.dataset.draggable = "1";
            makeDraggable(player);
          }
        }
      } else {
        // 手机端:固定左下角(样式见 music-player.css 移动端块)。
        // 补加 is-floating 让默认隐藏的播放器显示出来(否则 opacity 恒为 0)
        player.classList.add("is-floating");
        player.classList.remove("in-header");
        // ★ 手机端默认收起,只显示圆钮;点击圆钮向上弹出播放器。
        //   若初始为展开态,圆钮的第一下点击会变成"收起",用户将永远
        //   看不到播放面板,也无法开始播放
        if (!player.classList.contains("collapsed")) {
          player.classList.add("collapsed");
          updateIcons();
        }
      }
    }
    const collapseBtns = miniEls(".music-player-pill-collapse").concat(
      miniEls(".music-player-collapse"),
    );

    let isPlaying = false;
    let loopMode = "list"; // "list" or "single"

    function updateIcons() {
      const collapsed = player.classList.contains("collapsed");
      if (toggleIcon) {
        toggleIcon.className = collapsed
          ? isPlaying
            ? "fas fa-pause"
            : "fas fa-play"
          : "fas fa-music";
      }
      collapseBtns.forEach((btn) => {
        const icon = btn.querySelector("i");
        if (icon)
          icon.className = collapsed
            ? "fas fa-chevron-right"
            : "fas fa-chevron-left";
      });
    }

    // ----- 边界限制 Logic -----
    function enforceBoundaries() {
      if (
        !player.classList.contains("is-floating") ||
        player.classList.contains("in-header")
      )
        return;

      const rect = player.getBoundingClientRect();
      let pWidth = rect.width;
      let pHeight = rect.height;

      // ★★★ 修复折叠状态下绝对定位导致的父容器宽高塌陷为0的问题 ★★★
      if (player.classList.contains("collapsed") && toggleBtn) {
        pWidth = Math.max(pWidth, toggleBtn.offsetWidth);
        pHeight = Math.max(pHeight, toggleBtn.offsetHeight);
      }

      const maxLeft = document.documentElement.clientWidth - pWidth;
      const maxTop = window.innerHeight - pHeight;

      let currentLeft = player.offsetLeft;
      let currentTop = player.offsetTop;

      // 修正溢出
      if (currentLeft > maxLeft)
        player.style.left = Math.max(0, maxLeft) + "px";
      if (currentTop > maxTop) player.style.top = Math.max(0, maxTop) + "px";
      if (currentLeft < 0) player.style.left = "0px";
      if (currentTop < 0) player.style.top = "0px";
    }

    // 监听窗口大小变化
    window.addEventListener("resize", enforceBoundaries);

    function togglePlayer() {
      if (
        player.classList.contains("in-header") &&
        !player.classList.contains("in-modal-mode")
      )
        return;

      player.classList.toggle("collapsed");
      updateIcons();

      if (
        player.classList.contains("is-floating") &&
        !player.classList.contains("in-modal-mode")
      ) {
        setTimeout(() => {
          enforceBoundaries();
        }, 350);
      }

      try {
        localStorage.setItem(
          "music-player-collapsed",
          player.classList.contains("collapsed"),
        );
      } catch (e) {}
    }

    if (toggleBtn)
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlayer();
      });
    collapseBtns.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlayer();
      }),
    );

    if (!player.classList.contains("in-header")) {
      try {
        if (localStorage.getItem("music-player-collapsed") === "true") {
          player.classList.add("collapsed");
          updateIcons();
        }
      } catch (e) {}
    }

    // ★ 放置播放器(须在 isPlaying/collapseBtns 就绪之后调用,见上)
    placePlayer();

    // 跨越 768 分界(旋转屏幕/拉伸窗口)时重新放置
    let wasDesktop = window.innerWidth > 768;
    window.addEventListener("resize", () => {
      const isDesktop = window.innerWidth > 768;
      if (isDesktop !== wasDesktop) {
        wasDesktop = isDesktop;
        placePlayer();
      }
    });

    const playBtns = miniEls(".music-player-play");
    const prevBtns = miniEls(".music-player-prev");
    const nextBtns = miniEls(".music-player-next");
    const loopBtns = miniEls(".music-player-loop");
    const titleEls = miniEls(".music-player-pill-title").concat(
      miniEls(".music-player-title"),
    );
    const artistEls = miniEls(".music-player-pill-artist").concat(
      miniEls(".music-player-artist"),
    );
    const coverImgs = miniEls(".music-player-pill-cover img").concat(
      miniEls(".music-player-cover img"),
    );

    let songs = [];
    const songsData = player.dataset.songs;
    if (songsData) {
      try {
        songs = JSON.parse(songsData);
      } catch (e) {
        console.warn("Failed to parse songs data:", e);
      }
    }

    if (songs.length === 0) {
      titleEls.forEach((el) => (el.textContent = "未在播放"));
      artistEls.forEach((el) => (el.textContent = "请在 _config.yml 中配置歌曲"));
      return;
    }

    let currentIndex = 0;
    loadSong(0);

    function togglePlay() {
      if (isPlaying) {
        audio.pause();
        isPlaying = false;
        player.classList.remove("playing");
      } else {
        audio.play().catch((err) => console.warn("Audio play failed:", err));
        isPlaying = true;
        player.classList.add("playing");
      }
      updatePlayButton();
    }

    function updatePlayButton() {
      playBtns.forEach((btn) => {
        btn.innerHTML = isPlaying
          ? '<i class="fas fa-pause"></i>'
          : '<i class="fas fa-play"></i>';
      });
      updateIcons();
    }

    playBtns.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlay();
      }),
    );
    prevBtns.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        prevSong();
      }),
    );
    nextBtns.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        nextSong();
      }),
    );

    loopBtns.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        loopMode = loopMode === "list" ? "single" : "list";
        btn.innerHTML =
          loopMode === "list"
            ? '<i class="fas fa-retweet"></i>'
            : '<i class="fas fa-repeat"></i><span style="font-size:10px;font-weight:bold;margin-left:-6px;">1</span>';

        btn.setAttribute(
          "data-title",
          loopMode === "list" ? "列表循环" : "单曲循环",
        );
      }),
    );

    function resumeIfPlaying() {
      if (isPlaying) audio.play().catch(() => {});
    }

    function prevSong() {
      currentIndex = (currentIndex - 1 + songs.length) % songs.length;
      loadSong(currentIndex);
      resumeIfPlaying();
    }

    function nextSong() {
      currentIndex = (currentIndex + 1) % songs.length;
      loadSong(currentIndex);
      resumeIfPlaying();
    }

    function loadSong(index) {
      const song = songs[index];
      if (!song) return;
      audio.src = song.src;
      titleEls.forEach((el) => (el.textContent = song.title));
      artistEls.forEach((el) => (el.textContent = song.artist || "-"));
      if (song.cover) {
        coverImgs.forEach((img) => {
          img.src = song.cover;
          img.style.animation = "none";
          void img.offsetHeight; // 重启旋转动画
          img.style.animation = null;
        });
      }
    }

    audio.addEventListener("ended", function () {
      if (loopMode === "single") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextSong();
        audio.play().catch(() => {});
      }
      isPlaying = true;
      player.classList.add("playing");
      updatePlayButton();
    });

    if (player.dataset.autoplay === "true") {
      setTimeout(function () {
        togglePlay();
      }, 500);
    }

    // ----- Draggable Logic -----
    function makeDraggable(el) {
      let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;

      el.onmousedown = dragMouseDown;

      function dragMouseDown(e) {
        if (
          !el.classList.contains("is-floating") ||
          el.classList.contains("in-modal-mode")
        )
          return;

        e = e || window.event;

        if (
          e.target.closest(".music-player-btn") &&
          !e.target.closest(".music-player-toggle")
        )
          return;

        if (!e.target.closest(".music-player-toggle")) {
          e.preventDefault();
        }

        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }

      function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        let newTop = el.offsetTop - pos2;
        let newLeft = el.offsetLeft - pos1;

        const rect = el.getBoundingClientRect();
        let pWidth = rect.width;
        let pHeight = rect.height;

        // ★★★ 修复折叠状态下拖拽时，绝对定位导致的父容器宽高塌陷问题 ★★★
        if (el.classList.contains("collapsed")) {
          const tBtn = el.querySelector(".music-player-toggle");
          if (tBtn) {
            pWidth = Math.max(pWidth, tBtn.offsetWidth);
            pHeight = Math.max(pHeight, tBtn.offsetHeight);
          }
        }

        const maxLeft = document.documentElement.clientWidth - pWidth;
        const maxTop = window.innerHeight - pHeight;

        if (newTop < 0) newTop = 0;
        if (newLeft < 0) newLeft = 0;
        if (newTop > maxTop) newTop = maxTop;
        if (newLeft > maxLeft) newLeft = maxLeft;

        el.style.top = newTop + "px";
        el.style.left = newLeft + "px";
        el.style.bottom = "auto";
        el.style.right = "auto";
      }

      function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
      }
    }
  }
})();
