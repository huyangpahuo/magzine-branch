#!/usr/bin/env node
/**
 * CJK-lint:扫描主题模板与脚本里的"裸中文"
 *
 * 翻译契约:界面文案必须来自 language/*.yml 词条 —— 模板用
 *   span&attributes(t('key'))= zh('key')
 * JS 用 i18n.text('key') / i18n.get(配置中文)。模板与 JS 里不允许
 * 再出现硬编码的中文界面文案(注释除外)。
 *
 * 本脚本报告疑似漏网的裸中文,便于在迁移/新增时查漏:
 *   node themes/magzine/scripts/check-cjk.js
 *   npm run check:cjk
 *
 * 规则:
 *   - 注释不计:pug 的 //- 行与内联 JS/CSS 注释(//-、//、/* *\/)都剥离;
 *   - 通道标记行不计:行内出现 data-i18n-*、ta('、i18n_attrs(、t(' 的,
 *     其中的中文是"有意的基准值"(值通道/属性通道的中文原文);
 *   - console.* 开发日志不计;
 *   - 个别确属"内容"的中文(友链模板代码块、服务端日期格式等),
 *     在行尾加 `i18n:allow` 豁免。
 * 只报告不拦截(exit 0),数量应为 0 或只有已知的豁免项。
 */
const fs = require("fs");
const path = require("path");

const THEME_ROOT = path.join(__dirname, "..");
const TARGETS = [
  path.join(THEME_ROOT, "layout"),
  path.join(THEME_ROOT, "source", "js"),
];

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
// 通道标记行:其中的中文是有意的"基准值"(值通道/属性通道/显式属性)
const MARKED = /data-i18n-|\bta\(|\bi18n_attrs\(|\bt\(/;
// 经 i18n 取词的行(含兜底回退文本)不计
const THROUGH_I18N = /\bi18n\.(get|text|format)\(/;
// 确属"内容"的中文(pug 不支持行尾注释,按内容子串豁免):
// 服务端日期格式(运行期 translateDates 重写)、友链复制模板代码块、
// 配置回退值(经 i18n.get 值通道翻译)
const CONTENT_ALLOW = [
  "M月D日",
  "- name: 胡杨怕火",
  "description: 传递笑容魔法",
  "theme.hero && theme.hero.typing_text",
  'alt="图片 "',
  "theme.ai_summary.buttons",
  "theme.ai_summary.ai_name",
  "theme.ai_summary.ai_introduce",
  "theme.cover.title ||",
  "theme.cover.author ||",
  "theme.cover.btn_text ||",
];

function walk(dir, out) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  entries.forEach(function (e) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, out);
    else if (/\.pug$/.test(e.name) || /\.js$/.test(e.name)) out.push(fp);
  });
  return out;
}

// 剥离 // 与递归的 /* */ 注释(JS 原样,pug 的 script/style 块同样适用)
function stripComments(src) {
  let out = [];
  let inBlock = false;
  src.split("\n").forEach(function (line) {
    let l = line;
    if (inBlock) {
      const end = l.indexOf("*/");
      if (end === -1) {
        out.push("");
        return;
      }
      l = l.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const start = l.indexOf("/*");
      if (start === -1) break;
      const end = l.indexOf("*/", start + 2);
      if (end === -1) {
        inBlock = true;
        l = l.slice(0, start);
        break;
      }
      l = l.slice(0, start) + l.slice(end + 2);
    }
    const lineComment = l.indexOf("//");
    if (lineComment !== -1) l = l.slice(0, lineComment);
    out.push(l);
  });
  return out;
}

function check() {
  const problems = [];
  TARGETS.forEach(function (dir) {
    walk(dir, []).forEach(function (fp) {
      const rel = path.relative(THEME_ROOT, fp).replace(/\\/g, "/");
      const rawLines = fs.readFileSync(fp, "utf8").split("\n");
      const stripped = stripComments(rawLines.join("\n"));
      const isPug = /\.pug$/.test(fp);
      stripped.forEach(function (line, idx) {
        const raw = rawLines[idx] || "";
        const trimmed = line.trim();
        // 注释剥离后没有正文,但豁免/通道标记要看原始行(标记本身在注释里)
        if (!trimmed || !CJK.test(trimmed)) return;
        if (/i18n:allow/.test(raw)) return;
        if (/console\.\s*(log|warn|error|info)/.test(raw)) return;
        if (MARKED.test(raw)) return;
        if (THROUGH_I18N.test(raw)) return;
        if (CONTENT_ALLOW.some(function (s) { return raw.indexOf(s) !== -1; })) return;
        if (isPug && (trimmed.startsWith("//-") || trimmed.startsWith("//"))) return;
        problems.push(rel + ":" + (idx + 1) + ": " + trimmed.slice(0, 120));
      });
    });
  });

  if (problems.length === 0) {
    console.log("check:cjk ✓ 模板与脚本无裸中文(除注释与已标记项)");
  } else {
    console.log("check:cjk 发现 " + problems.length + " 处疑似硬编码中文:");
    problems.forEach(function (p) {
      console.log("  " + p);
    });
    console.log(
      "\n处理方式:改用 zh('键')/t('键') 词条;确属内容的在行尾加 i18n:allow 豁免",
    );
  }
  return problems.length;
}

check();
module.exports = { check };
