/**
 * ============================================
 * Hexo 图片压缩 / WebP 转换(路由流版)
 *
 * ★ 为什么旧版必须跑两次 hexo generate:
 *   旧版在 after_generate 时扫描 public 文件夹,但 hexo 是先触发
 *   after_generate、之后才把文件写进 public——第一次构建时 public
 *   还是空的,所以必须再跑一次才有东西可压。
 *   本版改为"包装路由":hexo 的一切输出(写盘、hexo server 本地预览)
 *   都经过路由流,在流上即时转换——一次 hexo generate 即生效,
 *   本地预览看到的也是压缩后的图片,CI/工作流同样自动生效。
 *
 * ★ 主题可分享:本脚本完全位于主题内,任何使用 magzine 主题的 Hexo
 *   站点只要 npm install sharp 并在主题配置里开启即可,与部署方式无关。
 *
 * ★ 配置(主题 _config.yml):
 *   compress_images:
 *     enable: true
 *     mode: "webp"        # "keep"=保留原格式仅压缩 | "webp"=png/jpg/jpeg 转为 webp
 *     convert: [".png", ".jpg", ".jpeg"]  # webp 模式下参与转换的扩展名
 *     max_width: 1920     # 宽度超过此值等比缩小;0 = 不限制
 *     ignore: []          # 额外忽略的扩展名,如 ['.gif']
 *     min_size: 10240     # 小于此字节数的图片不处理
 *     quality: { jpeg: 80, png: 80, webp: 75, avif: 60, gif: 80 }
 *
 * ★ webp 模式下,所有文本产物(html/css/js/json/xml/txt)里对这些图片
 *   的引用会自动改写为 .webp(含 URL 编码路径),文章与配置无需改动。
 *   建议 webp 模式配合 hexo clean 使用,避免 public 残留旧的 .png 文件。
 *
 * ★ 未安装 sharp 时自动跳过,不影响构建。
 */

const path = require("path");

// === [Safe Load Sharp] ===
let sharp;
try {
  sharp = require("sharp");
} catch (e) {
  sharp = null;
}

const IMG_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];
const TEXT_EXTS = [".html", ".htm", ".css", ".js", ".json", ".xml", ".txt"];

// 已包装的路由集合;route.set 被外部重新赋值时清除标记,
// 防止 server 监听模式反复构建时重复压缩(有代次损失)
const wrappedPaths = new Set();

// ★ 注意:Hexo 主题脚本被包裹为 (async function(exports, require, module,
//   __filename, __dirname, hexo){...})() 执行,hexo 以参数形式注入,
//   必须在顶层直接注册,不能写成 module.exports 导出(不会被调用)。
hexo.extend.filter.register("after_generate", function () {
    const cfg = buildConfig(this);

    if (!cfg.enable) return;
    if (!sharp) {
      this.log.warn(
        "🔔 [Image Compressor] 未安装 sharp,图片优化已跳过。请执行 npm install sharp 启用。",
      );
      return;
    }

    const route = this.route;
    const log = this.log;

    // 只打一次补丁:外部 set 路由时清除"已包装"标记
    if (!route.__compressPatched) {
      const origSet = route.set.bind(route);
      route.set = function (p, data) {
        wrappedPaths.delete(route.format(p));
        return origSet(p, data);
      };
      route.__compressPatched = true;
    }

    const allRoutes = route.list();
    const isIgnored = (ext) => cfg.ignore.includes(ext);
    // ★ protect:这些路径前缀下的图片不转换也不压缩。
    //   适用于 JS 运行时动态拼接路径的资源(如桌宠精灵图 /cursors/ 光标帧),
    //   它们的文件名在代码里拼接,构建期无法可靠改写引用。
    const isProtected = (routePath) =>
      cfg.protect.some((p) => routePath.startsWith(p.replace(/^\/+/, "")));

    /* ---------- 阶段一:确定 webp 改名映射(先声明后包装,防碰撞) ---------- */
    const renamePairs = []; // { from, to }
    if (cfg.mode === "webp") {
      for (const routePath of allRoutes) {
        const ext = path.extname(routePath).toLowerCase();
        if (!cfg.convert.includes(ext) || isIgnored(ext)) continue;
        if (isProtected(routePath)) continue;
        const to = routePath.slice(0, routePath.length - ext.length) + ".webp";
        // 目标路径已被占用(同名 webp 已存在)则不转换,避免覆盖
        if (allRoutes.includes(to)) continue;
        if (renamePairs.some((p) => p.to === to)) continue;
        renamePairs.push({ from: routePath, to });
      }
    }
    const renamedFrom = new Set(renamePairs.map((p) => p.from));

    /* ---------- 阶段二:包装图片路由(写盘/预览时即时转换) ----------
       ★ 转换结果缓存:hexo server 的每次请求都会重新拉路由流,
         不缓存的话每刷新一次就把全部图片重新压缩一遍——server 进程
         CPU 打满、内存暴涨、页面加载超时(模态 iframe 空白的根因)。
         hexo generate 每个路由只写一次,缓存同样无害。 */
    const transformCache = new Map(); // path -> Buffer
    const TRANSFORM_CACHE_MAX_BYTES = 400 * 1024 * 1024;
    let transformCacheBytes = 0;

    function cachedTransform(routePath, ext, original, toWebp) {
      return () => {
        const hit = transformCache.get(routePath);
        if (hit) return Promise.resolve(hit);
        return getOriginalContent(original)
          .then((buf) => processImage(buf, ext, cfg, toWebp))
          .then((out) => {
            if (out && out.length <= TRANSFORM_CACHE_MAX_BYTES) {
              transformCache.set(routePath, out);
              transformCacheBytes += out.length;
              // 超出上限时按插入顺序淘汰(近似 FIFO)
              while (
                transformCacheBytes > TRANSFORM_CACHE_MAX_BYTES &&
                transformCache.size > 1
              ) {
                const firstKey = transformCache.keys().next().value;
                const firstVal = transformCache.get(firstKey);
                transformCache.delete(firstKey);
                transformCacheBytes -= firstVal.length;
              }
            }
            return out;
          })
          .catch((err) => {
            log.warn(
              `[Image Compressor] ${routePath} 处理失败,回退原图: ${err.message}`,
            );
            return getOriginalContent(original);
          });
      };
    }

    let imageWrapped = 0;
    for (const routePath of allRoutes) {
      const ext = path.extname(routePath).toLowerCase();
      if (!IMG_EXTS.includes(ext) || isIgnored(ext)) continue;
      if (isProtected(routePath)) continue;
      if (wrappedPaths.has(routePath)) continue;

      // webp 模式下已是 webp 的不再重复压缩(避免二次有损)
      if (cfg.mode === "webp" && ext === ".webp") continue;

      const original = route.routes[routePath];
      if (!original) continue;
      const toWebp = renamedFrom.has(routePath);

      if (toWebp) {
        // 保存原始数据供新路由使用,再移除旧路由(移除后 routes[path] 为 null)
        renamePairs.find((p) => p.from === routePath).original = original;
        route.remove(routePath);
      } else {
        setRoute(route, routePath, {
          data: cachedTransform(routePath, ext, original, false),
          modified: original.modified,
        });
        wrappedPaths.add(routePath);
      }
      imageWrapped++;
    }

    // webp 新路由(改名的图片)
    for (const pair of renamePairs) {
      const original = pair.original;
      if (!original) continue;
      const ext = path.extname(pair.from).toLowerCase();
      setRoute(route, pair.to, {
        data: cachedTransform(pair.from, ext, original, true),
        modified: original.modified,
      });
      wrappedPaths.add(pair.to);
    }

    /* ---------- 阶段三:包装文本路由,自动改写引用 ---------- */
    let textWrapped = 0;
    if (renamePairs.length > 0) {
      const variants = buildReplaceVariants(renamePairs);

      for (const routePath of route.list()) {
        const ext = path.extname(routePath).toLowerCase();
        if (!TEXT_EXTS.includes(ext)) continue;
        if (wrappedPaths.has(routePath)) continue;

        const original = route.routes[routePath];
        if (!original) continue;

        setRoute(route, routePath, {
          data: () =>
            getOriginalContent(original)
              .then((buf) => {
                // ★ 注意必须是 let:循环中会对 text 重新赋值
                let text = buf.toString("utf8");
                let changed = false;
                for (const v of variants) {
                  v.re.lastIndex = 0;
                  if (v.re.test(text)) {
                    text = text.replace(v.re, v.to);
                    changed = true;
                  }
                  v.re.lastIndex = 0;
                }
                return changed ? Buffer.from(text, "utf8") : buf;
              })
              .catch(() => getOriginalContent(original)),
          modified: original.modified,
        });
        wrappedPaths.add(routePath);
        textWrapped++;
      }
    }

    if (renamePairs.length > 0) {
      log.info(
        `🖼 [Image Compressor] webp 模式:${renamePairs.length} 张图片输出时转为 webp,文本引用自动改写(涉及 ${textWrapped} 个文本路由)`,
      );
    } else {
      log.info(`🖼 [Image Compressor] keep 模式:${imageWrapped} 张图片输出时原格式压缩`);
    }
});

/* ============ 写路由(经过补丁版 set,写入后由调用方补"已包装"标记) ============ */
function setRoute(route, routePath, dataObj) {
  route.set(routePath, dataObj);
}

/* ============ 取原始内容:路由 data 可能是函数/Buffer/字符串/对象 ============ */
function getOriginalContent(original) {
  const data = typeof original.data === "function" ? original.data() : original.data;
  return Promise.resolve(data).then(rawToBuffer);
}

function rawToBuffer(raw) {
  if (raw instanceof Buffer) return raw;
  if (typeof raw === "string") return Buffer.from(raw, "utf8");
  if (typeof raw === "object" && raw && typeof raw.on === "function") {
    // Stream
    return new Promise((resolve, reject) => {
      const chunks = [];
      raw.on("data", (c) => chunks.push(c));
      raw.on("end", () => resolve(Buffer.concat(chunks)));
      raw.on("error", reject);
    });
  }
  if (typeof raw === "object" && raw !== null) {
    return Buffer.from(JSON.stringify(raw), "utf8");
  }
  return Buffer.from(String(raw), "utf8");
}

/* ============ 配置读取 ============ */
function buildConfig(ctx) {
  const user =
    (ctx.theme && ctx.theme.config && ctx.theme.config.compress_images) || {};
  return {
    enable: user.enable === true,
    mode: user.mode === "keep" ? "keep" : "webp",
    convert: (user.convert || [".png", ".jpg", ".jpeg"]).map((e) =>
      e.toLowerCase(),
    ),
    protect: (user.protect || ["/images/pet/", "/cursors/"]).map((p) => p),
    max_width: user.max_width === 0 ? 0 : user.max_width || 1920,
    ignore: (user.ignore || []).map((e) => e.toLowerCase()),
    min_size: user.min_size || 10240,
    quality: Object.assign(
      { jpeg: 80, png: 80, webp: 75, avif: 60, gif: 80 },
      user.quality || {},
    ),
  };
}

/* ============ 图片处理:压缩或转 webp(只有更小才采用) ============ */
async function processImage(buf, ext, cfg, toWebp) {
  if (!buf || buf.length <= cfg.min_size) return buf;

  let img = sharp(buf, { animated: true, limitInputPixels: false });
  if (cfg.max_width > 0 && ext !== ".gif") {
    img = img.resize({ width: cfg.max_width, withoutEnlargement: true });
  }

  let out;
  if (toWebp) {
    out = await img.webp({ quality: cfg.quality.webp }).toBuffer();
  } else if (ext === ".jpg" || ext === ".jpeg") {
    out = await img.jpeg({ quality: cfg.quality.jpeg, mozjpeg: true }).toBuffer();
  } else if (ext === ".png") {
    out = await img
      .png({ quality: cfg.quality.png, compressionLevel: 9, palette: true })
      .toBuffer();
  } else if (ext === ".avif") {
    out = await img.avif({ quality: cfg.quality.avif }).toBuffer();
  } else if (ext === ".gif") {
    out = await img.gif({ colours: 128 }).toBuffer();
  } else {
    return buf;
  }

  return out && out.length < buf.length ? out : buf;
}

/* ============ 引用替换变体:裸路径 + 两种 URI 编码,带扩展名边界 ============ */
function buildReplaceVariants(renamePairs) {
  const variants = [];
  const seen = new Set();
  for (const pair of renamePairs) {
    const cands = [
      [pair.from, pair.to],
      [encodeURI(pair.from), encodeURI(pair.to)],
      [encodeURIComponent(pair.from), encodeURIComponent(pair.to)],
    ];
    for (const [from, to] of cands) {
      if (seen.has(from)) continue;
      seen.add(from);
      variants.push({
        re: new RegExp(escapeRegExp(from) + "(?![-.\\w])", "g"),
        to,
      });
    }
  }
  return variants;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
