#!/usr/bin/env node
/**
 * check-cjk.js — 翻译体系与模板/脚本的静态体检
 *
 * 用法:
 *   npm run check:cjk              只报告(exit 0)
 *   npm run check:cjk -- --strict  有问题时 exit 1(接 CI 用)
 *
 * 检查三件事:
 *
 *  ① 裸中文扫描(layout/**\/*.pug、source/js/**\/*.js)
 *     界面文案必须来自 language/*.yml 词条 —— 模板用
 *       span&attributes(t('key'))= zh('key')
 *     JS 用 i18n.text('key')。硬编码中文会让译语言下露出中文,
 *     且改文案时字典静默失配。
 *     豁免:注释、console.*、含 data-i18n-* / ta( / i18n_attrs( / t( 的
 *     标记行、行尾 `// i18n:allow` 标记、显式列出的内容白名单。
 *
 *  ② pug 内嵌 <script> 块语法检查
 *     清理注释时最容易出的事故是"注释前缀丢失":一行中文说明丢了 //,
 *     整个 script 块语法错误、静默不执行(封面黑屏就是这么来的)。
 *     这里把每个 script. / script(type="module"). 块抽出来做语法解析,
 *     语法错误直接点名到行。
 *
 *  ③ pug 内嵌 script 块里的裸中文行
 *     同上原因:丢掉 // 的说明行会以"裸中文"形态留在代码里,
 *     既是语法错误源,也说明那行注释已经失效。
 *
 * 这是给未来维护者的安全网:改完注释/文案后跑一次,能挡住上面两类回归。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const THEME_ROOT = __dirname; // 本文件就在主题根(themes/magzine/)
const TARGETS = [
  path.join(THEME_ROOT, "layout"),
  path.join(THEME_ROOT, "source", "js"),
];

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
// 通道标记行:其中的中文是有意的"基准值"(值通道/属性通道/显式属性)
const MARKED = /data-i18n-|\bta\(|\bi18n_attrs\(|\bt\(/;
const THROUGH_I18N = /\bi18n\.(get|text|format)\(/;
// 确属"内容"的中文(pug 不支持行尾注释,按内容子串豁免)
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

const problems = { cjk: [], syntax: [], scriptCjk: [] };

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

function rel(fp) {
  return path.relative(THEME_ROOT, fp).replace(/\\/g, "/");
}

/* ---------- 注释剥离(JS 用) ---------- */
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
  return out.join("\n");
}

/* ---------- ① 裸中文扫描 ---------- */
function checkBareChinese() {
  TARGETS.forEach(function (dir) {
    walk(dir, []).forEach(function (fp) {
      const rawLines = fs.readFileSync(fp, "utf8").split("\n");
      const stripped = stripComments(rawLines.join("\n")).split("\n");
      const isPug = /\.pug$/.test(fp);
      stripped.forEach(function (line, idx) {
        const raw = rawLines[idx] || "";
        const trimmed = line.trim();
        if (!trimmed || !CJK.test(trimmed)) return;
        if (/i18n:allow/.test(raw)) return;
        if (/console\.\s*(log|warn|error|info)/.test(raw)) return;
        if (MARKED.test(raw)) return;
        if (THROUGH_I18N.test(raw)) return;
        if (
          CONTENT_ALLOW.some(function (s) {
            return raw.indexOf(s) !== -1;
          })
        )
          return;
        if (isPug && (trimmed.startsWith("//-") || trimmed.startsWith("//")))
          return;
        problems.cjk.push(rel(fp) + ":" + (idx + 1) + ": " + trimmed.slice(0, 110));
      });
    });
  });
}

/* ---------- ②③ pug 内嵌 script 块 ---------- */
function extractScriptBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*script(\([^)]*\))?\.\s*$/.test(l)) {
      const indent = l.length - l.trimStart().length;
      const body = [];
      let j = i + 1;
      while (j < lines.length) {
        const nxt = lines[j];
        if (nxt.trim() === "") {
          body.push([j + 1, ""]);
          j++;
          continue;
        }
        const cur = nxt.length - nxt.trimStart().length;
        if (cur <= indent) break;
        body.push([j + 1, nxt]);
        j++;
      }
      blocks.push({ startLine: i + 1, body: body });
      i = j;
    } else {
      i++;
    }
  }
  return blocks;
}

function dedentAndClean(body) {
  const nonempty = body.filter(function (b) {
    return b[1].trim();
  });
  if (!nonempty.length) return "";
  const base = Math.min.apply(
    null,
    nonempty.map(function (b) {
      return b[1].length - b[1].trimStart().length;
    }),
  );
  return body
    .map(function (b) {
      return b[1].trim() ? b[1].slice(base) : "";
    })
    .join("\n")
    .replace(/!\{(?:[^{}]|\{[^{}]*\})*\}/g, "null")
    .replace(/#\{(?:[^{}]|\{[^{}]*\})*\}/g, "x");
}

function checkPugScripts() {
  TARGETS.forEach(function (dir) {
    walk(dir, []).forEach(function (fp) {
      if (!/\.pug$/.test(fp)) return;
      const text = fs.readFileSync(fp, "utf8");
      extractScriptBlocks(text).forEach(function (block) {
        const code = dedentAndClean(block.body);
        if (!code.trim()) return;

        // ③ 块内裸中文(非注释、非字符串、非标记)
        block.body.forEach(function (item) {
          const lineno = item[0];
          const s = item[1].trim();
          if (!s) return;
          // 只看行内注释之前的部分:行尾注释里的中文是正常的
          const codePart = s.split("//")[0].trim();
          if (!codePart || !CJK.test(codePart)) return;
          if (s.startsWith("//") || s.startsWith("/*") || s.startsWith("*")) return;
          if (/^["'`]/.test(codePart) || /["'`][^"'`]*[\u4e00-\u9fff]/.test(codePart))
            return;
          if (MARKED.test(s) || THROUGH_I18N.test(s) || /i18n:allow/.test(s)) return;
          problems.scriptCjk.push(rel(fp) + ":" + lineno + ": " + s.slice(0, 110));
        });

        // ② 语法检查(静态 import/export 先剔除,vm 只认脚本语法)
        const forCheck = code
          .split("\n")
          .map(function (l) {
            return /^\s*(import\s|export\s)/.test(l) ? "" : l;
          })
          .join("\n");
        try {
          new vm.Script(forCheck, { filename: rel(fp) });
        } catch (e) {
          const at = parseInt((/:(\d+)/.exec(e.stack || "") || [0, 0])[1], 10);
          let fileLine = block.startLine;
          if (at > 0 && block.body[at - 1]) fileLine = block.body[at - 1][0];
          problems.syntax.push(
            rel(fp) + ":" + fileLine + ": script 块语法错误 → " + e.message,
          );
        }
      });
    });
  });
}

/* ---------- 汇总 ---------- */
checkBareChinese();
checkPugScripts();

const strict = process.argv.indexOf("--strict") !== -1;
let total = 0;

function report(title, list, hint) {
  if (!list.length) return;
  total += list.length;
  console.log("\n【" + title + "】" + list.length + " 处");
  list.forEach(function (p) {
    console.log("  " + p);
  });
  if (hint) console.log("  → " + hint);
}

report(
  "裸中文(界面文案须走 zh()/t() 词条)",
  problems.cjk,
  "改用 zh('键')/t('键') 词条;确属内容的在行尾加 // i18n:allow",
);
report(
  "pug 内嵌 script 块语法错误",
  problems.syntax,
  "多为注释前缀 // 丢失:补回前缀,或删掉失效的说明行",
);
report(
  "pug 内嵌 script 块中的裸中文行",
  problems.scriptCjk,
  "该行多半丢了 // 前缀,补回前缀或删除",
);

if (total === 0) {
  console.log("check:cjk ✓ 全部通过(裸中文 / script 块语法 / script 块中文)");
} else {
  console.log("\n合计 " + total + " 处待处理。");
}

process.exit(strict && total > 0 ? 1 : 0);
