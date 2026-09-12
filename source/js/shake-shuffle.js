/**
 * 卡片"摇一摇~"随机展示 (js/shake-shuffle.js)
 *
 * 供友链/万花筒/追番三个页面复用:
 *   1. 初始把容器内卡片随机打乱(每次进入页面顺序都不同);
 *   2. 只展示前 maxCount 张,其余折叠;
 *   3. 容器下方渲染"摇一摇~"按钮,点击后重新随机抽一批展示;
 *   4. 展示数量不足 maxCount 时按钮自动隐藏。
 *
 * 用法: shakeShuffle({ container, cardSelector, maxCount })
 * 幂等设计:pjax 重复初始化不会叠加按钮。
 */

(function () {
  "use strict";

  function injectStyle() {
    if (document.getElementById("shake-shuffle-style")) return;
    var style = document.createElement("style");
    style.id = "shake-shuffle-style";
    style.textContent = [
      ".shake-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:28px auto 6px;padding:10px 34px;border:1.5px solid var(--border-color,#ddd);border-radius:999px;background:var(--card-background-color,#fff);color:var(--text-color,#333);font-size:0.95rem;font-weight:600;cursor:pointer;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);-webkit-user-select:none;user-select:none}",
      ".shake-btn:hover{border-color:var(--accent-color,#ff6b6b);color:var(--accent-color,#ff6b6b);transform:translateY(-2px)}",
      ".shake-btn:active{transform:scale(0.94)}",
      ".shake-btn i{font-size:1.05em;transition:transform 0.3s ease}",
      ".shake-btn.shaking i{animation:shake-icon-swing 0.6s ease-in-out}",
      /* 折叠的多余卡片 */
      ".shake-hidden{display:none!important}",
      /* 展示中的卡片摇一摇入场动画 */
      ".shake-enter{animation:shake-card-in 0.45s cubic-bezier(0.22,0.61,0.36,1) both}",
      "@keyframes shake-card-in{from{opacity:0;transform:translateY(16px) scale(0.94)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes shake-icon-swing{0%{transform:rotate(0)}25%{transform:rotate(-18deg)}50%{transform:rotate(16deg)}75%{transform:rotate(-10deg)}100%{transform:rotate(0)}}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // 随机打乱(Fisher–Yates),返回新数组
  function shuffled(list) {
    var arr = Array.prototype.slice.call(list);
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function apply(cfg) {
    var container =
      typeof cfg.container === "string"
        ? document.querySelector(cfg.container)
        : cfg.container;
    if (!container) return;

    var cards = Array.prototype.slice.call(
      container.querySelectorAll(":scope > " + cfg.cardSelector),
    );
    if (cards.length === 0) return;

    var max = cfg.maxCount || 8;

    // 1. 初始随机排序(每次进入页面都不同)
    var order = shuffled(cards);
    order.forEach(function (card) {
      container.appendChild(card);
    });

    // 2. 渲染按钮(幂等:已有则复用)
    var next = container.nextElementSibling;
    var btn =
      next && next.classList && next.classList.contains("shake-btn")
        ? next
        : null;
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shake-btn";
      btn.setAttribute("data-title", "摇一摇~");
      btn.innerHTML =
        '<i class="fas fa-dice"></i><span class="shake-btn-text">摇一摇~</span>';
      container.parentNode.insertBefore(btn, container.nextSibling);
    }

    function deal(animate) {
      var show = shuffled(cards).slice(0, Math.min(max, cards.length));
      // 全部先隐藏,再把选中的放回容器前部并展示
      cards.forEach(function (card) {
        card.classList.add("shake-hidden");
        card.classList.remove("shake-enter");
      });
      show.forEach(function (card, idx) {
        card.classList.remove("shake-hidden");
        container.appendChild(card);
        if (animate) {
          void card.offsetWidth;
          card.style.animationDelay = idx * 0.04 + "s";
          card.classList.add("shake-enter");
          card.addEventListener(
            "animationend",
            function () {
              card.classList.remove("shake-enter");
              card.style.animationDelay = "";
            },
            { once: true },
          );
        }
      });
      // 数量不足时隐藏按钮
      btn.style.display = cards.length <= max ? "none" : "flex";
    }

    // 3. 点击摇一摇:重新随机
    if (!btn.dataset.shakeGuard) {
      btn.dataset.shakeGuard = "1";
      btn.addEventListener("click", function () {
        btn.classList.add("shaking");
        deal(true);
        setTimeout(function () {
          btn.classList.remove("shaking");
        }, 650);
      });
    }

    deal(false);
  }

  var api = { apply: apply, injectStyle: injectStyle };

  if (typeof window !== "undefined") window.shakeShuffle = api;

  // 供外部直接调用:自动注入样式
  var origApply = api.apply;
  api.apply = function (cfg) {
    injectStyle();
    origApply(cfg);
  };
})();
