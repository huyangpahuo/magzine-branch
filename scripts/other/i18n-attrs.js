/**
 * 模板侧 i18n 助手(Pug helper)
 *
 * 本主题的翻译契约(详见 docs/06-国际化架构.md):
 *   - 页面始终由 Hexo 以中文渲染,zh.yml 是唯一文案源;
 *   - 模板里凡是需要翻译的"界面词条",一律写成
 *       span&attributes(t('section.key'))= zh('section.key')
 *     渲染出 data-i18n-key 属性 + 中文文本,运行期 lang-switch.js
 *     只认属性、按 key 换文案,不做任何 DOM 全页扫描;
 *   - 需要翻译"属性"(placeholder/title/aria-label/data-title/alt)时:
 *       input&attributes(ta('placeholder', 'search.placeholder'))
 *     渲染出 data-i18n-key-placeholder 属性;
 *   - 来自 _config.yml / 数据文件的中文(菜单项、打字文案等"会改的内容"),
 *     用 data-i18n-value / i18n_attrs() 显式标记,运行期经"中文值 → key"
 *     索引换取译文,匹配不到就原样保留中文(绝不误伤别处文本)。
 *
 * i18n_attrs(obj, field[, attr]) 保留:数据文件逐条显式译文(如
 * about.yml 卡片的 title_en/title_ja),输出 data-i18n-<lang> 属性对。
 * 新增一种语言 = language/ 下多一个 yml,这里自动跟随,无需改代码。
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const LANG_DIR = path.join(hexo.theme_dir, "language");

// ---- zh.yml 加载(拍平成 "a.b" -> 中文文案) ----
let zhCache = null;
function zhDict() {
  if (zhCache) return zhCache;
  zhCache = {};
  try {
    const raw = yaml.load(fs.readFileSync(path.join(LANG_DIR, "zh.yml"), "utf8")) || {};
    (function flatten(obj, prefix) {
      Object.keys(obj).forEach(function (k) {
        if (!prefix && k === "_meta") return;
        const key = prefix ? prefix + "." + k : k;
        const val = obj[k];
        if (val !== null && typeof val === "object") flatten(val, key);
        else if (typeof val === "string") zhCache[key] = val;
      });
    })(raw, "");
  } catch (e) {
    hexo.log.warn("i18n-attrs: language/zh.yml 读取失败: " + e.message);
  }
  return zhCache;
}

// 语言列表缓存:新增/删除 language/*.yml 会改变目录 mtime,自动失效
let cache = { mtime: -1, langs: null };

function targetLangs() {
  const dir = LANG_DIR;
  let mtime = 0;
  try {
    mtime = fs.statSync(dir).mtimeMs;
  } catch (e) {
    // 目录不存在:退化为仅英文
    return ["en"];
  }
  if (cache.langs && cache.mtime === mtime) return cache.langs;

  let langs = [];
  try {
    langs = fs
      .readdirSync(dir)
      .filter(function (f) {
        return /\.ya?ml$/.test(f) && f !== "zh.yml";
      })
      .map(function (f) {
        return path.basename(f, path.extname(f));
      });
  } catch (e) {
    langs = ["en"];
  }
  if (!langs.length) langs = ["en"];
  cache = { mtime: mtime, langs: langs };
  return langs;
}

/**
 * 中文取词:zh('nav.home') → zh.yml 里的中文文案。
 * zh.yml 是页面文案的唯一来源;键不存在时警告并回显键名,
 * 构建日志一眼可见(配合 npm run check:cjk 查漏)。
 */
hexo.extend.helper.register("zh", function (key) {
  const val = zhDict()[key];
  if (val === undefined) {
    hexo.log.warn("i18n-attrs: zh.yml 缺少词条 → " + key);
    return key;
  }
  return val;
});

/**
 * 元素文本词条属性:t('toc.title') → { 'data-i18n-key': 'toc.title' }
 * 用法:span.toc-title&attributes(t('toc.title'))= zh('toc.title')
 */
hexo.extend.helper.register("t", function (key) {
  return { "data-i18n-key": key };
});

/**
 * 元素属性词条:ta('placeholder', 'search.placeholder')
 * → { 'data-i18n-key-placeholder': 'search.placeholder' }
 */
hexo.extend.helper.register("ta", function (attr, key) {
  const out = {};
  out["data-i18n-key-" + attr] = key;
  return out;
});

/**
 * 数据项显式译文属性助手 i18n_attrs(obj, field[, attr])
 *
 *   h3.card-title(data-i18n-zh=card.title)&attributes(i18n_attrs(card, 'title'))
 *
 * 若 language/ 下有 en.yml / ja.yml,数据里有 title_en / title_ja 字段,就会输出:
 *   data-i18n-en="Escape the Backrooms" data-i18n-ja="バックルームからの脱出"
 * 数据里没写的那一路属性直接省略(不输出空属性,避免污染 HTML)。
 *
 * 属性版(用于 alt/title 等):
 *   img(src=... alt=post.title)&attributes(i18n_attrs(post, 'title', 'alt'))
 *   → data-i18n-alt-en="..." data-i18n-alt-ja="..."
 *
 * 因此:**新增一种翻译 = 在对应数据项里加一个 xxx_<lang> 字段**,
 * 模板、运行时都不用动。词条会增删的内容(关于页资料/技能标签、
 * 番剧、友链)都用这个通道,翻译跟着数据条目走。
 */
hexo.extend.helper.register("i18n_attrs", function (obj, field, attr) {
  const out = {};
  if (!obj || !field) return out;
  targetLangs().forEach(function (lang) {
    const val = obj[field + "_" + lang];
    if (val === undefined || val === null || val === "") return;
    out[attr ? "data-i18n-" + attr + "-" + lang : "data-i18n-" + lang] = val;
  });
  return out;
});
