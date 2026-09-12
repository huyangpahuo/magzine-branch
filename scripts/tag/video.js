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
 *   - b23.tv、hy.fan : 构建时跟随 HTTP 跳转自动解析,失败时输出明确的错误提示。
 *   - Facebook share/r/、fb.watch : 构建时跟随跳转,并从跳转链或页面 og:url /
 *     videoId 中提取完整视频/Reel 地址;解析失败时回退为把原链接直接交给
 *     Facebook 官方插件(由访客浏览器端解析),不中断构建。
 *
 * 竖屏视频:
 *   - TikTok / Instagram : 官方 blockquote + embed.js 嵌入,高度自适应无空白。
 *   - YouTube Shorts 等竖屏 : 9:16 响应式容器 iframe。
 */

'use strict';
const https = require('https');
const http  = require('http');

/* 构建期请求使用真实浏览器 UA,Facebook 等平台对爬虫 UA 会拒绝响应 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* ─── 工具函数 ─────────────────────────────────────────────────────────── */

/** 单次 GET 请求。返回 { statusCode, headers, res };网络错误/超时返回 null。 */
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
 * 依次请求并跟随重定向。
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
 * 跟随 HTTP/HTTPS 重定向,返回最终 URL(b23.tv、hy.fan 用)。
 * 超时(8 s)、网络错误或超过跳转次数时返回 null。
 */
function resolveRedirect(urlStr, maxHops = 6) {
  return fetchFollowRedirects(urlStr, maxHops).then(
    (r) => (r && r.urls.length ? r.urls[r.urls.length - 1] : null)
  );
}

/**
 * 从跳转链 URL 和最终页面 HTML 中提取 Facebook 视频/Reel 的规范地址。
 * 依次尝试:跳转链 URL(含 decodeURIComponent 后的,覆盖 login/?next= 场景)、
 * 页面 og:url、页面内 reel/videoId 字样。找不到返回 ''。
 */
function extractFacebookVideoUrl(urls, body) {
  const candidates = [];
  for (const u of urls || []) {
    candidates.push(u);
    try {
      const d = decodeURIComponent(u);
      if (d !== u) candidates.push(d);
    } catch (e) { /* 含非法百分号编码时忽略 */ }
  }

  for (const u of candidates) {
    const m = u.match(/facebook\.com\/reel\/(\d+)/);
    if (m) return `https://www.facebook.com/reel/${m[1]}`;
  }
  for (const u of candidates) {
    const m = u.match(/facebook\.com\/watch\/?(?:live\/)?\?(?:[^#]*&)?v=(\d+)/);
    if (m) return `https://www.facebook.com/watch/?v=${m[1]}`;
  }
  for (const u of candidates) {
    const m = u.match(/facebook\.com\/[^/?#]+\/videos\/(?:[^/?#]+\/)?(\d+)/);
    if (m) return `https://www.facebook.com/watch/?v=${m[1]}`;
  }

  const hay = body || '';
  let m = hay.match(/property=["']og:url["']\s+content=["']([^"']+)["']/) ||
          hay.match(/content=["']([^"']+)["']\s+property=["']og:url["']/);
  if (m) {
    const og = m[1].replace(/&amp;/g, '&');
    const om = og.match(/(?:https?:\/\/)?facebook\.com\/(reel\/\d+|watch\/\?v=\d+)/);
    if (om) return `https://www.facebook.com/${om[1]}`;
    const vm = og.match(/(?:https?:\/\/)?facebook\.com\/[^/?#]+\/videos\/(\d+)/);
    if (vm) return `https://www.facebook.com/watch/?v=${vm[1]}`;
  }
  m = hay.match(/facebook\.com\/reel\/(\d+)/);
  if (m) return `https://www.facebook.com/reel/${m[1]}`;
  m = hay.match(/"videoId"\s*:\s*"(\d+)"/);
  if (m) return `https://www.facebook.com/watch/?v=${m[1]}`;
  return '';
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

/* ─── Tag 注册(async) ─────────────────────────────────────────────────── */
hexo.extend.tag.register('video', async function (args) {
  let url = extractUrl(args);
  if (!url) return '';

  let src            = '';
  let embedHtml      = '';   // TikTok / Instagram 官方 blockquote 嵌入代码
  let isVertical     = false;
  let isTwitter      = false;
  let isFbReel       = false;
  let referrerPolicy = 'strict-origin-when-cross-origin';

  const _siteUrl = (() => {
    try { return new URL((hexo.config && hexo.config.url) || ''); } catch (e) { return null; }
  })();
  const siteOrigin   = _siteUrl ? _siteUrl.origin   : '';
  const siteHostname = _siteUrl ? _siteUrl.hostname  : 'localhost';

  /* ── 短链解析 ────────────────────────────────────────────────────────── */
  const isFbShareLink = /facebook\.com\/share\//.test(url) || /\bfb\.watch\//.test(url);
  if (/\bb23\.tv\//.test(url) || /\bhy\.fan\//.test(url) || isFbShareLink) {
    const requestUrl = url.startsWith('//') ? 'https:' + url : url;
    if (isFbShareLink) {
      const result = await fetchFollowRedirects(requestUrl);
      const resolved = result ? extractFacebookVideoUrl(result.urls, result.body) : '';
      if (resolved) {
        url = resolved;
      } else {
        // 解析失败(常见于构建环境无法访问 Facebook):退回原链接,
        // 交给 Facebook 官方插件在访客浏览器端自行解析
        if (hexo.log && hexo.log.warn) hexo.log.warn('[video] Facebook 短链未能解析,回退为插件直嵌: ' + String(url));
      }
    } else {
      const resolved = await resolveRedirect(requestUrl);
      if (!resolved) {
        return `<p style="${errStyle}">[短链解析失败: ${String(url)}]<br>请将短链替换为完整的视频链接后重试。</p>`;
      }
      url = resolved;
    }
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
      // 虎牙 VOD 直接嵌入链接,规范化协议后直接使用
      src = url.startsWith('//') ? 'https:' + url : url;
    } else if (url.includes('liveshare.huya.com/iframe/')) {
      // 已经是嵌入 URL,提取 room ID 确保 https
      const lsM = url.match(/liveshare\.huya\.com\/iframe\/([a-zA-Z0-9]+)/);
      if (lsM) src = `https://liveshare.huya.com/iframe/${lsM[1]}`;
    } else if (url.includes('/video/play/')) {
      // 虎牙录像页: huya.com/video/play/ID.html 或 //www.huya.com/video/play/ID.html
      const vodM = url.match(/\/video\/play\/(\d+)/);
      if (vodM) src = `https://s1-static.msstatic.com/vod-player-360/index.html?id=${vodM[1]}`;
    } else {
      // 虎牙直播间
      const huyaM = url.match(/huya\.com\/(\d+)/) || url.match(/huya\.com\/([a-zA-Z0-9_]+)/);
      if (huyaM) src = `https://liveshare.huya.com/iframe/${huyaM[1]}`;
    }

  /* ── 国际/国外平台 ───────────────────────────────────────────────────── */

  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('shorts/')) {
      const m = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
      if (m) { videoId = m[1]; isVertical = true; }
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
    // 竖屏视频使用官方 blockquote 嵌入(embed.js 自动撑高,无 iframe 空白)
    const ttM = url.match(/\/video\/(\d+)/);
    if (ttM) {
      const videoId = ttM[1];
      const userM   = url.match(/@([a-zA-Z0-9._-]+)/);
      const cite    = userM
        ? `https://www.tiktok.com/@${userM[1]}/video/${videoId}`
        : url.split('?')[0].replace(/\/+$/, '');
      const handle  = userM ? '@' + userM[1] : 'TikTok';
      embedHtml = `<blockquote class="tiktok-embed" cite="${cite}" data-video-id="${videoId}" style="max-width: 605px; min-width: 325px; margin: 0 auto;">
  <section>
    <a target="_blank" title="${handle}" href="${cite}?refer=embed">${handle}</a>
  </section>
</blockquote>
<script async src="https://www.tiktok.com/embed.js"></script>`;
    }

  } else if (url.includes('instagram.com')) {
    // 竖屏 Reel 与 TikTok 同方案:官方 blockquote 嵌入
    const permalink = url.split('?')[0].replace(/\/+$/, '');
    if (/\/(reel|reels|p|tv)\/[a-zA-Z0-9_-]+$/.test(permalink)) {
      embedHtml = `<blockquote class="instagram-media" data-instgrm-permalink="${permalink}" data-instgrm-version="14" style="max-width: 540px; min-width: 326px; width: calc(100% - 2px); margin: 0 auto;">
  <section>
    <a href="${permalink}" target="_blank" rel="noopener">在 Instagram 上查看这篇帖子</a>
  </section>
</blockquote>
<script async src="https://www.instagram.com/embed.js"></script>`;
    }

  } else if (url.includes('twitch.tv')) {
    const parent = siteHostname || 'localhost';
    if (url.includes('/videos/')) {
      const m = url.match(/\/videos\/(\d+)/);
      if (m) src = `https://player.twitch.tv/?video=${m[1]}&parent=${parent}&autoplay=false`;
    } else if (/\/v\/(\d+)/.test(url)) {
      // 手机版录像链接: twitch.tv/CHANNEL/v/VIDEO_ID
      const m = url.match(/\/v\/(\d+)/);
      if (m) src = `https://player.twitch.tv/?video=${m[1]}&parent=${parent}&autoplay=false`;
    } else {
      const m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
      if (m) src = `https://player.twitch.tv/?channel=${m[1]}&parent=${parent}&autoplay=false`;
    }

  } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
    const reelM = url.match(/facebook\.com\/reel\/(\d+)/);
    if (reelM) {
      // Reel 为竖屏视频,使用 9:16 响应式容器
      isFbReel = true;
      src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(`https://www.facebook.com/reel/${reelM[1]}`)}&show_text=0&width=400`;
    } else {
      // 普通视频/未能解析的分享短链:原样交给 Facebook 官方插件解析
      src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;
    }

  } else if (url.includes('vimeo.com')) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) src = `https://player.vimeo.com/video/${m[1]}`;

  } else if (url.includes('nicovideo.jp')) {
    const m = url.match(/watch\/(sm\d+|so\d+)/);
    if (m) src = `https://embed.nicovideo.jp/watch/${m[1]}`;
  }

  /* ── 输出 HTML ───────────────────────────────────────────────────────── */

  if (embedHtml) return embedHtml;

  if (!src) {
    return `<p style="${infoStyle}">[不支持的视频链接: ${String(url)}]<br>建议直接粘贴该平台的嵌入代码 (iframe)</p>`;
  }

  let paddingBottom = '56.25%'; // 默认 16:9
  let maxWidth      = '100%';
  let margin        = '0';

  if (isFbReel) {
    // Facebook Reel:9:16 响应式,与 TikTok/Instagram 一致
    paddingBottom = '177.77%';
    maxWidth      = '400px';
    margin        = '0 auto';
  } else if (isVertical) {
    paddingBottom = '177.77%';
    maxWidth      = '350px';
    margin        = '0 auto';
  } else if (isTwitter) {
    paddingBottom = '100%';
    maxWidth      = '500px';
    margin        = '0 auto';
  }

  return `
<div style="position: relative; width: 100%; max-width: ${maxWidth}; margin: ${margin}; padding-bottom: ${paddingBottom}; height: 0; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <iframe
    src="${src}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
    allowfullscreen
    scrolling="no"
    referrerpolicy="${referrerPolicy}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share">
  </iframe>
</div>
`;
}, { async: true });
