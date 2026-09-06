/**
 * ============================================
 * 读者设置面板 (reader-settings.js)
 *
 * 1. 在 <head> 中尽早执行:把浏览器里保存的读者设置
 *    应用为覆盖样式与 theme 配置补丁(防闪烁);
 * 2. 电脑端右键页面空白处弹出设置面板(桌宠有自己的右键菜单,
 *    在桌宠上右键不会触发本面板),面板可滚动;
 *    点击"确定设置"后保存到浏览器并强制刷新生效。
 *
 * 面板中可显示的设置项由 config.yml 的 reader_settings.items 决定。
 * ============================================
 */

(function () {
  "use strict";

  var STORAGE_KEY = "readerSettings";

  /* ============ 读取已保存的设置 ============ */
  var rs = {};
  try {
    rs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (e) {
    rs = {};
  }
  window.__readerSettings = rs;

  /* ============ 供 theme 合并的配置补丁(在 window.theme 赋值前设置) ============ */
  var patch = {};
  if (rs.article_view)
    patch.article_list = { view_mode: rs.article_view };
  if (rs.image_mode || rs.image_thumbs) {
    patch.image_viewer = {};
    if (rs.image_mode) patch.image_viewer.desktop_switch_mode = rs.image_mode;
    if (rs.image_thumbs)
      patch.image_viewer.desktop_thumbnails = rs.image_thumbs === "on";
  }
  if (rs.pet_pretext && window.location) {
    patch.pet = {
      pretext_interaction: { enable: rs.pet_pretext === "on" },
    };
  }
  window.__readerThemePatch = patch;

  // 默认语言(语言切换脚本会在初始化时读取)
  if (rs.lang) localStorage.setItem("site_lang", rs.lang);

  /* ============ 尽早注入覆盖样式(防闪烁) ============ */
  (function injectEarlyCss() {
    var css = "";
    if (rs.sakana === "off")
      css += "#sakana-widget-wrapper{display:none!important}";
    if (rs.pet === "off") css += "#pet-root{display:none!important}";
    if (rs.cover === "off") css += "#blog-cover{display:none!important}";
    if (rs.color_picker === "off")
      css += ".theme-color-picker-container{display:none!important}";
    if (rs.toc === "hide")
      css +=
        ".toc-sidebar,#table-of-contents,.mobile-toc-toggle{display:none!important}";
    if (!css) return;
    var s = document.createElement("style");
    s.id = "reader-settings-style";
    s.textContent = css;
    document.head.appendChild(s);
  })();

  /* ============ DOM 就绪后应用需要 DOM 的设置 ============ */
  document.addEventListener("DOMContentLoaded", function () {
    // 主题配置补丁(供 article-modal / image-zoom / 桌宠模块读取)
    if (window.theme && window.__readerThemePatch) {
      Object.keys(window.__readerThemePatch).forEach(function (k) {
        var v = window.__readerThemePatch[k];
        if (v && typeof v === "object") {
          window.theme[k] = Object.assign(window.theme[k] || {}, v);
        } else {
          window.theme[k] = v;
        }
      });
    }

    // 导航栏样式
    if (rs.navbar) {
      var header = document.querySelector(".header");
      if (header) {
        header.classList.toggle("navbar-bubble", rs.navbar === "bubble");
      }
    }

    // 音乐播放器形态与位置(在播放器脚本初始化前修改)
    if (rs.music_style || rs.music_position) {
      var player = document.querySelector(".music-player");
      if (player) {
        if (rs.music_style) {
          player.classList.remove("style-pill", "style-card");
          player.classList.add("style-" + rs.music_style);
          player.dataset.style = rs.music_style;
        }
        if (rs.music_position) player.dataset.pcPosition = rs.music_position;
      }
    }
  });

  /* ============ 电脑端右键设置面板 ============ */
  document.addEventListener("DOMContentLoaded", function () {
    if (window.innerWidth <= 768) return; // 仅电脑端
    if (!(window.theme && window.theme.reader_settings && window.theme.reader_settings.enable))
      return;

    var items = window.theme.reader_settings.items || {};

    // 面板样式(自注入,一次)
    if (!document.getElementById("reader-settings-panel-style")) {
      var ps = document.createElement("style");
      ps.id = "reader-settings-panel-style";
      ps.textContent = [
        ".reader-settings-panel{position:fixed;z-index:100001;width:264px;max-height:62vh;display:none;flex-direction:column;background:rgba(var(--card-bg-rgb,255,255,255),0.85);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:0 8px 30px rgba(0,0,0,.12);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:var(--text-color);overflow:hidden;font-size:13px;-webkit-user-select:none;user-select:none}",
        "body.dark-mode .reader-settings-panel{background:rgba(38,38,38,0.85);box-shadow:0 8px 30px rgba(0,0,0,.4)}",
        ".reader-settings-panel.open{display:flex}",
        ".rs-panel-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;flex:0 0 auto;border-bottom:1px solid var(--border-color)}",
        ".rs-panel-title{font-weight:700;font-size:0.8rem;letter-spacing:1px}",
        ".rs-panel-close{cursor:pointer;font-size:18px;line-height:1;opacity:.7}",
        ".rs-panel-close:hover{opacity:1}",
        ".rs-panel-body{overflow-y:auto;padding:8px 12px;flex:1 1 auto;scrollbar-width:thin}",
        ".rs-panel-body::-webkit-scrollbar{width:5px}",
        ".rs-panel-body::-webkit-scrollbar-thumb{background:var(--border-color);border-radius:3px}",
        ".rs-group{padding:6px 0;border-bottom:1px solid var(--border-color)}",
        ".rs-group:last-child{border-bottom:none}",
        ".rs-group-title{font-size:0.72rem;color:var(--secondary-color);font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:5px}",
        ".rs-row{display:flex;align-items:center;justify-content:space-between;padding:3px 0;gap:8px}",
        ".rs-label{flex:1 1 auto;font-size:0.8rem}",
        ".rs-select{max-width:130px;padding:4px 6px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--background-color);color:var(--text-color);font-size:0.78rem;outline:none;cursor:pointer;transition:all var(--transition-fast)}",
        ".rs-select:hover{border-color:var(--accent-color)}",
        ".rs-switch{position:relative;display:inline-block;width:34px;height:18px;flex:0 0 auto}",
        ".rs-switch input{opacity:0;width:0;height:0}",
        ".rs-slider-dot{position:absolute;inset:0;border-radius:18px;background:var(--border-color);transition:background .25s ease;cursor:pointer}",
        ".rs-slider-dot::before{content:'';position:absolute;width:12px;height:12px;left:3px;top:3px;border-radius:50%;background:#fff;transition:transform .25s cubic-bezier(.34,1.56,.64,1);box-shadow:0 1px 3px rgba(0,0,0,.25)}",
        ".rs-switch input:checked + .rs-slider-dot{background:var(--accent-color)}",
        ".rs-switch input:checked + .rs-slider-dot::before{transform:translateX(16px)}",
        ".rs-panel-footer{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--border-color);flex:0 0 auto}",
        ".rs-panel-footer button{flex:1;padding:7px 0;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--background-color);color:var(--text-color);cursor:pointer;font-size:0.78rem;transition:all var(--transition-fast)}",
        ".rs-panel-footer button:hover{background:var(--accent-color);border-color:var(--accent-color);color:#fff}",
        ".rs-panel-footer .rs-panel-apply{font-weight:600}",
        ".reader-settings-panel *{box-sizing:border-box}",
      ].join("\n");
        document.head.appendChild(ps);
    }

    // 面板章节定义:show 由主题功能决定,渲染由 config 的 items 决定
    var available = [
      {
        key: "music_player", label: "音乐播放器",
        show: !!(window.theme.music_player && window.theme.music_player.enable),
        items: [
          { key: "music_style", label: "形态", type: "select",
            options: [["pill", "圆条型"], ["card", "卡片"]], def: window.theme.music_player.style || "pill" },
          { key: "music_position", label: "位置(电脑端)", type: "select",
            options: [["floating", "悬浮左侧"], ["header", "导航栏内"]], def: window.theme.music_player.pc_position || "floating" },
        ],
      },
      {
        key: "pet", label: "桌宠",
        show: !!(window.theme.pet && window.theme.pet.enable),
        items: [
          { key: "pet", label: "启用桌宠", type: "toggle", def: "on" },
          { key: "pet_pretext", label: "文字穿梭效果", type: "toggle",
            def: (window.theme.pet.pretext_interaction && window.theme.pet.pretext_interaction.enable) ? "on" : "off" },
        ],
      },
      {
        key: "sakana", label: "Sakana 小人",
        show: !!(window.theme.sakana && window.theme.sakana.enable),
        items: [{ key: "sakana", label: "显示 Sakana", type: "toggle", def: "on" }],
      },
      {
        key: "navbar", label: "导航栏", show: true,
        items: [
          { key: "navbar", label: "样式", type: "select",
            options: [["bubble", "气泡式"], ["fill", "填充式"]],
            def: (window.theme.navbar && window.theme.navbar.style) || "bubble" },
        ],
      },
      {
        key: "theme_color", label: "主题色",
        show: !!(window.theme.color_picker && window.theme.color_picker.enable),
        items: [{ key: "color_picker", label: "显示调色盘", type: "toggle", def: "on" }],
      },
      {
        key: "click_effect", label: "鼠标点击效果", show: true,
        items: [
          { key: "click_effect", label: "效果", type: "select",
            options: [["heart", "爱心文字"], ["fireworks", "三角烟花"]], def: "heart" },
        ],
      },
      {
        key: "toc", label: "目录", show: true,
        items: [{ key: "toc", label: "显示目录", type: "toggle", def: "on" }],
      },
      {
        key: "cover", label: "封面",
        show: !!(window.theme.cover && window.theme.cover.enable),
        items: [{ key: "cover", label: "启用封面", type: "toggle", def: "on" }],
      },
      {
        key: "article_view", label: "文章浏览",
        show: !!(window.theme.article_list),
        items: [
          { key: "article_view", label: "浏览方式", type: "select",
            options: [["modal", "模态窗口"], ["direct", "直接打开"]],
            def: window.theme.article_list.view_mode || "modal" },
        ],
      },
      {
        key: "language", label: "语言 / Language", show: true,
        items: [
          { key: "lang", label: "界面语言", type: "select",
            options: [["zh", "中文"], ["en", "English"]],
            def: localStorage.getItem("site_lang") || "zh" },
        ],
      },
      {
        key: "image_viewer", label: "图片查看器", show: true,
        items: [
          { key: "image_mode", label: "切换方式(电脑端)", type: "select",
            options: [["peek", "两侧预览图"], ["buttons", "上一张/下一张"]],
            def: (window.theme.image_viewer && window.theme.image_viewer.desktop_switch_mode) || "peek" },
          { key: "image_thumbs", label: "电脑端缩略图", type: "toggle",
            def: (window.theme.image_viewer && window.theme.image_viewer.desktop_thumbnails !== false) ? "on" : "off" },
        ],
      },
      {
        key: "falling_leaves", label: "落叶效果", show: true,
        items: [{ key: "leaves", label: "启用落叶", type: "toggle", def: "on" }],
      },
    ].filter(function (s) { return s.show && items[s.key] !== false; });

    /* ---- 面板 DOM ---- */
    var panel = document.createElement("div");
    panel.className = "reader-settings-panel";
    panel.innerHTML = `
      <div class="rs-panel-header">
        <span class="rs-panel-title">设置</span>
        <span class="rs-panel-close" title="关闭">&times;</span>
      </div>
      <div class="rs-panel-body"></div>
      <div class="rs-panel-footer">
        <button class="rs-panel-reset">恢复默认</button>
        <button class="rs-panel-apply">确定设置</button>
      </div>
    `;
    document.body.appendChild(panel);
    var body = panel.querySelector(".rs-panel-body");

    function buildPanel() {
      body.innerHTML = "";
      available.forEach(function (section) {
        if (items[section.key] === false) return; // config 关闭的项不渲染
        var group = document.createElement("div");
        group.className = "rs-group";
        var title = document.createElement("div");
        title.className = "rs-group-title";
        title.textContent = section.label;
        group.appendChild(title);

        section.items.forEach(function (item) {
          var row = document.createElement("div");
          row.className = "rs-row";
          var label = document.createElement("label");
          label.className = "rs-label";
          label.textContent = item.label;
          row.appendChild(label);

          if (item.type === "toggle") {
            var sw = document.createElement("label");
            sw.className = "rs-switch";
            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.dataset.key = item.key;
            cb.checked = getVal(item.key, item.def) === "on";
            var slider = document.createElement("span");
            slider.className = "rs-slider-dot";
            sw.appendChild(cb);
            sw.appendChild(slider);
            row.appendChild(sw);
          } else {
            var sel = document.createElement("select");
            sel.className = "rs-select";
            sel.dataset.key = item.key;
            item.options.forEach(function (opt) {
              var o = document.createElement("option");
              o.value = opt[0];
              o.textContent = opt[1];
              sel.appendChild(o);
            });
            sel.value = getVal(item.key, item.def);
            row.appendChild(sel);
          }
          group.appendChild(row);
        });
        body.appendChild(group);
      });
    }

    function getVal(key, def) {
      if (key in rs) return rs[key];
      return def;
    }

    /* ---- 打开 / 关闭 ---- */
    function openPanel(x, y) {
      buildPanel();
      panel.classList.add("open");
      // 位置跟随右键,并限制在视口内
      var pw = panel.offsetWidth || 320;
      var ph = panel.offsetHeight || 500;
      var x2 = Math.min(Math.max(8, x), window.innerWidth - pw - 8);
      var y2 = Math.min(Math.max(8, y), window.innerHeight - ph - 8);
      panel.style.left = x2 + "px";
      panel.style.top = y2 + "px";
    }
    function closePanel() {
      panel.classList.remove("open");
    }

    /* ---- 右键打开(跳过桌宠) ---- */
    document.addEventListener("contextmenu", function (e) {
      if (e.target.closest("#pet-root, .reader-settings-panel")) return;
      e.preventDefault();
      openPanel(e.clientX, e.clientY);
    });

    panel.querySelector(".rs-panel-close").addEventListener("click", closePanel);
    document.addEventListener("mousedown", function (e) {
      if (!panel.classList.contains("open")) return;
      if (e.target.closest(".reader-settings-panel")) return;
      closePanel();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePanel();
    });

    /* ---- 保存并强制刷新 ---- */
    panel.querySelector(".rs-panel-apply").addEventListener("click", function () {
      var saved = {};
      panel.querySelectorAll("[data-key]").forEach(function (el) {
        saved[el.dataset.key] = el.type === "checkbox" ? (el.checked ? "on" : "off") : el.value;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      location.reload(); // 强制刷新生效
    });

    panel.querySelector(".rs-panel-reset").addEventListener("click", function () {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  });
})();
