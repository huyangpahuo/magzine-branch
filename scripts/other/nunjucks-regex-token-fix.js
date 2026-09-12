/**
 * Nunjucks 词法补丁:修复标签参数中 "r/" 序列被误判为正则字面量的问题
 *
 * 现象:
 *   {% video https://www.facebook.com/share/r/18RshrE6Ks/ %} 传给标签的
 *   URL 会变成 "https://www.facebook.com/share/[object Object]"。
 *
 * 原因:
 *   nunjucks 词法分析器 (nunjucks/src/lexer.js) 会把参数文本里 "r/" 开头
 *   的序列识别为正则字面量 (如 r/pattern/flags),该 token 的 value 是
 *   {body, flags} 对象;而 hexo 的标签参数解析器 (hexo/dist/extend/tag.js
 *   的 _parseArgs) 逐 token 做字符串拼接 (argitem += token.value),对象被
 *   隐式转成 "[object Object]",原文 r/18RshrE6Ks/ 丢失。
 *   凡是参数中含 "r/" 的标签都会中招(如 Facebook 的 /share/r/ 短链),
 *   与具体平台无关。
 *
 * 修复:
 *   包装 lexer.lex 返回的 token 流,把 TOKEN_REGEX token 的对象 value
 *   还原为等价的源码文本 "r/" + body + "/" + flags。拼接后与用户输入
 *   完全一致,且不影响真正的正则字面量写法。
 *
 *   hexo 依赖自己解析路径下的 nunjucks,顶层与 hexo 内嵌两处都要打补丁。
 */
'use strict';
const path = require('path');

function patchLexerModule(mod) {
  if (!mod || mod.__magzineRegexTokenFix) return;
  const TOKEN_REGEX = mod.TOKEN_REGEX || 'regex';
  const origLex = mod.lex;
  if (typeof origLex !== 'function') return;
  mod.__magzineRegexTokenFix = true;
  mod.lex = function (str, opts) {
    const tokens = origLex.call(this, str, opts);
    if (!tokens || typeof tokens.nextToken !== 'function') return tokens;
    const origNextToken = tokens.nextToken.bind(tokens);
    tokens.nextToken = function (...args) {
      const tok = origNextToken(...args);
      if (tok && tok.type === TOKEN_REGEX && tok.value && typeof tok.value === 'object') {
        tok.value = 'r/' + (tok.value.body || '') + '/' + (tok.value.flags || '');
      }
      return tok;
    };
    return tokens;
  };
}

const candidates = new Set();
try { candidates.add(require.resolve('nunjucks/src/lexer')); } catch (e) { /* 顶层未安装 nunjucks */ }
try {
  const hexoPkgDir = path.dirname(require.resolve('hexo/package.json'));
  candidates.add(require.resolve('nunjucks/src/lexer', { paths: [hexoPkgDir] }));
} catch (e) { /* hexo 未安装的异常场景 */ }
for (const p of candidates) {
  try { patchLexerModule(require(p)); } catch (e) { /* 补丁失败不应中断构建 */ }
}
