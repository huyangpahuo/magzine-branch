/**
 * 分类页"文件夹"视图 (categories-explorer.js, 仅电脑端)
 *
 * 与竖排手风琴共存于同一页面,由 .categories-content 上的 explorer-on 类切换:
 *   · 页面右上角"竖排/文件夹"分段按钮切换视图,选择存 localStorage;
 *   · 左侧文件夹列表点击切换分类,右侧展示该分类的文章;
 *   · 右侧头部可切换网格/列表两种排列(仿文件管理器),选择存 localStorage;
 *   · 侧边栏与内容区之间的分隔条可拖动调宽,宽度存 localStorage。
 * 手机端由 CSS 强制回退竖排(见 css/categories-explorer.css 媒体查询)。
 * pjax 换页后 main 整体替换并重新派发 DOMContentLoaded,本脚本随之在新 DOM 上重新绑定。
 */
(function () {
  "use strict";

  var MODE_KEY = "categoriesViewMode"; // classic | explorer
  var LAYOUT_KEY = "categoriesExplorerLayout"; // grid | list
  var WIDTH_KEY = "categoriesExplorerSidebar"; // px
  var SORT_KEY = "categoriesExplorerSort"; // date | alpha

  /* 按字母排序用的比较器:英文按 A-Z,中文按拼音(均不区分大小写) */
  var pinyinCollator = null;
  var enCollator = null;
  try {
    pinyinCollator = new Intl.Collator("zh-Hans-CN-u-co-pinyin", {
      sensitivity: "base",
    });
    enCollator = new Intl.Collator("en", { sensitivity: "base" });
  } catch (e) {
    pinyinCollator = null;
    enCollator = null;
  }

  /* 标题首字符类型:0 英文 / 1 中文 / 2 数字与符号(统一垫底) */
  function titleRank(title) {
    var c = title.trim().charAt(0);
    if (/[A-Za-z]/.test(c)) return 0;
    if (/[\u4e00-\u9fff]/.test(c)) return 1;
    return 2;
  }

  function readStore(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.querySelector(".categories-content");
    if (!root) return;
    var explorer = root.querySelector(".categories-explorer");
    var toolbar = root.querySelector(".categories-view-toolbar");
    if (!explorer || !toolbar) return; // 仅手风琴布局且开启 explorer 时渲染

    /* ---- 竖排 / 文件夹 视图切换 ---- */
    var modeBtns = toolbar.querySelectorAll(".cx-mode-btn");

    function applyMode(mode) {
      root.classList.toggle("explorer-on", mode === "explorer");
      modeBtns.forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.mode === mode);
      });
    }

    modeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyMode(btn.dataset.mode);
        writeStore(MODE_KEY, btn.dataset.mode);
      });
    });
    applyMode(readStore(MODE_KEY, "classic"));

    /* ---- 文件夹选择 ---- */
    var folders = explorer.querySelectorAll(".cx-folder");
    var panes = explorer.querySelectorAll(".cx-pane");
    var mainName = explorer.querySelector(".cx-main-name");
    var mainCount = explorer.querySelector(".cx-main-count");

    function selectFolder(folder) {
      var name = folder.dataset.name;
      folders.forEach(function (f) {
        f.classList.toggle("active", f === folder);
      });
      panes.forEach(function (pane) {
        pane.classList.toggle("active", pane.dataset.name === name);
      });
      if (mainName) mainName.textContent = name;
      var count = folder.querySelector(".cx-folder-count");
      if (mainCount) mainCount.textContent = count ? count.textContent : "";
    }

    folders.forEach(function (folder) {
      folder.addEventListener("click", function () {
        selectFolder(folder);
      });
    });

    // 初始选中:URL ?category= 参数优先,否则第一个文件夹
    var initial =
      folders.length &&
      (function () {
        var param = new URLSearchParams(window.location.search).get("category");
        if (!param) return null;
        return (
          Array.prototype.find.call(folders, function (f) {
            return f.dataset.name === param;
          }) || null
        );
      })();
    selectFolder(initial || folders[0]);

    /* ---- 按日期 / 按字母 排序 ---- */
    // "按日期"即服务端渲染的原始顺序(日期降序),故先给每张卡片记下原始位置
    var sortBtns = explorer.querySelectorAll(".cx-sort-btn");
    panes.forEach(function (pane) {
      pane.querySelectorAll(".cx-item").forEach(function (item, idx) {
        item.dataset.origIdx = String(idx);
      });
    });

    function applySort(mode) {
      explorer.classList.toggle("sort-alpha", mode === "alpha");
      sortBtns.forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.sort === mode);
      });
      panes.forEach(function (pane) {
        var items = Array.prototype.slice.call(
          pane.querySelectorAll(".cx-item"),
        );
        if (mode === "alpha") {
          items.sort(function (a, b) {
            var ta = a.querySelector(".cx-item-name").textContent;
            var tb = b.querySelector(".cx-item-name").textContent;
            var ra = titleRank(ta);
            var rb = titleRank(tb);
            if (ra !== rb) return ra - rb; // 英文 → 中文 → 符号/数字垫底
            if (ra === 2) return +a.dataset.origIdx - +b.dataset.origIdx;
            if (ra === 0)
              return enCollator
                ? enCollator.compare(ta, tb)
                : ta.localeCompare(tb);
            return pinyinCollator
              ? pinyinCollator.compare(ta, tb)
              : ta.localeCompare(tb);
          });
        } else {
          // 按日期:比较年月日(YYYY-MM-DD 可直接按字符串比较),最新的排在最前面;
          // 同一天的文章保持服务端渲染的原始顺序
          items.sort(function (a, b) {
            var da = a.querySelector(".cx-item-date").textContent.trim();
            var db = b.querySelector(".cx-item-date").textContent.trim();
            if (da !== db) return da > db ? -1 : 1;
            return +a.dataset.origIdx - +b.dataset.origIdx;
          });
        }
        items.forEach(function (item) {
          pane.appendChild(item); // 按新顺序重新挂载
        });
      });
    }

    sortBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applySort(btn.dataset.sort);
        writeStore(SORT_KEY, btn.dataset.sort);
      });
    });
    applySort(readStore(SORT_KEY, "date"));

    /* ---- 网格 / 列表排列切换 ---- */
    var layoutBtns = explorer.querySelectorAll(".cx-layout-btn");

    function applyLayout(layout) {
      explorer.classList.toggle("view-grid", layout !== "list");
      explorer.classList.toggle("view-list", layout === "list");
      layoutBtns.forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.layout === layout);
      });
    }

    layoutBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyLayout(btn.dataset.layout);
        writeStore(LAYOUT_KEY, btn.dataset.layout);
      });
    });
    applyLayout(readStore(LAYOUT_KEY, "grid"));

    /* ---- 侧边栏宽度拖动 ---- */
    var resizer = explorer.querySelector(".cx-resizer");
    var sidebar = explorer.querySelector(".cx-sidebar");
    var savedWidth = parseInt(readStore(WIDTH_KEY, ""), 10);
    if (!isNaN(savedWidth)) {
      explorer.style.setProperty(
        "--cx-sidebar-w",
        Math.min(420, Math.max(160, savedWidth)) + "px",
      );
    }

    if (resizer && sidebar) {
      resizer.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        var startX = e.clientX;
        var startW = sidebar.getBoundingClientRect().width;
        var lastX = e.clientX;
        try {
          resizer.setPointerCapture(e.pointerId);
        } catch (err) {
          // 合成事件等没有活动指针时捕获会失败,拖动仍走元素自身监听
        }
        document.body.classList.add("cx-resizing");

        function onMove(ev) {
          lastX = ev.clientX;
          var w = Math.min(420, Math.max(160, startW + ev.clientX - startX));
          explorer.style.setProperty("--cx-sidebar-w", w + "px");
        }
        function onUp() {
          resizer.removeEventListener("pointermove", onMove);
          resizer.removeEventListener("pointerup", onUp);
          resizer.removeEventListener("pointercancel", onUp);
          document.body.classList.remove("cx-resizing");
          var w = Math.min(420, Math.max(160, startW + lastX - startX));
          explorer.style.setProperty("--cx-sidebar-w", w + "px");
          writeStore(WIDTH_KEY, String(w));
        }
        resizer.addEventListener("pointermove", onMove);
        resizer.addEventListener("pointerup", onUp);
        resizer.addEventListener("pointercancel", onUp);
      });
    }
  });
})();
