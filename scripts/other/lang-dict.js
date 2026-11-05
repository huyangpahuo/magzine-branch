/**
 * 语言字典生成器(多语言,按词条 ID 输出)
 *
 * themes/magzine/language/ 目录约定:
 *   - zh.yml:基准字典(键 = 稳定词条 ID,值 = 中文文案,页面渲染的唯一文案源)
 *   - <lang>.yml:其余语言(如 en.yml / ja.yml / ru.yml,同键,值 = 对应语言译文)
 *   - 每份文件可选的顶层 _meta(供语言按钮展示,不参与字典):
 *       _meta:
 *         flag: "🇷🇺"
 *         label: Русский
 *
 * 构建期按 key 拉链,生成 public/js/core/lang-dict.js:
 *   window.__MAGZINE_LANG_DICTS__ = { zh: {...}, en: {词条ID: English}, ... }
 *   window.__MAGZINE_LANG_META__  = { ru: { flag: "🇷🇺", label: "Русский" } }
 *   window.__MAGZINE_LANG_VALUE_INDEX__ = { 中文原文: 词条ID }
 *
 * 运行期(lang-switch.js)只按词条 ID 换文案(data-i18n-key 通道),
 * 不做任何 DOM 全页扫描;VALUE_INDEX 仅服务于显式标记的"配置中文"
 * (菜单项 / 打字文案等,模板写 data-i18n-value 或 JS 调 i18n.get(中文)),
 * 匹配不到就保留原文,正文永远不会被误翻。
 *
 * 新增一种语言 = 复制一份 yml 翻好放进来,重新 hexo generate 即可,无需改 JS。
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const LANG_DIR = path.join(hexo.theme_dir, "language");
const META_KEY = "_meta";

function loadLangFile(name) {
  const fp = path.join(LANG_DIR, name);
  try {
    return yaml.load(fs.readFileSync(fp, "utf8")) || {};
  } catch (e) {
    hexo.log.warn("language/" + name + " 读取失败: " + e.message);
    return {};
  }
}

// yml 是分节的嵌套结构(site.owner_name),拍平成 "site.owner_name" -> 文案;
// 顶层 _meta 是语言元信息(flag/label),不参与字典
function flatten(obj, prefix, out) {
  Object.keys(obj).forEach(function (k) {
    if (!prefix && k === META_KEY) return;
    const key = prefix ? prefix + "." + k : k;
    const val = obj[k];
    if (val !== null && typeof val === "object") {
      flatten(val, key, out);
    } else if (typeof val === "string") {
      out[key] = val;
    }
  });
  return out;
}

// 读取 _meta:缺省时留空,由运行时回退(语言代码作名称 + 🌐 图标)
function readMeta(lang, raw) {
  const m =
    raw && typeof raw[META_KEY] === "object" && raw[META_KEY] ? raw[META_KEY] : {};
  const meta = {};
  if (typeof m.flag === "string" && m.flag) meta.flag = m.flag;
  if (typeof m.label === "string" && m.label) meta.label = m.label;
  if (!meta.label) meta.label = lang;
  return meta;
}

hexo.extend.generator.register("lang-dict", function () {
  const zhRaw = loadLangFile("zh.yml");
  const zh = flatten(zhRaw, "", {});
  const meta = {};
  meta.zh = readMeta("zh", zhRaw);

  const dicts = { zh: zh };

  // 中文值 → 词条ID 索引:只用于显式标记的配置中文(data-i18n-value /
  // i18n.get(中文))。同中文文案对应多条词条时取先遇到的键并警告,
  // 因此各词条的中文值尽量保持唯一。
  const valueIndex = {};

  // 除基准 zh.yml 外的每个 yml 都是一种目标语言
  const langFiles = fs.existsSync(LANG_DIR)
    ? fs.readdirSync(LANG_DIR).filter(function (f) {
        return /\.ya?ml$/.test(f) && f !== "zh.yml";
      })
    : [];

  langFiles.forEach(function (f) {
    const lang = path.basename(f, path.extname(f)); // en / ja / ru / ...
    const raw = loadLangFile(f);
    meta[lang] = readMeta(lang, raw);
    const dict = flatten(raw, "", {});
    const missing = [];
    Object.keys(zh).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(dict, key)) {
        missing.push(key);
      }
    });
    if (missing.length) {
      hexo.log.warn(
        "lang-dict: [" + lang + "] 以下键缺失,运行期回退英文/中文 → " + missing.join(", "),
      );
    }
    dicts[lang] = dict;
  });

  // 索引在所有语言文件加载完后统一构建,保证告警包含全部冲突
  Object.keys(zh).forEach(function (key) {
    const zhVal = zh[key];
    if (valueIndex[zhVal]) {
      hexo.log.warn(
        "lang-dict: 中文文案重复 → \"" + zhVal + "\" 同时是 " +
          valueIndex[zhVal] + " 与 " + key + "(配置中文按前者翻译)",
      );
      return;
    }
    valueIndex[zhVal] = key;
  });

  const data =
    "/* 由 themes/magzine/language/*.yml 生成(hexo generate),请勿手改 */\n" +
    "window.__MAGZINE_LANG_DICTS__ = " +
    JSON.stringify(dicts).replace(/</g, "\\u003c") +
    ";\n" +
    "window.__MAGZINE_LANG_META__ = " +
    JSON.stringify(meta).replace(/</g, "\\u003c") +
    ";\n" +
    "window.__MAGZINE_LANG_VALUE_INDEX__ = " +
    JSON.stringify(valueIndex).replace(/</g, "\\u003c") +
    ";\n";

  return { path: "js/core/lang-dict.js", data: data };
});
