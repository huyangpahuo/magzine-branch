/**
 * 代码块 v2 — 前端交互 (js/highlight.js)
 *
 * 适配构建期生成的新结构(.codecard,见 scripts/filters/highlight.js):
 *   1. 复制按钮:读取 .codecard-pre 的纯文本写入剪贴板;
 *   2. 折叠:超过主题配置 max_height 的代码块加 .foldable/.folded,
 *      底部渐变遮罩 + 展开/折叠按钮(支持 i18n);
 *   3. 兼容 pjax:pjax-init 会重新派发 DOMContentLoaded,重复执行由
 *      data-cv2 标记挡住,新内容(新节点)自然会被处理。
 * 模态窗口(iframe)与直链页面加载的是同一份页面,天然都生效。
 */
document.addEventListener("DOMContentLoaded", function () {
  // pjax 换页会重新派发 DOMContentLoaded:复制监听只注册一次,折叠可重复执行
  var registerCopy = !window.__codeBlockV2Copy;
  window.__codeBlockV2Copy = true;

  function t(text) {
    return window.i18n && typeof window.i18n.get === "function"
      ? window.i18n.get(text)
      : text;
  }

  /* ---------- 1. 复制(事件委托,兼容动态内容) ---------- */
  if (registerCopy) {
    document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".codecard-copy") : null;
    if (!btn) return;

    var block = btn.closest(".codecard");
    if (!block) return;
    var code = block.querySelector(".codecard-pre");
    if (!code) return;

    var text = code.textContent || "";
    var notice = block.querySelector(".codecard-notice");

    function flash() {
      if (notice) {
        notice.textContent = t("已复制");
        notice.style.opacity = "1";
        setTimeout(function () {
          notice.style.opacity = "0";
        }, 1800);
      }
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
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (err) {}
    ta.remove();
  }

  /* ---------- 2. 折叠 ---------- */
  var cfg = (window.theme && window.theme.code_block) || {};
  var enableFolding = cfg.enable_folding !== false;
  var maxHeight = parseInt(
    String(cfg.max_height || 300).replace("px", ""),
    10,
  );
  if (enableFolding) {
    document.documentElement.style.setProperty(
      "--code-max-height",
      maxHeight + "px",
    );
  }

  function setupFolding() {
    if (!enableFolding) return;
    document
      .querySelectorAll(".post-content .codecard:not([data-cv2])")
      .forEach(function (block) {
        block.setAttribute("data-cv2", "1");

        var pre = block.querySelector(".codecard-pre");
        if (!pre) return;
        if (pre.scrollHeight <= maxHeight) return;

        block.classList.add("foldable", "folded");

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "codecard-fold";
        btn.innerHTML =
          '<span class="codecard-fold-text">' +
          t("展开代码") +
          '</span><span class="codecard-fold-arrow" aria-hidden="true">▾</span>';
        btn.addEventListener("click", function () {
          var folded = block.classList.toggle("folded");
          var txt = btn.querySelector(".codecard-fold-text");
          if (txt) txt.textContent = folded ? t("展开代码") : t("折叠代码");
        });
        block.appendChild(btn);
      });
  }

  setupFolding();
});
