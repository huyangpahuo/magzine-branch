/**
 * 显式译文属性助手 i18n_attrs(obj, field[, attr])
 *
 * 模板里写 data-i18n-en 是"硬编码一种语言",新增语言要改所有模板。
 * 本助手改为按 language/ 目录里实际存在的语言自动展开:
 *
 *   h3.card-title(data-i18n-zh=card.title)&attributes(i18n_attrs(card, 'title'))
 *
 * 若 language/ 下有 en.yml / ja.yml,就会输出:
 *   data-i18n-zh="逃离后室" data-i18n-en="Escape the Backrooms" data-i18n-ja="バックルームからの脱出"
 * 数据里没写的那一路属性直接省略(不输出空属性,避免污染 HTML)。
 *
 * 属性版(用于 alt/title 等):
 *   img(src=... alt=post.title)&attributes(i18n_attrs(post, 'title', 'alt'))
 *   → data-i18n-alt-en="..." data-i18n-alt-ja="..."
 *
 * 因此:**新增一种翻译 = 在对应数据文件里加一个 xxx_<lang> 字段**,
 * 模板、运行时都不用动。
 */
const fs = require("fs");
const path = require("path");

// 语言列表缓存:新增/删除 language/*.yml 会改变目录 mtime,自动失效
let cache = { mtime: -1, langs: null };

function targetLangs() {
  const dir = path.join(hexo.theme_dir, "language");
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
