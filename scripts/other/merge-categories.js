/**
 * 合并重复分类(供 categories 页使用)
 *
 * Hexo 的分类按 front-matter 里的写法区分,大小写不同或带首尾空格
 * (如 "hexo" / "Hexo" / "HEXO"、"我的世界 " / "我的世界")会成为多个分类,
 * 页面上看起来就是重复且内容各不相同。
 *
 * 这里按「忽略大小写 + 去首尾空格」的名称做合并:
 *   · 文章取并集(保持日期顺序),计数为合并后的文章数;
 *   · 跳转路径取文章更多的那种写法;
 *   · 只有一种写法的分类保持原名不动(如 TTS、Git 不会被改成 Tts、Git);
 *   · 合并了多种写法的英文分类统一显示为大写开头、其余小写
 *     (hexo / Hexo / HEXO 一律显示为 Hexo),中文分类取去空格后的写法。
 */
hexo.extend.helper.register("merged_categories", function () {
  function canonicalName(name) {
    var t = name.trim();
    if (/^[A-Za-z]/.test(t)) {
      return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }
    return t;
  }

  var map = {};
  var list = [];
  this.site.categories.toArray().forEach(function (cat) {
    if (!cat || !cat.name) return;
    var key = cat.name.trim().toLowerCase();
    if (!key) return;
    var count = cat.posts ? cat.posts.length : 0;
    if (!map[key]) {
      map[key] = { name: cat.name, path: cat.path, posts: [], variants: 1 };
      list.push(map[key]);
    } else {
      map[key].variants += 1;
      if (count > map[key].posts.length) map[key].path = cat.path;
    }
    (cat.posts || []).forEach(function (post) {
      if (map[key].posts.indexOf(post) === -1) map[key].posts.push(post);
    });
  });

  list.forEach(function (item) {
    if (item.variants > 1) item.name = canonicalName(item.name);
    else item.name = item.name.trim();
  });

  list.sort(function (a, b) {
    return b.posts.length - a.posts.length;
  });
  return list;
});
