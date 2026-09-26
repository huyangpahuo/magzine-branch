/**
 * lazy-images.js — 构建期给 HTML 里的 <img> 补 loading="lazy" 与 decoding="async"
 *
 * ★ 为什么不在前端 JS 里做:解析器遇到 <img> 就会开始下载,JS 再补
 *   loading=lazy 已经晚了;必须在生成的 HTML 里就带上。
 * ★ 已有 loading 属性的图(如首页 hero 大图,主题模板里写 loading="eager"
 *   以外的显式声明)不会被改动。
 * ★ 对模态窗口(iframe 加载同一份文章页)与直链访问同时生效。
 */

hexo.extend.filter.register("after_render:html", function (str) {
  if (!str || str.indexOf("<img") === -1) return str;

  // 跳过已有 loading= 声明的图片;其余补 lazy + async 解码
  return str.replace(/<img(?![^>]*\bloading=)([^>]*)>/gi, function (
    m,
    attrs,
  ) {
    // data: URI 和极小占位图不值得懒加载
    if (/\bsrc=["']data:/i.test(attrs)) return m;
    return '<img loading="lazy" decoding="async"' + attrs + ">";
  });
});
