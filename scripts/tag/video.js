/**
 * Universal video embed tag for Hexo
 * Usage:
 *   {% video URL %}
 *   {% video TITLE URL %}  — URL 前的文字自动忽略,只取链接
 *
 * referrerPolicy 按平台区分:
 *   - Bilibili : no-referrer                     (空 Referer 绕过手机端外链拦截)
 *   - 其余平台 : strict-origin-when-cross-origin  (YouTube 2025-07-09 起强制要求 Referer)
 *
 * 短链说明:
 *   - b23.tv、hy.fan : 构建时【直连】跟随 HTTP 跳转自动解析,失败时输出明确的错误提示。
 *   - Facebook 分享短链(share/r/、fb.watch)不再支持:解析依赖构建机访问 Facebook,
 *     环境不可控,遇到时直接输出"请使用完整链接"的提示。仅支持完整视频/Reel 链接。
 *
 * 自动播放:
 *   - 所有平台默认不自动播放;虎牙(直播/录像)输出点击加载的占位卡,
 *     由前端脚本(js/video-embed.js)在点击时才插入 iframe,彻底杜绝自动播放。
 *   - 占位卡附带"单播放"效果:点开任一视频时,前端脚本会把其它已展开的
 *     占位卡收起(其余平台无跨域控制接口,不做强制暂停)。
 *
 * 样式:
 *   - 全部使用 16:9 响应式容器,圆角 + 阴影,居中。
 *   - TikTok / Instagram / Facebook 使用官方富卡片嵌入,高度由平台脚本自适应。
 *   - YouTube 短视频(shorts)链接按普通视频嵌入(16:9),不会变形。
 */

'use strict';
const https = require('https');
const http  = require('http');

/* 构建期请求使用真实浏览器 UA,部分平台对爬虫 UA 会拒绝响应 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* ─── 工具函数 ─────────────────────────────────────────────────────────── */

/** 单次 GET 请求(直连)。返回 { statusCode, headers, res };失败返回 null。 */
function httpGet(urlStr, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(urlStr.startsWith('//') ? 'https:' + urlStr : urlStr);
    } catch (e) { resolve(null); return; }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') { resolve(null); return; }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(parsed.href, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: timeoutMs,
    }, (res) => resolve({ statusCode: res.statusCode, headers: res.headers, res }));
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/** 读取响应体(最多 maxBytes 字节,超出即截断)。 */
function readBody(res, maxBytes = 512 * 1024) {
  return new Promise((resolve) => {
    let out = '';
    let finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(out); } };
    res.setEncoding('latin1');
    res.on('data', (chunk) => {
      if (finished) return;
      out += chunk;
      if (out.length >= maxBytes) { finished = true; res.destroy(); resolve(out); }
    });
    res.on('end', finish);
    res.on('error', finish);
  });
}

/**
 * 依次请求并跟随重定向(直连,仅用于国内短链 b23.tv / hy.fan)。
 * 返回 { urls: 沿途全部 URL(含最终地址), body: 最终响应体前 512 KB };
 * 网络错误、超时或跳转超限时返回 null。
 */
async function fetchFollowRedirects(urlStr, maxHops = 6) {
  const urls = [];
  let current = urlStr.startsWith('//') ? 'https:' + urlStr : urlStr;
  for (let hop = 0; hop <= maxHops; hop++) {
    const r = await httpGet(current);
    if (!r) return null;
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
      urls.push(current);
      r.res.resume();
      try { current = new URL(r.headers.location, current).href; }
      catch (e) { return null; }
      continue;
    }
    urls.push(current);
    const body = await readBody(r.res);
    return { urls, body };
  }
  return null;
}

/**
 * 跟随 HTTP/HTTPS 重定向,返回最终 URL。
 * 超时(8 s)、网络错误或超过跳转次数时返回 null。
 */
function resolveRedirect(urlStr, maxHops = 6) {
  return fetchFollowRedirects(urlStr, maxHops).then(
    (r) => (r && r.urls.length ? r.urls[r.urls.length - 1] : null)
  );
}

/**
 * 从 Hexo tag 的 args 数组里提取 URL。
 * 支持 "标题 URL" 格式(如微信/微博复制的带标题链接):
 *   args[0] 可能是标题文字,URL 在 args[1] 或之后。
 */
function extractUrl(args) {
  for (const a of args) {
    if (a && /^https?:\/\/|^\/\//.test(String(a))) return String(a);
  }
  // 兜底:扫描拼接字符串中的第一个 URL
  const m = args.join(' ').match(/https?:\/\/\S+|\/\/\S+/);
  return m ? m[0] : (args[0] ? String(args[0]) : '');
}

/* ─── 错误/提示 HTML ───────────────────────────────────────────────────── */
const errStyle  = 'color:#e05;font-size:12px;text-align:center;';
const infoStyle = 'color:#888;font-size:12px;text-align:center;';

/* ─── 嵌入片段 ─────────────────────────────────────────────────────────── */

/** 虎牙等自动播放平台的点击加载占位卡(由 js/video-embed.js 负责插入 iframe)。 */
function facadeHtml(src) {
  return `<div class="hexo-video-embed video-facade" data-video-src="${src}" style="position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); background: #000; cursor: pointer;">
  <span class="video-facade-btn" aria-hidden="true"></span>
  <span class="video-facade-tip">点击加载 · 不自动播放</span>
</div>`;
}

/** Facebook 富卡片嵌入(fb-video XFBML,样式与 Instagram 嵌入一致)。 */
function facebookEmbedHtml(href) {
  return `<div class="hexo-video-embed"><div class="fb-video" data-href="${href}" data-autoplay="false" data-show-text="false" data-allowfullscreen="true" style="max-width: 540px; min-width: 326px; width: calc(100% - 2px); margin: 0 auto;"></div>
<div id="fb-root"></div>
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/zh_CN/sdk.js#xfbml=1&version=v21.0"></script>
<script>window.FB && window.FB.XFBML.parse();</script></div>`;
}

/* ─── Tag 注册(async) ─────────────────────────────────────────────────── */
hexo.extend.tag.register('video', async function (args) {
  let url = extractUrl(args);
  if (!url) return '';

  let src            = '';
  let embedHtml      = '';   // TikTok / Instagram / Facebook 富卡片嵌入
  let isTwitter      = false;
  let referrerPolicy = 'strict-origin-when-cross-origin';

  const _siteUrl = (() => {
    try { return new URL((hexo.config && hexo.config.url) || ''); } catch (e) { return null; }
  })();
  const siteOrigin   = _siteUrl ? _siteUrl.origin   : '';
  const siteHostname = _siteUrl ? _siteUrl.hostname  : 'localhost';

  /* ── 国内短链解析(b23.tv / hy.fan,构建时直连跟随跳转) ───────────────── */
  if (/\bb23\.tv\//.test(url) || /\bhy\.fan\//.test(url)) {
    const resolved = await resolveRedirect(url.startsWith('//') ? 'https:' + url : url);
    if (!resolved) {
      return `<p style="${errStyle}">[短链解析失败: ${String(url)}]<br>请将短链替换为完整的视频链接后重试。</p>`;
    }
    url = resolved;
  }

  /* ── 中国国内平台 ────────────────────────────────────────────────────── */

  if (url.includes('bilibili.com')) {
    const bvM = url.match(/BV([a-zA-Z0-9]+)/);
    if (bvM) {
      referrerPolicy = 'no-referrer';
      src = `https://player.bilibili.com/player.html?bvid=BV${bvM[1]}&page=1&autoplay=0&danmaku=0&muted=0`;
    }

  } else if (url.includes('acfun.cn')) {
    const acM = url.match(/ac=(\d+)/) || url.match(/\/ac(\d+)/);
    if (acM) src = `https://www.acfun.cn/player/ac${acM[1]}`;

  } else if (url.includes('ixigua.com')) {
    const ixM = url.match(/\/(\d+)\/?/);
    if (ixM) src = `https://www.ixigua.com/iframe/${ixM[1]}?autoplay=0`;

  } else if (url.includes('huya.com') || url.includes('msstatic.com/vod-player-360')) {
    if (url.includes('msstatic.com/vod-player-360')) {
      // 虎牙 VOD 直接嵌入链接,规范化协议
      src = url.startsWith('//') ? 'https:' + url : url;
    } else if (url.includes('liveshare.huya.com/iframe/')) {
      const lsM = url.match(/liveshare\.huya\.com\/iframe\/([a-zA-Z0-9]+)/);
      if (lsM) src = `https://liveshare.huya.com/iframe/${lsM[1]}`;
    } else if (url.includes('/video/play/')) {
      const vodM = url.match(/\/video\/play\/(\d+)/);
      if (vodM) src = `https://s1-static.msstatic.com/vod-player-360/index.html?id=${vodM[1]}`;
    } else {
      const huyaM = url.match(/huya\.com\/(\d+)/) || url.match(/huya\.com\/([a-zA-Z0-9_]+)/);
      if (huyaM) src = `https://liveshare.huya.com/iframe/${huyaM[1]}`;
    }
    // 虎牙直播/录像会自动播放,改为点击加载的占位卡
    if (src) return facadeHtml(src);

  /* ── 国际/国外平台 ───────────────────────────────────────────────────── */

  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // shorts 链接同样按普通视频嵌入(16:9 容器),播放器内自动加黑边、不变形
    let videoId = '';
    if (url.includes('shorts/')) {
      const m = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    } else if (url.includes('v=')) {
      const m = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    } else if (url.includes('youtu.be/')) {
      const m = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    }
    if (videoId) {
      const originParam = siteOrigin ? `&origin=${encodeURIComponent(siteOrigin)}` : '';
      src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&playsinline=1${originParam}`;
    }

  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    const tweetM = url.match(/\/status\/(\d+)/);
    if (tweetM) {
      isTwitter = true;
      src = `https://platform.twitter.com/embed/Tweet.html?id=${tweetM[1]}&dnt=true`;
    }

  } else if (url.includes('tiktok.com')) {
    // 官方 blockquote 嵌入;固定 325px 紧凑布局(宽卡片会出现"相关影片"侧栏)
    const ttM = url.match(/\/video\/(\d+)/);
    if (ttM) {
      const videoId = ttM[1];
      const userM   = url.match(/@([a-zA-Z0-9._-]+)/);
      const cite    = userM
        ? `https://www.tiktok.com/@${userM[1]}/video/${videoId}`
        : url.split('?')[0].replace(/\/+$/, '');
      const handle  = userM ? '@' + userM[1] : 'TikTok';
      embedHtml = `<div class="hexo-video-embed"><blockquote class="tiktok-embed" cite="${cite}" data-video-id="${videoId}" style="width: 325px; max-width: 100%; margin: 0 auto;">
  <section>
    <a target="_blank" title="${handle}" href="${cite}?refer=embed">${handle}</a>
  </section>
</blockquote>
<script async src="https://www.tiktok.com/embed.js"></script></div>`;
    }

  } else if (url.includes('instagram.com')) {
    // 官方 blockquote 嵌入,与 TikTok 同方案
    const permalink = url.split('?')[0].replace(/\/+$/, '');
    if (/\/(reel|reels|p|tv)\/[a-zA-Z0-9_-]+$/.test(permalink)) {
      embedHtml = `<div class="hexo-video-embed"><blockquote class="instagram-media" data-instgrm-permalink="${permalink}" data-instgrm-version="14" style="max-width: 540px; min-width: 326px; width: calc(100% - 2px); margin: 0 auto;">
  <section>
    <a href="${permalink}" target="_blank" rel="noopener">在 Instagram 上查看这篇帖子</a>
  </section>
</blockquote>
<script async src="https://www.instagram.com/embed.js"></script>
<script>window.instgrm && window.instgrm.Embeds.process();</script></div>`;
    }

  } else if (url.includes('twitch.tv')) {
    const parent = siteHostname || 'localhost';
    if (url.includes('/videos/')) {
      const m = url.match(/\/videos\/(\d+)/);
      if (m) src = `https://player.twitch.tv/?video=${m[1]}&parent=${parent}&autoplay=false`;
    } else if (/\/v\/(\d+)/.test(url)) {
      const m = url.match(/\/v\/(\d+)/);
      if (m) src = `https://player.twitch.tv/?video=${m[1]}&parent=${parent}&autoplay=false`;
    } else {
      const m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
      if (m) src = `https://player.twitch.tv/?channel=${m[1]}&parent=${parent}&autoplay=false`;
    }

  } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
    // 分享短链(share/r/、fb.watch)不再支持:直接给提示,不做联网解析
    if (/facebook\.com\/share\//.test(url) || /\bfb\.watch\//.test(url)) {
      return `<p style="${errStyle}">[不支持 Facebook 分享短链: ${String(url)}]<br>请粘贴完整的视频链接(如 https://www.facebook.com/reel/数字ID)后重新生成。</p>`;
    }
    // fb-video 富卡片(与 Instagram 嵌入观感一致,高度自适应无空白)
    const reelM = url.match(/facebook\.com\/reel\/(\d+)/);
    const href  = reelM ? `https://www.facebook.com/reel/${reelM[1]}` : url;
    embedHtml = facebookEmbedHtml(href);

  } else if (url.includes('vimeo.com')) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) src = `https://player.vimeo.com/video/${m[1]}?autoplay=0`;

  } else if (url.includes('nicovideo.jp')) {
    const m = url.match(/watch\/(sm\d+|so\d+)/);
    if (m) src = `https://embed.nicovideo.jp/watch/${m[1]}`;
  }

  /* ── 输出 HTML ───────────────────────────────────────────────────────── */

  if (embedHtml) return embedHtml;

  if (!src) {
    return `<p style="${infoStyle}">[不支持的视频链接: ${String(url)}]<br>建议直接粘贴该平台的嵌入代码 (iframe)</p>`;
  }

  // 统一 16:9 响应式容器(圆角 + 阴影,居中)
  return `
<div class="hexo-video-embed" style="position: relative; width: 100%; max-width: 100%; margin: 0 auto; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <iframe
    src="${src}"
    title="视频播放器"
    loading="lazy"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
    allowfullscreen
    scrolling="no"
    referrerpolicy="${referrerPolicy}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share">
  </iframe>
</div>
`;
}, { async: true });
