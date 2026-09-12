/**
 * 万花筒/追番页面随机卡片接线 (js/random-cards.js)
 *
 * 复用 shake-shuffle.js 的通用能力:
 *   - 万花筒(.murmur-waterfall > .murmur-card):最多展示 9 个,"摇一摇~"随机换一批;
 *   - 追番(.bili-grid > .bili-card-wrapper):最多展示 10 个,同上。
 * 两个页面的卡片每次进入都随机排序。
 * 幂等:shakeShuffle.apply 内部有按钮复用守卫,可安全响应 pjax 重初始化。
 */

(function () {
  "use strict";

  function init() {
    if (!window.shakeShuffle) return;

    // 万花筒:瀑布流卡片,最多 9 个
    var murmurGrid = document.querySelector(".murmur-waterfall");
    if (
      murmurGrid &&
      !murmurGrid.dataset.shuffleInit &&
      murmurGrid.querySelectorAll(":scope > .murmur-card").length > 0
    ) {
      murmurGrid.dataset.shuffleInit = "1";
      window.shakeShuffle.apply({
        container: murmurGrid,
        cardSelector: ".murmur-card",
        maxCount: 9,
      });
    }

    // 追番:竖版封面卡片,最多 10 个
    var biliGrid = document.querySelector(".bili-grid");
    if (
      biliGrid &&
      !biliGrid.dataset.shuffleInit &&
      biliGrid.querySelectorAll(":scope > .bili-card-wrapper").length > 0
    ) {
      biliGrid.dataset.shuffleInit = "1";
      window.shakeShuffle.apply({
        container: biliGrid,
        cardSelector: ".bili-card-wrapper",
        maxCount: 10,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // pjax 换页:新页面容器重新接一次
  document.addEventListener("pjax:complete", function () {
    setTimeout(init, 50);
  });
})();
