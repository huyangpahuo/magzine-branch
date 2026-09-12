/**
 * 生成 GitHub Pages 识别的根级 /404.html
 *
 * 主题的 404 页面来自 source/404/index.md(layout: 404),
 * 默认只生成 /404/index.html,而 GitHub Pages 找丢失路径时只会读取
 * 站点根目录下的 /404.html —— 不存在时访客看到的是 GitHub 默认 404 页。
 * 这里把 404 页面额外渲染一份到 /404.html。
 */
'use strict';

hexo.extend.generator.register('root-404-html', function (locals) {
  const pages = locals.pages;
  if (!pages || typeof pages.find !== 'function') return;
  const page = pages.find((p) => p.layout === '404');
  if (!page) return;
  return { path: '404.html', layout: '404', data: page };
});
