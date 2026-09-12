/**
 * 万花筒(murmur)页面服务端视频解析 helper (同步)
 *
 * 模板用法: - var vData = parse_murmur_video(item.video)
 *
 * 注意:
 *   此 helper 为同步函数,无法在构建时跟随 HTTP 重定向。
 *   b23.tv / hy.fan / Facebook share/r/ 等短链请在 murmur 数据文件中
 *   直接填写完整视频链接,短链在此上下文中无法自动解析。
 *
 * 返回值字段:
 *   src            — iframe src
 *   isVertical     — YouTube Shorts 等通用竖屏
 *   isTikTok       — TikTok(需专用容器尺寸)
 *   isInstagram    — Instagram Reel(需专用容器尺寸)
 *   isTwitter      — Twitter/X 推文
 *   referrerPolicy — iframe referrerpolicy 属性值
 *   unsupported    — 非空表示该类型暂不支持,应在模板中显示提示而非 iframe
 */

function parseMurmurVideo(url) {
  if (!url) return null;

  let src            = '';
  let isVertical     = false;
  let isTwitter      = false;
  let isTikTok       = false;
  let isInstagram    = false;
  let unsupported    = '';
  let referrerPolicy = 'strict-origin-when-cross-origin';

  const _siteUrl = (() => {
    try { return new URL((hexo.config && hexo.config.url) || ''); } catch (e) { return null; }
  })();
  const siteOrigin   = _siteUrl ? _siteUrl.origin   : '';
  const siteHostname = _siteUrl ? _siteUrl.hostname  : 'localhost';

  /* ── 中国国内平台 ──────────────────────────────────────────────────────── */

  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    if (url.includes('live.bilibili.com')) {
      unsupported = 'B站直播暂不支持嵌入，请前往原页面观看';
    } else {
      const bvM = url.match(/BV([a-zA-Z0-9]+)/);
      if (bvM) {
        // 空 Referer 绕过 B 站手机端外链拦截
        referrerPolicy = 'no-referrer';
        src = `https://player.bilibili.com/player.html?bvid=BV${bvM[1]}&page=1&autoplay=0&danmaku=0&muted=0`;
      }
    }

  } else if (url.includes('acfun.cn')) {
    if (url.includes('live.acfun.cn')) {
      unsupported = 'AcFun直播暂不支持嵌入，请前往原页面观看';
    } else {
      const acM = url.match(/ac=(\d+)/) || url.match(/\/ac(\d+)/);
      if (acM) src = `https://www.acfun.cn/player/ac${acM[1]}`;
    }

  } else if (url.includes('ixigua.com')) {
    const ixM = url.match(/\/(\d+)\/?/);
    if (ixM) src = `https://www.ixigua.com/iframe/${ixM[1]}?autoplay=0`;

  } else if (url.includes('huya.com') || url.includes('msstatic.com/vod-player-360')) {
    if (url.includes('msstatic.com/vod-player-360')) {
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

  /* ── 国际/国外平台 ─────────────────────────────────────────────────────── */

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
    } else if (url.includes('embed/')) {
      const m = url.match(/embed\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    } else if (url.includes('live/')) {
      const m = url.match(/live\/([a-zA-Z0-9_-]+)/);
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

  return { src, isVertical, isTikTok, isInstagram, isTwitter, referrerPolicy, unsupported };
}

hexo.extend.helper.register('parse_murmur_video', parseMurmurVideo);
