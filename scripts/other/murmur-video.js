/**
 * 万花筒(murmur)页面服务端视频解析 helper
 *
 * 从 murmur.pug 抽离:parseMurmurVideo 是 Hexo 生成时在 Node 端执行的
 * 模板逻辑(不是浏览器脚本),所以放在主题 scripts 目录,
 * 通过 hexo.extend.helper.register 注入 pug 模板。
 *
 * 模板用法: - var vData = parse_murmur_video(item.video)
 *
 * 返回值包含 referrerPolicy 字段,供 murmur.pug 中的 iframe 使用:
 *   - Bilibili: 'no-referrer'   (空 Referer 绕过 B 站手机端外链拦截)
 *   - 其余平台: 'strict-origin-when-cross-origin'
 *              (YouTube 自 2025-07-09 起强制要求 Referer,
 *               no-referrer 会导致 Error 153;Vimeo 等同理)
 */

function parseMurmurVideo(url) {
  if (!url) return null;
  let src = '';
  let isVertical = false;
  let isTwitter = false;

  // 默认 referrer 策略:发送 origin(不含路径),满足 YouTube/Vimeo 等要求
  // 仅 Bilibili 需要覆盖为 no-referrer
  let referrerPolicy = 'strict-origin-when-cross-origin';

  // 从 Hexo 全局配置读取站点 URL,提取 origin 与 hostname
  const _siteUrl = (() => {
    try { return new URL((hexo.config && hexo.config.url) || ''); } catch (e) { return null; }
  })();
  const siteOrigin   = _siteUrl ? _siteUrl.origin   : '';
  const siteHostname = _siteUrl ? _siteUrl.hostname  : 'localhost';

  // ==================== 中国国内平台 ====================

  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    const m = url.match(/BV([a-zA-Z0-9]+)/);
    if (m) {
      // Bilibili 手机端检测到外链 Referer 时会拦截播放;
      // 空 Referer(no-referrer)令播放器视其为直接访问,跳过拦截。
      // 仅使用官方文档参数(bvid/page/autoplay/danmaku/muted),
      // 移除非文档参数 high_quality / autopopup / allow_key_events。
      referrerPolicy = 'no-referrer';
      src = `https://player.bilibili.com/player.html?bvid=BV${m[1]}&page=1&autoplay=0&danmaku=0&muted=0`;
    }
  } else if (url.includes('acfun.cn')) {
    const m = url.match(/ac=(\d+)/) || url.match(/ac(\d+)/);
    if (m) src = `https://www.acfun.cn/player/ac${m[1]}`;
  } else if (url.includes('ixigua.com')) {
    const m = url.match(/\/(\d+)\/?/);
    if (m) src = `https://www.ixigua.com/iframe/${m[1]}?autoplay=0`;
  } else if (url.includes('huya.com')) {
    const m = url.match(/huya\.com\/(\d+)/) || url.match(/huya\.com\/([a-zA-Z0-9]+)/);
    if (m) src = `https://liveshare.huya.com/iframe/${m[1]}`;

  // ==================== 国际/国外平台 ====================

  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('shorts/')) {
      const m = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
      if (m) { videoId = m[1]; isVertical = true; }
    } else if (url.includes('v=')) {
      const m = url.match(/v=([a-zA-Z0-9_-]+)/);
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
      // youtube-nocookie.com: 隐私增强嵌入,减少跨站追踪
      // playsinline=1:       iOS Safari 内联播放,避免强制全屏
      // origin=:             告知 YouTube 来源域名,满足其 API 安全要求
      // referrerPolicy 保持 strict-origin-when-cross-origin:
      //   YouTube 自 2025-07-09 起强制要求 Referer(Error 153),
      //   no-referrer 会导致视频无法播放。
      const originParam = siteOrigin ? `&origin=${encodeURIComponent(siteOrigin)}` : '';
      src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&playsinline=1${originParam}`;
    }
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    isTwitter = true;
    src = `https://twitframe.com/show?url=${encodeURIComponent(url)}`;
  } else if (url.includes('tiktok.com')) {
    const m = url.match(/video\/(\d+)/);
    if (m) { src = `https://www.tiktok.com/embed/v2/${m[1]}`; isVertical = true; }
  } else if (url.includes('instagram.com')) {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    src = `${cleanUrl}/embed/`;
    isVertical = true;
  } else if (url.includes('twitch.tv')) {
    // Twitch 要求 parent 必须是实际嵌入页面的域名,填写 localhost 在生产环境无效
    const parent = siteHostname || 'localhost';
    if (url.includes('/videos/')) {
      const m = url.match(/videos\/(\d+)/);
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

  // 未匹配时将原链接作为 src 兜底
  return src
    ? { src, isVertical, isTwitter, referrerPolicy }
    : { src: url, isVertical: false, isTwitter: false, referrerPolicy: 'strict-origin-when-cross-origin' };
}

hexo.extend.helper.register('parse_murmur_video', parseMurmurVideo);
