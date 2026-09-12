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
 *   b23.tv、hy.fan、Facebook share/r/ 在构建时通过 HTTP 跟随跳转自动解析。
 *   解析失败时输出明确的错误提示。
 *
 * 暂不支持:B站直播、AcFun直播(无公开嵌入 URL,输出提示信息)。
 */

'use strict';
const https = require('https');
const http  = require('http');

/* ─── 工具函数 ─────────────────────────────────────────────────────────── */

/**
 * 跟随 HTTP/HTTPS 重定向,返回最终 URL。
 * 超时(8 s)、网络错误或超过跳转次数时返回 null。
 */
function resolveRedirect(urlStr, maxHops = 5) {
  return new Promise((resolve) => {
    if (maxHops === 0) { resolve(null); return; }
    let parsed;
    try {
      parsed = new URL(urlStr.startsWith('//') ? 'https:' + urlStr : urlStr);
    } catch (e) { resolve(null); return; }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      parsed.href,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HexoBlogBuilder/1.0)' }, timeout: 8000 },
      (res) => {
        res.resume();
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let next;
          try { next = new URL(res.headers.location, parsed.href).href; }
          catch (e) { resolve(null); return; }
          resolve(resolveRedirect(next, maxHops - 1));
        } else {
          resolve(urlStr);
        }
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * 从 Hexo tag 的 args 数组里提取 URL。
 * 支持 "标题 URL" 格式(如微信/微博复制的带标题链接):
 *   args[0] 可能是标题文字,URL 在 args[1] 或之后。
 */
function extractUrl(args) {
  for (const a of args) {
    if (a && /^https?:\/\/|^\/\//.test(a)) return a;
  }
  // 兜底:扫描拼接字符串中的第一个 URL
  const m = args.join(' ').match(/https?:\/\/\S+|\/\/\S+/);
  return m ? m[0] : (args[0] || '');
}

/* ─── 错误/提示 HTML ───────────────────────────────────────────────────── */
const errStyle  = 'color:#e05;font-size:12px;text-align:center;';
const infoStyle = 'color:#888;font-size:12px;text-align:center;';

/* ─── Tag 注册(async) ─────────────────────────────────────────────────── */
hexo.extend.tag.register('video', async function (args) {
  let url = extractUrl(args);
  if (!url) return '';

  let src            = '';
  let isVertical     = false;
  let isTwitter      = false;
  let isTikTok       = false;
  let isInstagram    = false;
  let referrerPolicy = 'strict-origin-when-cross-origin';

  const _siteUrl = (() => {
    try { return new URL((hexo.config && hexo.config.url) || ''); } catch (e) { return null; }
  })();
  const siteOrigin   = _siteUrl ? _siteUrl.origin   : '';
  const siteHostname = _siteUrl ? _siteUrl.hostname  : 'localhost';

  /* ── 短链解析 ────────────────────────────────────────────────────────── */
  if (/\bb23\.tv\//.test(url) || /\bhy\.fan\//.test(url) || /facebook\.com\/share\//.test(url)) {
    const resolved = await resolveRedirect(url.startsWith('//') ? 'https:' + url : url);
    if (!resolved) {
      return `<p style="${errStyle}">[短链解析失败: ${url}]<br>请将短链替换为完整的视频链接后重试。</p>`;
    }
    url = resolved;
  }

  /* ── 中国国内平台 ────────────────────────────────────────────────────── */

  if (url.includes('bilibili.com')) {
    if (url.includes('live.bilibili.com')) {
      return `<p style="${infoStyle}">[B站直播暂不支持嵌入，请前往原页面观看]</p>`;
    }
    const bvM = url.match(/BV([a-zA-Z0-9]+)/);
    if (bvM) {
      referrerPolicy = 'no-referrer';
      src = `https://player.bilibili.com/player.html?bvid=BV${bvM[1]}&page=1&autoplay=0&danmaku=0&muted=0`;
    }

  } else if (url.includes('acfun.cn')) {
    if (url.includes('live.acfun.cn')) {
      return `<p style="${infoStyle}">[AcFun直播暂不支持嵌入，请前往原页面观看]</p>`;
    }
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
    const ttM = url.match(/\/video\/(\d+)/);
    if (ttM) {
      isTikTok = true;
      src = `https://www.tiktok.com/embed/v2/${ttM[1]}`;
    }

  } else if (url.includes('instagram.com')) {
    const igUrl = url.split('?')[0].replace(/\/$/, '');
    isInstagram = true;
    src = `${igUrl}/embed/`;

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
    src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;

  } else if (url.includes('vimeo.com')) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) src = `https://player.vimeo.com/video/${m[1]}`;

  } else if (url.includes('nicovideo.jp')) {
    const m = url.match(/watch\/(sm\d+|so\d+)/);
    if (m) src = `https://embed.nicovideo.jp/watch/${m[1]}`;
  }

  /* ── 输出 HTML ───────────────────────────────────────────────────────── */

  if (!src) {
    return `<p style="${infoStyle}">[不支持的视频链接: ${url}]<br>建议直接粘贴该平台的嵌入代码 (iframe)</p>`;
  }

  let paddingBottom = '56.25%'; // 默认 16:9
  let maxWidth      = '100%';
  let margin        = '0';

  if (isTikTok) {
    // TikTok 推荐宽度 325 px,保持 9:16 比例,max-width 限为 325 px 消除多余空白
    paddingBottom = '177.77%';
    maxWidth      = '325px';
    margin        = '0 auto';
  } else if (isInstagram) {
    // Instagram Reel 嵌入包含 UI chrome,130% 比纯 9:16 更贴近实际渲染高度
    paddingBottom = '130%';
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
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
  </iframe>
</div>
`;
}, { async: true });
