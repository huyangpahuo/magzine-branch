/**
 * ============================================
 * 模态播放器声波波动图 (music-wave.js)
 * ============================================
 * 模态窗口内的播放器(纵向圆条/卡片)中部留有空白,
 * 在此绘制随音乐起伏的声波波动图:
 * · 播放中:Web Audio AnalyserNode 频谱数据驱动(本地音频为真实数据);
 * · 跨域音频源(分析器输出全零)或暂停时:退回低幅模拟波动;
 * · 仅模态形态显示,关闭模态即停止绘制。
 * 画布在两个面板(圆条/卡片)各插入一份,尺寸自适应 + DPR。
 */

(function () {
  "use strict";

  var player = document.querySelector(".music-player");
  if (!player) return;
  var audio = document.querySelector(".music-player-audio");

  var wavePill = null;
  var waveCard = null;
  var rafId = null;
  var audioCtx = null;
  var analyser = null;
  var freqData = null;
  var analyserBroken = false;
  var t = 0;
  var BARS = 8;

  /* ---------- 画布插入(圆条:信息与分隔线之间;卡片:控制键之前) ---------- */
  function ensureWaves() {
    var pillInner = player.querySelector(".music-player-pill-inner");
    var divider = player.querySelector(".music-player-pill-divider");
    if (pillInner && !wavePill) {
      wavePill = document.createElement("canvas");
      wavePill.className = "music-wave";
      pillInner.insertBefore(wavePill, divider || null);
    }
    var card = player.querySelector(".music-player-card");
    var controls = card ? card.querySelector(".music-player-controls") : null;
    if (card && !waveCard) {
      waveCard = document.createElement("canvas");
      waveCard.className = "music-wave";
      card.insertBefore(waveCard, controls || null);
    }
  }

  /* ---------- 分析器:首次播放时创建(需要用户手势);跨域源自动退化 ---------- */
  function ensureAnalyser() {
    if (analyser) return true;
    if (analyserBroken) return false;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !audio) {
      analyserBroken = true;
      return false;
    }
    try {
      audioCtx = new AC();
      var src = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      analyserBroken = true;
      return false;
    }
    if (audioCtx.state === "suspended")
      audioCtx.resume().catch(function () {});
    return !!analyser;
  }

  /* ---------- 绘制:横向圆角短条,自上而下堆叠;颜色跟随主题 --accent-color ---------- */
  // 每帧读取计算样式:调色盘/主题色切换即时生效,成本可忽略
  function accentColor() {
    var v = "";
    try {
      v = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-color");
    } catch (e) {}
    v = (v || "").trim();
    return v || "#51cf66";
  }

  function draw(ts) {
    rafId = requestAnimationFrame(draw);
    if (!player.classList.contains("in-modal-mode")) return;
    t = ts || 0;

    var playing = audio && !audio.paused;
    var vals = null;
    var i;

    if (playing && ensureAnalyser()) {
      analyser.getByteFrequencyData(freqData);
      vals = [];
      var sum = 0;
      // 取低中频段(音乐能量集中区),高频段多为静默
      for (i = 0; i < BARS; i++) {
        vals.push(freqData[2 + Math.floor((i * freqData.length * 0.5) / BARS)] / 255);
        sum += vals[i];
      }
      // 跨域音频源会让分析器输出全零:退回模拟波动
      if (sum === 0) vals = null;
    }

    if (!vals) {
      vals = [];
      for (i = 0; i < BARS; i++) {
        vals.push(0.3 + 0.22 * Math.sin(t / 340 + i * 0.9));
      }
    }

    var dpr = window.devicePixelRatio || 1;
    var accent = accentColor();
    [wavePill, waveCard].forEach(function (c) {
      if (!c) return;
      var w = c.clientWidth;
      var h = c.clientHeight;
      if (!w || !h) return;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      var g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      var gap = 6;
      var rowH = (h - gap * (BARS - 1)) / BARS;
      var r = rowH / 2;

      function trackPath(x, y, w2, h2, rad) {
        g.beginPath();
        if (g.roundRect) g.roundRect(x, y, w2, h2, rad);
        else g.rect(x, y, w2, h2);
        g.fill();
      }

      for (var b = 0; b < BARS; b++) {
        var y = b * (rowH + gap);
        // 中性轨道铺满整行(亮暗两种播放器底色上都可见)
        g.fillStyle = "rgba(127, 127, 127, 0.25)";
        trackPath(0, y, w, rowH, r);
        // 主题色幅度条:随音乐起伏,最短保持圆头可见
        var amp = 0.14 + vals[b] * 0.86;
        var bw = Math.max(rowH, w * amp);
        g.fillStyle = accent;
        trackPath(0, y, bw, rowH, r);
      }
    });
  }

  function start() {
    ensureWaves();
    if (!rafId) rafId = requestAnimationFrame(draw);
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  /* ---------- in-modal-mode 切换(模态打开/关闭)时启停 ---------- */
  var classMO = new MutationObserver(function () {
    if (player.classList.contains("in-modal-mode")) start();
    else stop();
  });
  classMO.observe(player, { attributes: true, attributeFilter: ["class"] });

  ensureWaves();
  if (player.classList.contains("in-modal-mode")) start();
})();
