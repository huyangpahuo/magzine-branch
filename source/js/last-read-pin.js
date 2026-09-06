/**
 * 最后阅读的文章置顶 (独立脚本,无依赖)
 *
 * 功能:
 *   1. 在文章页(含 pjax 到达、文章模态窗口 iframe 内)自动记录最近阅读的文章;
 *   2. 回到主页时,把这篇文章的卡片移动到文章列表最前面;
 *   3. 并在它的封面图右上角挂一个"图钉 + 置顶"圆角徽章,颜色跟随主题强调色。
 *
 * 说明:
 *   - 通过 post.pug 上的 data-post-page 属性识别文章页
 *     (page.pug 结构与之几乎相同,不能用 post-content 判断);
 *   - 文章不在主页当前分页时不做任何处理;
 *   - 徽章 pointer-events:none,不挡卡片的点击;
 *   - 样式由本脚本注入一次,pjax 重复初始化不会重复。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "lastReadPost";

  function injectStyle() {
    if (document.getElementById("last-read-pin-style")) return;
    var style = document.createElement("style");
    style.id = "last-read-pin-style";
    style.textContent = [
      ".article-image .pin-badge {",
      "  position: absolute;",
      "  top: 10px;",
      "  right: 10px;",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 5px;",
      "  padding: 4px 12px;",
      "  border-radius: 999px;",
      "  background: var(--accent-color);",
      "  color: #ffffff;",
      "  font-size: 0.75rem;",
      "  font-weight: 600;",
      "  letter-spacing: 1px;",
      "  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);",
      "  z-index: 3;",
      "  pointer-events: none;",
      "  user-select: none;",
      "}",
      ".article-image .pin-badge i {",
      "  font-size: 0.7rem;",
      "  transform: rotate(45deg);",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // 在文章页:记录当前文章(同一篇文章重复刷新不更新时间)
  function recordIfOnPostPage() {
    if (!document.querySelector("[data-post-page]")) return false;
    var titleEl = document.querySelector("h1.post-title");
    var data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      data = null;
    }
    if (!data || data.url !== location.pathname) {
      data = { url: location.pathname, time: Date.now() };
    }
    data.title = titleEl ? titleEl.textContent.trim() : "";
    // ★ 额外收集封面/日期/分类,供主页"复制置顶卡片"完整还原外观
    var coverEl = document.querySelector(".post-cover img");
    var catEl = document.querySelector(".post-meta .post-category a");
    var dateEl = document.querySelector(".post-date time");
    data.cover = coverEl ? coverEl.getAttribute("src") : "";
    data.date = dateEl ? dateEl.getAttribute("datetime") : "";
    data.category = catEl
      ? { name: catEl.textContent.trim(), url: catEl.getAttribute("href") }
      : null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  }

  // 按记录构建一张与主页卡片同构的副本
  function buildPinnedCard(record) {
    var card = document.createElement("article");
    card.className = "article-card";
    card.setAttribute("data-pinned-copy", record.url);

    var image = document.createElement("div");
    image.className = "article-image";
    var imgLink = document.createElement("a");
    imgLink.href = record.url;
    var img = document.createElement("img");
    img.src = record.cover || "";
    img.alt = record.title || "";
    img.loading = "lazy";
    imgLink.appendChild(img);
    var overlay = document.createElement("div");
    overlay.className = "read-overlay";
    var overlayText = document.createElement("span");
    overlayText.className = "read-text";
    overlayText.setAttribute("data-label", "点击阅读->");
    overlayText.textContent = "点击阅读->";
    overlay.appendChild(overlayText);
    imgLink.appendChild(overlay);
    image.appendChild(imgLink);

    var content = document.createElement("div");
    content.className = "article-content";
    var meta = document.createElement("div");
    meta.className = "article-meta";
    if (record.category && record.category.url) {
      var cat = document.createElement("span");
      cat.className = "article-category";
      var catA = document.createElement("a");
      catA.href = record.category.url;
      catA.textContent = record.category.name || "";
      cat.appendChild(catA);
      meta.appendChild(cat);
    }
    var dateEl = document.createElement("time");
    dateEl.className = "article-date";
    if (record.date) {
      dateEl.setAttribute("datetime", record.date);
      dateEl.setAttribute("data-date-standard", record.date.slice(0, 10));
      var d = new Date(record.date);
      if (!isNaN(d.getTime())) {
        dateEl.textContent = d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        });
      }
    }
    meta.appendChild(dateEl);
    content.appendChild(meta);

    var h3 = document.createElement("h3");
    h3.className = "article-title";
    var titleA = document.createElement("a");
    titleA.href = record.url;
    titleA.textContent = record.title || "";
    h3.appendChild(titleA);
    content.appendChild(h3);

    card.appendChild(image);
    card.appendChild(content);
    return card;
  }

  // 在主页:把最近阅读的文章"复制"一份到列表最前并加图钉徽章
  // ★ 是复制而非移动——文章本体在各页的位置保持不变
  function pinOnHome() {
    // ★ 只在主页第一页置顶;分页页(/page/N/)保持时间顺序
    if (location.pathname !== "/") return;
    var grid = document.querySelector(".articles-grid");
    var record = null;
    try {
      record = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      record = null;
    }
    if (!grid || !record || !record.url) return;

    // 已经是对应文章的置顶副本 → 无需处理
    var first = grid.querySelector(":scope > .article-card");
    if (first && first.getAttribute("data-pinned-copy") === record.url) return;

    // 摘掉旧副本与所有旧徽章
    grid
      .querySelectorAll(".article-card[data-pinned-copy]")
      .forEach(function (el) {
        el.remove();
      });
    grid.querySelectorAll(".pin-badge").forEach(function (b) {
      b.remove();
    });

    // 复制置顶卡片到最前(尺寸与排版延续首卡)
    var card = buildPinnedCard(record);
    if (typeof applyRandomLayout === "function") {
      applyRandomLayout([card], 0);
    }
    grid.insertBefore(card, grid.firstChild);

    var image = card.querySelector(".article-image");
    if (image) {
      var badge = document.createElement("div");
      badge.className = "pin-badge";
      badge.innerHTML = '<i class="fas fa-thumbtack"></i><span>置顶</span>';
      image.appendChild(badge);
    }
  }

  function init() {
    injectStyle();
    hookModalIframe();
    var onPost = recordIfOnPostPage();
    if (!onPost) pinOnHome();
  }

  // 桌面端文章通过模态窗口 iframe 阅读,不发生 pjax 导航。
  // 监听 iframe 的 load 事件:iframe 内的记录完成后,立刻在主页重新置顶。
  // (模态关闭时 iframe 会被置为空白页,此时 record 返回 false,只做幂等的重新置顶)
  function hookModalIframe() {
    var iframe = document.querySelector(".article-modal-iframe");
    if (!iframe || iframe.dataset.pinHook) return;
    iframe.dataset.pinHook = "1";
    iframe.addEventListener("load", function () {
      setTimeout(function () {
        var onPost = recordIfOnPostPage();
        if (!onPost) pinOnHome();
      }, 300);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // pjax 换页后重新执行(pjax-init 重放 DOMContentLoaded 时同样会触发,
  // 这里显式监听一份,保证两种路径都覆盖;init 幂等,重复执行无副作用)
  document.addEventListener("pjax:complete", init);
})();
