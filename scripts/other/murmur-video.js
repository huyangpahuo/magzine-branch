/**
 * 万花筒(murmur)页面服务端视频解析 helper
 *
 * 从 murmur.pug 抽离:parseMurmurVideo 是 Hexo 生成时在 Node 端执行的
 * 模板逻辑(不是浏览器脚本),所以放在主题 scripts 目录,
 * 通过 hexo.extend.helper.register 注入 pug 模板。
 *
 * 模板用法: - var vData = parse_murmur_video(item.video)
 */

function parseMurmurVideo(url) {
  if (!url) return null;
  let src = '';
  let isVertical = false;
  let isTwitter = false;

  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    const m = url.match(/BV([a-zA-Z0-9]+)/);
    if (m) {
      // 必须用 https: 绝对协议:协议相对(//)地址在部分手机浏览器/WebView 里
      // 会被 B 站播放器拒绝加载(电脑端正常,手机端黑屏/无法解析)。
      // autopopup=0 禁止跳出 App,移动端可内联播放。
      src = `https://player.bilibili.com/player.html?bvid=BV${m[1]}&page=1&autoplay=0&autopopup=0&high_quality=1&danmaku=0&allow_key_events=1`;
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
    } else if (url.includes('embed/')) { // 增强：支持直接粘贴的 embed 链接
      const m = url.match(/embed\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    } else if (url.includes('live/')) { // 增强：支持 YouTube 直播回放链接
      const m = url.match(/live\/([a-zA-Z0-9_-]+)/);
      if (m) videoId = m[1];
    }

    if (videoId) {
      // 优化 1: 使用 youtube-nocookie 绕过移动端隐私拦截
      // 优化 2: 添加 playsinline=1 确保 iOS 端可以内联播放
      src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&playsinline=1`;
    }
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    isTwitter = true;
    src = `https://twitframe.com/show?url=${encodeURIComponent(url)}`;
  } else if (url.includes('tiktok.com')) {
    const m = url.match(/video\/(\d+)/);
    if (m) { src = `https://www.tiktok.com/embed/v2/${m[1]}`; isVertical = true; }
  } else if (url.includes('instagram.com')) {
    let cleanUrl = url.split('?')[0].replace(/\/$/, "");
    src = `${cleanUrl}/embed/`;
    isVertical = true;
  } else if (url.includes('twitch.tv')) {
    let videoId = '', channel = '';
    if (url.includes('/videos/')) {
       const m = url.match(/videos\/(\d+)/);
       if (m) videoId = m[1];
       src = `https://player.twitch.tv/?video=${videoId}&parent=localhost&autoplay=false`;
    } else {
       const m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
       if (m) channel = m[1];
       src = `https://player.twitch.tv/?channel=${channel}&parent=localhost&autoplay=false`;
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

  // 如果没有匹配上，则将原链接当做 src 处理（作为 Fallback）
  return src ? { src, isVertical, isTwitter } : { src: url, isVertical: false, isTwitter: false };
}

hexo.extend.helper.register('parse_murmur_video', parseMurmurVideo);
