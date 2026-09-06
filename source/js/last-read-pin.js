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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  }

  // 在主页:把最后阅读的文章卡片置顶并加图钉徽章
  function pinOnHome() {
    // ★ 只在主页第一页置顶;分页页(/page/N/)保持时间顺序
    if (location.pathname !== "/") return;
    var grid = document.querySelector(".articles-grid");
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!grid || !raw) return;

    var last = null;
    try {
      last = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!last || !last.url) return;

    var cards = Array.prototype.slice.call(
      grid.querySelectorAll(":scope > .article-card"),
    );
    if (!cards.length) return;

    // 按 pathname 匹配卡片(卡片里有封面链接和标题链接)
    var target = null;
    for (var i = 0; i < cards.length; i++) {
      var links = cards[i].querySelectorAll("a[href]");
      for (var j = 0; j < links.length; j++) {
        if (links[j].pathname === last.url) {
          target = cards[i];
          break;
        }
      }
      if (target) break;
    }
    if (!target) return; // 不在当前分页,不动

    if (target !== cards[0]) {
      grid.insertBefore(target, cards[0]); // 置顶
    }

    // ★ 置顶徽章全局只允许一个:先清掉其他卡片上遗留的徽章
    // (例如在文章模态里用"上一篇/下一篇"切换时,旧文章的徽章要摘掉)
    var stale = grid.querySelectorAll(".pin-badge");
    for (var k = 0; k < stale.length; k++) {
      if (stale[k].closest(".article-card") !== target) {
        stale[k].remove();
      }
    }

    var image = target.querySelector(".article-image");
    if (image && !image.querySelector(".pin-badge")) {
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
