// 文章统计 key 生成器(模板 helper:stats_key(post))
//
// 统计服务(Worker)只统计 /post/<id>、/posts/<id> 两种文章路径,
// 且 id 仅允许 [A-Za-z0-9_-](见 rightdoor/visitor-stats 的 isPostPagePath)。
// 本站永久链接是 :year/:month/:day/:title/ 且 slug 含中文,直接用真实路径
// 永远不会计入文章统计,因此把「去掉首尾斜杠的真实路径」做 FNV-1a 32 位
// 哈希,映射成稳定的 ASCII 虚拟键 /posts/<hash>:
//   - 哈希输入只依赖文章路径,hexo clean / 重新构建结果不变;
//   - 文章改标题/日期导致路径变化后,统计会从 0 重新累计(路径即身份);
//   - 浏览器端 visitor-stats.js 的 window.__statsKey 必须与本算法保持一致
//     (just-read 置顶卡片等动态渲染的节点要靠它从真实路径反推 key)。
hexo.extend.helper.register('stats_key', function (post) {
  if (!post || !post.path) return '';
  var p = String(post.path).replace(/^\/+|\/+$/g, '');
  var h = 0x811c9dc5;
  for (var i = 0; i < p.length; i++) {
    h ^= p.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return '/posts/' + h.toString(16);
});
