/**
 * hide-inline-interaction.js
 * Add click interaction for hideInline tags
 */

document.addEventListener("DOMContentLoaded", function () {
  const hideInlineElements = document.querySelectorAll(".hide-inline");

  // 1. 辅助函数：获取翻译
  // 我们尝试调用全局的翻译对象，如果不存在则返回原文本
  function t(text) {
    if (window.i18n && typeof window.i18n.get === "function") {
      return window.i18n.get(text);
    }
    return text;
  }

  hideInlineElements.forEach((element) => {
    let isRevealed = false;

    element.addEventListener("click", function () {
      if (!isRevealed) {
        const hiddenContent = this.getAttribute("data-hidden-content");
        // 获取默认显示文本，通常是 "点击查看"
        const displayText =
          this.getAttribute("data-display-text") || "点击查看";

        // 保存原始样式
        const originalBgColor = this.style.backgroundColor;
        const originalTextColor = this.style.color;

        // 显示隐藏内容
        this.textContent = hiddenContent;
        this.style.backgroundColor = "transparent";
        this.style.color = "inherit";
        this.style.borderBottom = "none";
        this.style.cursor = "default";
        // ★ 标记展开状态:悬停时不再浮出"点击查看"提示(仅隐藏态显示)
        this.classList.add("revealed");
        isRevealed = true;

        // 添加一个小的提示，表明可以点击恢复
        const restoreHint = document.createElement("span");

        // ★★★ 核心修改 1：翻译 "(点击恢复)" ★★★
        // 注意：这里是带空格的，确保你的 lang-switch.js 字典里有 " (点击恢复)"
        restoreHint.textContent = t(" (点击恢复)");

        restoreHint.style.fontSize = "0.8em";
        restoreHint.style.color = "#999";
        restoreHint.style.cursor = "pointer";

        this.appendChild(restoreHint);

        // 添加点击恢复功能
        restoreHint.addEventListener("click", function (e) {
          e.stopPropagation();

          // ★★★ 核心修改 2：翻译恢复后的文本 ★★★
          // 如果 displayText 是 "点击查看"，t() 会把它变成 "Click to view"
          element.textContent = t(displayText);

          element.style.backgroundColor = originalBgColor;
          element.style.color = originalTextColor;
          element.style.borderBottom = "";
          element.style.cursor = "pointer";
          element.classList.remove("revealed");
          isRevealed = false;
        });
      }
    });
  });
});
