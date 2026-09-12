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
 *     videoId 中提取完整视频/Reel 地址;解析失败时输出明确的错误提示
 *     (构建机需能访问 Facebook,可配置 HTTPS_PROXY 走本地代理)。
 *
 * 自动播放与暂停:
 *   - 所有平台默认不自动播放;虎牙(直播/录像)输出点击加载的占位卡,
 *     由前端脚本(js/video-embed.js)在点击时才插入 iframe,彻底杜绝自动播放。
 *   - 前端脚本监听焦点变化:点击播放任一视频时,自动暂停上一个在播的视频
 *     (YouTube/Vimeo 用 postMessage 优雅暂停,其余平台重载回封面)。
 *
 * 竖屏视频:
 *   - TikTok / Instagram / Facebook : 官方富卡片嵌入(embed.js / SDK 自适应高度)
 *   - YouTube Shorts 等竖屏 : 9:16 响应式容器 iframe(325px,与 TikTok 一致)
 */

'use strict';
const https = require('https');
const http  = require('http');
const net   = require('net');
const tls   = require('tls');

/* 构建期请求使用真实浏览器 UA,Facebook 等平台对爬虫 UA 会拒绝响应 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* ─── 代理支持(HTTPS_PROXY / HTTP_PROXY / ALL_PROXY) ──────────────────── */

/**
 * 根据目标 URL 与环境变量决定是否走代理。
 * 国内平台(b23.tv 等)通常不在代理规则里,读取 NO_PROXY 予以排除。
 */
function readProxyFor(urlStr) {
  try {
    const u = new URL(urlStr);
    const env = process.env || {};
    const host = u.hostname.toLowerCase();
    const noProxy = (env.NO_PROXY || env.no_proxy || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const excluded = noProxy.some((d) => host === d || host.endsWith(d.charAt(0) === '.' ? d : '.' + d));
    if (excluded) return null;
    const raw = u.protocol === 'https:'
      ? (env.HTTPS_PROXY || env.https_proxy || env.ALL_PROXY || env.all_proxy)
      : (env.HTTP_PROXY || env.http_proxy || env.ALL_PROXY || env.all_proxy);
    if (!raw) return null;
    const p = new URL(raw);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return null;
    return p;
  } catch (e) { return null; }
}

/** 解析经 CONNECT 隧道/代理收到的原始 HTTP 响应(HTTP/1.0,close 分帧)。 */
function parseRawResponse(raw) {
  const s = raw.toString('latin1');
  const idx = s.indexOf('\r\n\r\n');
  if (idx === -1 || !/^HTTP\/1\.[01] \d{3}/.test(s)) return null;
  const headLines = s.slice(0, idx).split('\r\n');
  const statusCode = parseInt(headLines[0].split(' ')[1], 10);
  const headers = {};
  for (let i = 1; i < headLines.length; i++) {
    const c = headLines[i].indexOf(':');
    if (c > 0) headers[headLines[i].slice(0, c).trim().toLowerCase()] = headLines[i].slice(c + 1).trim();
  }
  return { statusCode, headers, body: raw.slice(idx + 4).toString('latin1') };
}

/**
 * 经 HTTP 代理请求目标 URL:https 走 CONNECT 隧道 + TLS,
 * http 直接向代理发送绝对地址 GET(HTTP/1.0,响应以连接关闭分帧)。
 * 返回 { statusCode, headers, body };失败返回 null。
 */
function proxiedHttpGet(urlStr, proxy, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let target;
    try { target = new URL(urlStr); } catch (e) { resolve(null); return; }
    const targetPort = Number(target.port) || (target.protocol === 'https:' ? 443 : 80);

    let settled = false;
    const socket = net.connect({ host: proxy.hostname, port: Number(proxy.port) || 80 });
    const finish = (r) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (e) { /* ignore */ }
      resolve(r);
    };
    socket.setTimeout(timeoutMs);
    socket.on('error', () => finish(null));
    socket.on('timeout', () => finish(null));

    const sendRaw = (sock) => {
      const path = (target.pathname || '/') + (target.search || '');
      const req = `GET ${path} HTTP/1.0\r\nHost: ${target.hostname}\r\n`
        + `User-Agent: ${BROWSER_UA}\r\n`
        + `Accept: text/html,*/*;q=0.8\r\nAccept-Language: zh-CN,zh;q=0.9,en;q=0.8\r\n`
        + `Connection: close\r\n\r\n`;
      sock.write(req);
      let raw = Buffer.alloc(0);
      sock.on('data', (c) => {
        raw = Buffer.concat([raw, c]);
        if (raw.length > 2 * 1024 * 1024) sock.destroy();
      });
      sock.on('close', () => finish(parseRawResponse(raw)));
      sock.on('error', () => finish(null));
    };

    socket.on('connect', () => {
      if (target.protocol !== 'https:') {
        sendRaw(socket);
        return;
      }
      let head = `CONNECT ${target.hostname}:${targetPort} HTTP/1.1\r\nHost: ${target.hostname}:${targetPort}\r\n`;
      if (proxy.username) {
        const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password || '')}`;
        head += `Proxy-Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n`;
      }
      head += '\r\n';
      let buf = '';
      const onConnectData = (chunk) => {
        buf += chunk.toString('latin1');
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        socket.removeListener('data', onConnectData);
        if (!/^HTTP\/1\.[01] 200\b/.test(buf)) { finish(null); return; }
        try {
          const rest = buf.slice(idx + 4);
          if (rest) socket.unshift(Buffer.from(rest, 'latin1'));
          const tlsSock = tls.connect({ socket, servername: target.hostname, rejectUnauthorized: false });
          tlsSock.setTimeout(timeoutMs);
          tlsSock.on('error', () => finish(null));
          tlsSock.on('timeout', () => finish(null));
          tlsSock.on('secureConnect', () => sendRaw(tlsSock));
        } catch (e) { finish(null); }
      };
      socket.on('data', onConnectData);
      socket.write(head);
    });
  });
}

/* ─── 工具函数 ─────────────────────────────────────────────────────────── */

/** 单次 GET 请求(支持代理环境变量)。返回 { statusCode, headers, res?, body? };失败返回 null。 */
function httpGet(urlStr, timeoutMs = 8000) {
  const proxy = readProxyFor(urlStr);
  if (proxy) return proxiedHttpGet(urlStr, proxy, timeoutMs);

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
      if (r.res) r.res.resume();
      try { current = new URL(r.headers.location, current).href; }
      catch (e) { return null; }
      continue;
    }
    urls.push(current);
    const body = r.body !== undefined ? r.body : await readBody(r.res);
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
  let isVertical     = false;
  let isTwitter      = false;
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
        // 解析失败(FB 插件不认短链,直接嵌入只会显示"视频不可用"),
        // 输出可操作的错误提示而不是坏掉的播放器
        return `<p style="${errStyle}">[Facebook 分享短链解析失败: ${String(url)}]<br>构建时无法访问 Facebook:可设置 HTTPS_PROXY 环境变量(如 http://127.0.0.1:7890)后重新生成,或直接粘贴完整的 Reel/视频链接。</p>`;
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
      // enablejsapi=1 供前端脚本 postMessage 暂停上一个在播视频
      const originParam = siteOrigin ? `&origin=${encodeURIComponent(siteOrigin)}` : '';
      src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&playsinline=1&enablejsapi=1${originParam}`;
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

  let paddingBottom = '56.25%'; // 默认 16:9
  let maxWidth      = '100%';
  let margin        = '0';

  if (isVertical) {
    // 竖屏(YouTube Shorts 等):9:16 响应式,325px 与 TikTok 布局一致
    paddingBottom = '177.77%';
    maxWidth      = '325px';
    margin        = '0 auto';
  } else if (isTwitter) {
    paddingBottom = '100%';
    maxWidth      = '500px';
    margin        = '0 auto';
  }

  return `
<div class="hexo-video-embed" style="position: relative; width: 100%; max-width: ${maxWidth}; margin: ${margin}; padding-bottom: ${paddingBottom}; height: 0; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
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
