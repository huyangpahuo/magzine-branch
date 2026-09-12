/**
 * Universal video embed tag for Hexo
 * Usage:
 * {% video VIDEO_URL %}
 *
 * referrerPolicy 按平台区分:
 *   - Bilibili: no-referrer   (空 Referer 绕过手机端外链拦截)
 *   - 其余平台: strict-origin-when-cross-origin
 *              (YouTube 自 2025-07-09 起强制要求 Referer,
 *               no-referrer 会导致 Error 153;Vimeo 等同理)
 */

hexo.extend.tag.register('video', function (args) {
  const url = args[0];
  if (!url) return '';

  let src = '';
  let isVertical = false;
  let isTwitter = false;

  // 默认 referrer 策略
  let referrerPolicy = 'strict-origin-when-cross-origin';

  // 从 Hexo 全局配置读取站点 URL
  const _siteUrl = (() => {
    try { return new URL((hexo.config && hexo.config.url) || ''); } catch (e) { return null; }
  })();
  const siteOrigin   = _siteUrl ? _siteUrl.origin   : '';
  const siteHostname = _siteUrl ? _siteUrl.hostname  : 'localhost';

  // ==================== 中国国内平台 ====================

  // ---------- 哔哩哔哩 (Bilibili) ----------
  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    const m = url.match(/BV([a-zA-Z0-9]+)/);
    if (m) {
      // Bilibili 手机端检测到外链 Referer 时会拦截;空 Referer 视为直接访问。
      // 仅使用官方文档参数,移除非文档参数 high_quality/autopopup/allow_key_events。
      referrerPolicy = 'no-referrer';
      src = `https://player.bilibili.com/player.html?bvid=BV${m[1]}&page=1&autoplay=0&danmaku=0&muted=0`;
    }
  }

  // ---------- AcFun (A站) ----------
  else if (url.includes('acfun.cn')) {
    const m = url.match(/ac=(\d+)/) || url.match(/ac(\d+)/);
    if (m) src = `https://www.acfun.cn/player/ac${m[1]}`;
  }

  // ---------- 西瓜视频 (Xigua) ----------
  else if (url.includes('ixigua.com')) {
    const m = url.match(/\/(\d+)\/?/);
    if (m) src = `https://www.ixigua.com/iframe/${m[1]}?autoplay=0`;
  }

  // ---------- 虎牙直播 (Huya) ----------
  else if (url.includes('huya.com')) {
    const m = url.match(/huya\.com\/(\d+)/) || url.match(/huya\.com\/([a-zA-Z0-9]+)/);
    if (m) src = `https://liveshare.huya.com/iframe/${m[1]}`;
  }

  // ==================== 国际/国外平台 ====================

  // ---------- YouTube (支持普通视频和 Shorts) ----------
  else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('shorts/')) {
      const m = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
      isVertical = true;
    } else if (url.includes('v=')) {
      const m = url.match(/v=([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    } else if (url.includes('youtu.be/')) {
      const m = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    }

    if (videoId) {
      // youtube-nocookie.com: 隐私增强嵌入,减少跨站追踪
      // playsinline=1:       iOS Safari 内联播放,避免强制全屏
      // origin=:             告知 YouTube 来源域名,满足 API 安全要求
      // referrerPolicy 保持 strict-origin-when-cross-origin:
      //   YouTube 自 2025-07-09 起强制要求 Referer(Error 153),
      //   no-referrer 会导致视频无法播放。
      const originParam = siteOrigin ? `&origin=${encodeURIComponent(siteOrigin)}` : '';
      src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&playsinline=1${originParam}`;
    }
  }

  // ---------- Twitter / X ----------
  else if (url.includes('twitter.com') || url.includes('x.com')) {
    isTwitter = true;
    src = `https://twitframe.com/show?url=${encodeURIComponent(url)}`;
  }

  // ---------- TikTok (国际版抖音) ----------
  else if (url.includes('tiktok.com')) {
    const m = url.match(/video\/(\d+)/);
    if (m) {
      src = `https://www.tiktok.com/embed/v2/${m[1]}`;
      isVertical = true;
    }
  }

  // ---------- Instagram ----------
  else if (url.includes('instagram.com')) {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    src = `${cleanUrl}/embed/`;
    isVertical = true;
  }

  // ---------- Twitch (直播和录像) ----------
  // Twitch 要求 parent 参数必须是实际嵌入页面的域名,填 localhost 在生产环境无效
  else if (url.includes('twitch.tv')) {
    const parent = siteHostname || 'localhost';
    if (url.includes('/videos/')) {
      const m = url.match(/videos\/(\d+)/);
      if (m) src = `https://player.twitch.tv/?video=${m[1]}&parent=${parent}&autoplay=false`;
    } else {
      const m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
      if (m) src = `https://player.twitch.tv/?channel=${m[1]}&parent=${parent}&autoplay=false`;
    }
  }

  // ---------- Facebook ----------
  else if (url.includes('facebook.com') || url.includes('fb.watch')) {
    src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;
  }

  // ---------- Vimeo ----------
  else if (url.includes('vimeo.com')) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) src = `https://player.vimeo.com/video/${m[1]}`;
  }

  // ---------- Niconico ----------
  else if (url.includes('nicovideo.jp')) {
    const m = url.match(/watch\/(sm\d+|so\d+)/);
    if (m) src = `https://embed.nicovideo.jp/watch/${m[1]}`;
  }

  // ==================== 输出 HTML ====================

  if (!src) {
    return `<p style="color:#888;font-size:12px;text-align:center;">[不支持的视频链接: ${url}] <br> 建议直接粘贴该平台的嵌入代码 (iframe)</p>`;
  }

  let paddingBottom = '56.25%';
  let maxWidth = '100%';
  let margin = '0';

  if (isVertical) {
    paddingBottom = '177.77%'; // 9:16
    maxWidth = '350px';
    margin = '0 auto';
  } else if (isTwitter) {
    paddingBottom = '100%';
    maxWidth = '500px';
    margin = '0 auto';
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
});
