/**
 * 万花筒(murmur)页面服务端视频解析 helper (同步)
 *
 * 模板用法: - var vData = parse_murmur_video(item.video)
 *
 * 注意:
 *   此 helper 为同步函数,无法在构建时跟随 HTTP 重定向。
 *   b23.tv / hy.fan / Facebook share/r/ 等短链请在 murmur 数据文件中
 *   直接填写完整视频链接(Facebook 分享短链无法在此解析,会显示提示)。
 *
 * 返回值字段:
 *   src            — iframe src
 *   html           — 富卡片嵌入(TikTok / Instagram / Facebook)或虎牙点击加载占位卡,
 *                    优先于 src 渲染,需以 != 输出原始 HTML
 *   isVertical     — YouTube Shorts 等通用竖屏
 *   isTwitter      — Twitter/X 推文
 *   referrerPolicy — iframe referrerpolicy 属性值
 *   unsupported    — 非空表示该链接无法解析,应在模板中显示提示而非 iframe
 */

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

function parseMurmurVideo(url) {
  if (!url || typeof url !== 'string') return null;

  let src            = '';
  let html           = '';
  let isVertical     = false;
  let isTwitter      = false;
  let unsupported    = '';
  let referrerPolicy = 'strict-origin-when-cross-origin';

  const _siteUrl = (() => {
    try { return new URL((hexo.config && hexo.config.url) || ''); } catch (e) { return null; }
  })();
  const siteOrigin   = _siteUrl ? _siteUrl.origin   : '';
  const siteHostname = _siteUrl ? _siteUrl.hostname  : 'localhost';

  /* ── 中国国内平台 ──────────────────────────────────────────────────────── */

  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    const bvM = url.match(/BV([a-zA-Z0-9]+)/);
    if (bvM) {
      // 空 Referer 绕过 B 站手机端外链拦截
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
    if (src) html = facadeHtml(src);

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
      src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&playsinline=1&enablejsapi=1${originParam}`;
    }

  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    const tweetM = url.match(/\/status\/(\d+)/);
    if (tweetM) {
      isTwitter = true;
      src = `https://platform.twitter.com/embed/Tweet.html?id=${tweetM[1]}&dnt=true`;
    }

  } else if (url.includes('tiktok.com')) {
    // 官方 blockquote 嵌入;固定 325px 紧凑布局
    const ttM = url.match(/\/video\/(\d+)/);
    if (ttM) {
      const videoId = ttM[1];
      const userM   = url.match(/@([a-zA-Z0-9._-]+)/);
      const cite    = userM
        ? `https://www.tiktok.com/@${userM[1]}/video/${videoId}`
        : url.split('?')[0].replace(/\/+$/, '');
      const handle  = userM ? '@' + userM[1] : 'TikTok';
      html = `<div class="hexo-video-embed"><blockquote class="tiktok-embed" cite="${cite}" data-video-id="${videoId}" style="width: 325px; max-width: 100%; margin: 0 auto;">
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
      html = `<div class="hexo-video-embed"><blockquote class="instagram-media" data-instgrm-permalink="${permalink}" data-instgrm-version="14" style="max-width: 540px; min-width: 326px; width: calc(100% - 2px); margin: 0 auto;">
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
    const reelM = url.match(/facebook\.com\/reel\/(\d+)/);
    if (reelM) {
      html = facebookEmbedHtml(`https://www.facebook.com/reel/${reelM[1]}`);
    } else if (/facebook\.com\/share\//.test(url) || /\bfb\.watch\//.test(url)) {
      // 同步上下文无法解析分享短链,直接嵌入会显示"视频不可用"
      unsupported = 'Facebook 分享短链无法在此解析,请填写完整的视频/Reel 链接';
    } else {
      html = facebookEmbedHtml(url);
    }

  } else if (url.includes('vimeo.com')) {
    const m = url.match(/vimeo\.com\/(\d+)/);
    if (m) src = `https://player.vimeo.com/video/${m[1]}?autoplay=0`;

  } else if (url.includes('nicovideo.jp')) {
    const m = url.match(/watch\/(sm\d+|so\d+)/);
    if (m) src = `https://embed.nicovideo.jp/watch/${m[1]}`;
  }

  if (!src && !html && !unsupported) {
    unsupported = '不支持嵌入该视频链接';
  }

  return { src, html, isVertical, isTwitter, referrerPolicy, unsupported };
}

hexo.extend.helper.register('parse_murmur_video', parseMurmurVideo);
