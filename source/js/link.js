/**
 * 友链页面脚本 (js/link.js)
 *
 * 从 link.pug 的交互逻辑抽离,layout.pug 全局加载(pjax 常驻)。
 *
 * 功能:
 *   1. 头像连通性:img 加载失败 → 换成 config 指定的回退头像,
 *      并在名字下方显示主题色小字"头像跑掉了~";
 *   2. 站点连通性:fetch(no-cors) 探测友链站点,
 *      卡片右侧挂绿色(可连通)/红色(不可连通)圆点;
 *   3. 整卡点击跳转由 <a.link-card> 原生实现,点击时头像转一圈;
 *   4. "添加友链"板块的一键复制(我的友链信息/友链模板)。
 * 所有探测均有幂等守卫,重复初始化无副作用。
 */

(function () {
  "use strict";

  function initLinkPage() {
    initAvatarFallback();
    initSiteProbe();
    initCardSpin();
    initCopyButtons();
    // 最多展示 8 个,可"摇一摇~"随机换一批;初始顺序随机
    if (window.shakeShuffle) {
      window.shakeShuffle.apply({
        container: ".link-grid",
        cardSelector: ".link-card",
        maxCount: 8,
      });
    }
  }

  /* ---- 1. 头像连通性:失败换回退图并提示 ---- */
  function initAvatarFallback() {
    document.querySelectorAll(".link-card .link-avatar img").forEach(function (img) {
      if (img.dataset.avatarGuard) return;
      img.dataset.avatarGuard = "1";

      function markMissing() {
        var card = img.closest(".link-card");
        if (card) card.classList.add("avatar-missing");
      }

      // 原生加载失败:换回退图,同时标记"头像跑掉了~"
      img.addEventListener("error", function () {
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = "1";
          markMissing(); // 原头像挂了:即使回退图能显示也要提示
          var fb = img.getAttribute("data-fallback");
          if (fb && img.src !== fb) {
            img.src = fb;
          } else {
            img.style.visibility = "hidden";
          }
        } else {
          // 回退图也失败:隐藏 img,只显示提示
          img.style.visibility = "hidden";
          markMissing();
        }
      });

      // 缓存态可能错过 error 事件:已 complete 且 0 宽高视为失败
      if (img.complete && img.naturalWidth === 0) {
        img.dispatchEvent(new Event("error"));
      }
    });
  }

  /* ---- 2. 站点连通性:红/绿圆点 ----
     说明:浏览器跨域限制下用 fetch(url, {mode:'no-cors'}) 探测,
     请求发出且未抛错(res.type === 'opaque')即认为站点可达;
     网络层失败(DNS/超时/拒连)会 reject → 不可达。 */
  function initSiteProbe() {
    var cards = document.querySelectorAll(".link-card[data-link-url]");
    if (!cards.length) return;

    cards.forEach(function (card) {
      if (card.dataset.siteProbe) return;
      card.dataset.siteProbe = "1";
      var dot = card.querySelector(".link-status");
      if (!dot) return;

      var url = card.getAttribute("data-link-url");
      if (!url || url.indexOf("http") !== 0) {
        dot.classList.add("offline");
        return;
      }

      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller
        ? setTimeout(function () { controller.abort(); }, 8000)
        : null;

      fetch(url, {
        mode: "no-cors",
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      })
        .then(function () {
          dot.classList.add("online");
        })
        .catch(function () {
          dot.classList.add("offline");
        })
        .finally(function () {
          if (timer) clearTimeout(timer);
        });
    });
  }

  /* ---- 3. 点击卡片:头像转一圈 ---- */
  function initCardSpin() {
    document.querySelectorAll("a.link-card").forEach(function (card) {
      if (card.dataset.spinGuard) return;
      card.dataset.spinGuard = "1";
      card.addEventListener("click", function () {
        var img = card.querySelector(".link-avatar img");
        if (!img) return;
        // 重启动画:移除类 → 强制 reflow → 再加回
        img.classList.remove("spin-once");
        void img.offsetWidth;
        img.classList.add("spin-once");
      });
    });
  }

  /* ---- 4. 添加友链:一键复制 ---- */
  function initCopyButtons() {
    document.querySelectorAll(".copy-link-info").forEach(function (btn) {
      if (btn.dataset.copyGuard) return;
      btn.dataset.copyGuard = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var target = document.getElementById(btn.getAttribute("data-copy-target"));
        if (!target) return;
        var text = target.textContent.trim();

        function flash() {
          var label = btn.querySelector("span");
          if (!label || label.dataset.busy) return;
          label.dataset.busy = "1";
          var original = label.textContent;
          label.textContent = window.i18n && window.i18n.get ? window.i18n.get("已复制!") : "已复制!";
          btn.classList.add("copied");
          setTimeout(function () {
            label.textContent = original;
            delete label.dataset.busy;
            btn.classList.remove("copied");
          }, 1500);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(flash, function () {
            fallbackCopy(text);
            flash();
          });
        } else {
          fallbackCopy(text);
          flash();
        }
      });
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;top:-9999px;";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    ta.remove();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLinkPage);
  } else {
    initLinkPage();
  }
  // pjax 换页后重新执行(幂等)
  document.addEventListener("pjax:complete", initLinkPage);
})();
