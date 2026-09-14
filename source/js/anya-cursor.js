/**
 * 阿尼亚自定义鼠标指针(anya-cursor.js)
 *
 * 浏览器的 CSS cursor 不支持动画图(浏览器原生只认静态 .cur/.png),
 * 所以由 .agents/skills/web-cursor-converter/scripts/cursor_convert.py 把 Windows 光标包(.ani)逐帧转成 PNG,
 * 这里再按 .ani 自带的帧率(1 jiffie = 1/60 秒)用定时器逐帧切换 CSS 变量,
 * cursor.css 里通过 var() 引用这些变量,实现"会动的鼠标指针"。
 *
 * 行为说明:
 *   - 只在桌面(能悬停且有指针)设备启用,手机/平板自动跳过;
 *   - 系统开启"减少动态效果"(prefers-reduced-motion)时不做动画,
 *     停留在第 0 帧的静态光标;
 *   - 启动时预加载所有帧,避免指针状态首次切换时闪回系统默认;
 *   - 标签页切到后台时暂停动画,回来自动恢复;
 *   - pjax 换页只替换 main 区域,变量挂在 <html> 上,无需任何重建逻辑。
 */
(function () {
  "use strict";

  var data = window.ANYA_CURSOR;
  if (!data) return;

  // 触屏设备没有鼠标指针,不做任何事
  if (!window.matchMedia("(pointer: fine)").matches) return;

  // 尊重读者的"减少动态效果"设置:静态第 0 帧由 cursor.css 的兜底提供
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // 从本脚本自身的 src 推导资源目录,兼容 Hexo 子目录部署(url_for 前缀)
  var base = "/cursors/anya/";
  var script =
    document.currentScript ||
    (function () {
      var all = document.querySelectorAll('script[src*="anya-cursor"]');
      return all[all.length - 1];
    })();
  if (script && script.src) {
    base = script.src.replace(/js\/anya-cursor[^\/]*\.js.*$/, "cursors/anya/");
  }

  var root = document.documentElement;
  var animated = [];

  // 预加载全部帧;多帧状态进入动画列表
  Object.keys(data).forEach(function (key) {
    var st = data[key];
    st._imgs = st.frames.map(function (path) {
      var img = new Image();
      img.src = base + path;
      return img;
    });
    if (st.frames.length > 1) animated.push(key);
  });
  if (!animated.length) return;

  var tick = 0;

  function apply() {
    for (var i = 0; i < animated.length; i++) {
      var st = data[animated[i]];
      var img = st._imgs[tick % st.frames.length];
      // 帧还没加载完就沿用上一帧,避免闪回系统指针
      if (!img.complete || !img.naturalWidth) continue;
      root.style.setProperty(
        "--anya-cursor-" + animated[i],
        "url(" + img.src + ") " + st.hotspot[0] + " " + st.hotspot[1]
      );
    }
  }

  apply(); // 立即铺上第 0 帧,把静态兜底换成带热点的正式光标

  var timer = null;
  // 各状态帧率一致(转换脚本里已按 .ani 的 anih/rate 换算成毫秒),取任一即可
  var ms = data[normalKey()] ? data[normalKey()].ms : 100;

  function normalKey() {
    return animated.indexOf("normal") !== -1 ? "normal" : animated[0];
  }

  function start() {
    if (timer) return;
    timer = setInterval(function () {
      tick++;
      apply();
    }, ms);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  start();
})();
