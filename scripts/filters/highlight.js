/**
 * 代码块 v2 — 构建期结构转换 (filters/highlight.js)
 *
 * 把 hexo-util 输出的旧 table 结构:
 *   <figure class="highlight LANG"><table><tr>
 *     <td class="gutter"><pre><span class="line">1</span><br>…</pre></td>
 *     <td class="code"><pre><span class="line">…tokens…</span><br>…</pre></td>
 *   </tr></table></figure>
 *
 * 重构为现代 div 结构(参考 Astro 博客的 codecard 设计):
 *   <div class="codecard" data-lang="LANG">
 *     <div class="codecard-header">语言标签 + 复制按钮</div>
 *     <div class="codecard-body">
 *       <div class="codecard-gutter">行号列(sticky)</div>
 *       <pre class="codecard-pre"><code class="language-LANG">…tokens…</code></pre>
 *     </div>
 *   </div>
 *
 * ★ 为什么:
 *   1. 旧结构是 <table>,被 main.css 的 .post-content table 规则
 *      (table-layout:fixed + td overflow:hidden)命中,行号列宽被压成 0,
 *      行号从未显示过——这是旧版的顽疾;
 *   2. 纯 div 结构对 content-visibility(离屏不渲染)友好;
 *   3. 语法高亮仍是 hexo 内置(hexo-util 封装 highlight.js,服务端渲染,
 *      token span 原样保留),前端零高亮开销。
 *
 * 折叠与复制按钮交互由 js/highlight.js 在客户端完成(高度需渲染后才知道)。
 */

const COPY_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';

// 行边界:上一行的 </span> + <br> + 下一行的 <span class="line">
// token span 永远嵌在 line span 内部,不会产生这个序列,替换是安全的
const LINE_BOUNDARY = "</span><br><span class=\"line\">";

hexo.extend.filter.register(
  "after_post_render",
  function (data) {
    if (!data || !data.content) return data;
    const theme = hexo.theme.config;
    const showLang = !(
      theme.code_block && theme.code_block.show_lang === false
    );

    const re = /<figure class="highlight ([^"]*)">([\s\S]*?)<\/figure>/g;

    data.content = data.content.replace(
      re,
      function (match, lang, inner) {
        const codeMatch = inner.match(
          /<td class="code"><pre>([\s\S]*?)<\/pre><\/td>/,
        );
        if (!codeMatch) return match;

        const gutterMatch = inner.match(
          /<td class="gutter"><pre>([\s\S]*?)<\/pre><\/td>/,
        );

        // ---- 行号 ----
        let numsHtml = "";
        if (gutterMatch) {
          const nums = gutterMatch[1].match(
            /<span class="line">(\d*)<\/span>/g,
          );
          if (nums) {
            numsHtml = nums
              .map(function (s) {
                return "<span>" + s.replace(/<[^>]+>/g, "") + "</span>";
              })
              .join("");
          }
        }

        // ---- 代码内容:span.line/br 结构 → 纯换行文本(保留 token span) ----
        let codeHtml = codeMatch[1];
        // 去掉最外层首个 line span 的开标签与末尾闭标签
        codeHtml = codeHtml.replace(/^<span class="line">/, "");
        codeHtml = codeHtml.replace(/<\/span>$/, "");
        codeHtml = codeHtml.split(LINE_BOUNDARY).join("\n");

        // ---- 语言标签(figcaption 标题优先) ----
        let label = "";
        if (showLang) {
          const caption = inner.match(
            /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/,
          );
          if (caption) {
            label = caption[1].replace(/<[^>]+>/g, "").trim();
          } else if (lang && lang !== "plain" && lang !== "plaintext") {
            label = lang.toUpperCase();
          }
        }

        return (
          '<div class="codecard" data-lang="' +
          (lang || "") +
          '">' +
          '<div class="codecard-header">' +
          (label ? '<span class="codecard-lang">' + label + "</span>" : '<span class="codecard-lang"></span>') +
          '<span class="codecard-notice" aria-live="polite">已复制</span>' +
          '<button class="codecard-copy" type="button" aria-label="复制代码">' +
          COPY_SVG +
          "</button>" +
          "</div>" +
          '<div class="codecard-body">' +
          (numsHtml
            ? '<div class="codecard-gutter" aria-hidden="true">' + numsHtml + "</div>"
            : "") +
          '<pre class="codecard-pre"><code class="language-' +
          (lang || "none") +
          '">' +
          codeHtml +
          "</code></pre>" +
          "</div>" +
          "</div>"
        );
      },
    );

    return data;
  },
  15,
);
