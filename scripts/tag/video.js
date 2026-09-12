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
 *   - b23.tv、hy.fan : 构建时【直连】跟随 HTTP 跳转自动解析(国内链接不走代理,
 *     即使设置了 HTTPS_PROXY 也不受影响),失败时输出明确的错误提示。
 *   - Facebook share/r/、fb.watch : 构建时跟随跳转,并从跳转链或页面 og:url /
 *     videoId 中提取完整视频/Reel 地址。代理优先级:HTTPS_PROXY/HTTP_PROXY/
 *     ALL_PROXY 环境变量(http/https/socks5 均可)→ Windows 系统代理(注册表
 *     自动读取)→ 直连兜底;全部失败时输出明确的错误提示。
 *
 * 自动播放:
 *   - 所有平台默认不自动播放;虎牙(直播/录像)输出点击加载的占位卡,
 *     由前端脚本(js/video-embed.js)在点击时才插入 iframe,彻底杜绝自动播放。
 *   - 占位卡还提供"单播放"效果:点开任一视频时,前端脚本会把其它已展开的
 *     占位卡收起(其余平台无跨域控制接口,不做强制暂停)。
 *
 * 竖屏视频:
 *   - TikTok / Instagram / Facebook : 官方富卡片嵌入(embed.js / SDK 自适应高度)
 *   - YouTube Shorts 等竖屏 : 固定 280px 手机尺寸的 9:16 响应式卡片
 */

'use strict';
const https = require('https');
const http  = require('http');
const net   = require('net');
const tls   = require('tls');

/* 构建期请求使用真实浏览器 UA,Facebook 等平台对爬虫 UA 会拒绝响应 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* ─── 代理支持(环境变量 + Windows 系统代理,HTTP-CONNECT 与 SOCKS5) ───── */

let cachedSystemProxy; // undefined = 尚未探测

/** 读取 Windows 系统代理(注册表),浏览器能上网而构建机没配环境变量时兜底。 */
function getSystemProxy() {
  if (cachedSystemProxy !== undefined) return cachedSystemProxy;
  cachedSystemProxy = null;
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      const base = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
      const enableOut = execSync(`reg query "${base}" /v ProxyEnable`, { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
      if (!/0x1\b/.test(enableOut)) return cachedSystemProxy;
      const out = execSync(`reg query "${base}" /v ProxyServer`, { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
      const m = out.match(/ProxyServer\s+REG_SZ\s+(\S+)/);
      if (m) {
        const v = m[1];
        if (/^socks=/i.test(v)) {
          cachedSystemProxy = 'socks5://' + v.slice(6);
        } else if (v.includes('=')) {
          const mm = v.match(/(?:^|;)https?=([^;]+)/i);
          if (mm) cachedSystemProxy = 'http://' + mm[1];
        } else {
          cachedSystemProxy = 'http://' + v;
        }
      }
    } catch (e) { cachedSystemProxy = null; }
  }
  return cachedSystemProxy;
}

/**
 * 决定目标 URL 是否走代理及代理地址。
 * allowProxy 为 false 时恒返回 null(国内短链强制直连)。
 * 优先级:NO_PROXY 排除 → 环境变量 → Windows 系统代理。
 */
function readProxyFor(urlStr, allowProxy) {
  if (allowProxy === false) return null;
  try {
    const u = new URL(urlStr);
    const env = process.env || {};
    const host = u.hostname.toLowerCase();
    const noProxy = (env.NO_PROXY || env.no_proxy || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (noProxy.some((d) => host === d || host.endsWith(d.charAt(0) === '.' ? d : '.' + d))) return null;
    const raw = u.protocol === 'https:'
      ? (env.HTTPS_PROXY || env.https_proxy || env.ALL_PROXY || env.all_proxy)
      : (env.HTTP_PROXY || env.http_proxy || env.ALL_PROXY || env.all_proxy);
    if (raw) {
      const p = new URL(raw);
      if (['http:', 'https:', 'socks5:', 'socks5h:'].includes(p.protocol)) return raw;
    }
    return getSystemProxy();
  } catch (e) { return null; }
}

/** 解析经隧道/代理收到的原始 HTTP 响应(HTTP/1.0 请求,close 分帧,无 chunked)。 */
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

/** 在已建立的隧道 socket 上发送 GET 并收集响应,完成后以 parseRawResponse 结果回调 finish。 */
function rawRequest(sock, target, timeoutMs, finish) {
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
}

/** 经 HTTP 代理建立 CONNECT 隧道,成功 resolve 原始 socket。 */
function httpConnectTunnel(proxyStr, host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyStr);
    const socket = net.connect({ host: proxy.hostname, port: Number(proxy.port) || 80 });
    socket.setTimeout(timeoutMs);
    const fail = (msg) => { try { socket.destroy(); } catch (e) { /* ignore */ } reject(new Error(msg)); };
    socket.on('error', (e) => fail(e.message));
    socket.on('timeout', () => fail('proxy timeout'));
    socket.on('connect', () => {
      let head = `CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n`;
      if (proxy.username) {
        const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password || '')}`;
        head += `Proxy-Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n`;
      }
      head += '\r\n';
      let buf = '';
      const onData = (chunk) => {
        buf += chunk.toString('latin1');
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        socket.removeListener('data', onData);
        if (!/^HTTP\/1\.[01] 200\b/.test(buf)) return fail('proxy CONNECT rejected');
        socket.setTimeout(0);
        const rest = buf.slice(idx + 4);
        if (rest) socket.unshift(Buffer.from(rest, 'latin1'));
        resolve(socket);
      };
      socket.on('data', onData);
      socket.write(head);
    });
  });
}

/** 经 SOCKS5 代理(no-auth)连接目标,成功 resolve 原始 socket。 */
function socks5Tunnel(proxyStr, host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyStr);
    const socket = net.connect({ host: proxy.hostname, port: Number(proxy.port) || 1080 });
    socket.setTimeout(timeoutMs);
    const fail = (msg) => { try { socket.destroy(); } catch (e) { /* ignore */ } reject(new Error(msg)); };
    socket.on('error', (e) => fail(e.message));
    socket.on('timeout', () => fail('socks5 timeout'));

    let buf = Buffer.alloc(0);
    let stage = 0;
    socket.on('data', function onData(chunk) {
      buf = Buffer.concat([buf, chunk]);
      if (stage === 0) {
        if (buf.length < 2) return;
        if (buf[0] !== 0x05 || buf[1] !== 0x00) return fail('socks5 handshake failed');
        buf = buf.slice(2);
        stage = 1;
        const hostBuf = Buffer.from(host, 'latin1');
        const req = Buffer.alloc(7 + hostBuf.length);
        req[0] = 0x05; req[1] = 0x01; req[2] = 0x00; req[3] = 0x03; req[4] = hostBuf.length;
        hostBuf.copy(req, 5);
        req[req.length - 2] = (port >> 8) & 0xff;
        req[req.length - 1] = port & 0xff;
        socket.write(req);
      }
      if (stage === 1) {
        if (buf.length < 5) return;
        const atyp = buf[3];
        const addrLen = atyp === 1 ? 4 : atyp === 4 ? 16 : atyp === 3 ? buf[4] : -1;
        if (addrLen < 0) return fail('socks5 bad reply');
        const need = 4 + addrLen + 2;
        if (buf.length < need) return;
        socket.removeListener('data', onData);
        if (buf[1] !== 0x00) return fail('socks5 connection refused');
        socket.setTimeout(0);
        if (buf.length > need) socket.unshift(buf.slice(need));
        resolve(socket);
      }
    });

    socket.on('connect', () => socket.write(Buffer.from([0x05, 0x01, 0x00])));
  });
}

/**
 * 经代理请求目标 URL。
 *  - https 目标 + http(s) 代理:CONNECT 隧道 + TLS
 *  - https 目标 + socks5 代理:SOCKS5 隧道 + TLS
 *  - http  目标 + http(s) 代理:向代理直接发送绝对地址 GET
 *  - http  目标 + socks5 代理:SOCKS5 隧道
 * 返回 { statusCode, headers, body };失败返回 null。
 */
function proxiedHttpGet(urlStr, proxyStr, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let target, proxy;
    try { target = new URL(urlStr); proxy = new URL(proxyStr); } catch (e) { resolve(null); return; }
    const targetPort = Number(target.port) || (target.protocol === 'https:' ? 443 : 80);
    const proxyScheme = proxy.protocol.replace(':', '');

    // http 目标 + http(s) 代理无需隧道
    if (target.protocol === 'http:' && (proxyScheme === 'http' || proxyScheme === 'https')) {
      const socket = net.connect({ host: proxy.hostname, port: Number(proxy.port) || 80 });
      socket.setTimeout(timeoutMs);
      const finish = (r) => { try { socket.destroy(); } catch (e) { /* ignore */ } resolve(r); };
      socket.on('error', () => finish(null));
      socket.on('timeout', () => finish(null));
      socket.on('connect', () => rawRequest(socket, target, timeoutMs, finish));
      return;
    }

    const opener = (proxyScheme === 'socks5' || proxyScheme === 'socks5h')
      ? socks5Tunnel(proxyStr, target.hostname, targetPort, timeoutMs)
      : httpConnectTunnel(proxyStr, target.hostname, targetPort, timeoutMs);

    opener.then((sock) => {
      if (!sock) { resolve(null); return; }
      let settled = false;
      const finish = (r) => {
        if (settled) return;
        settled = true;
        try { sock.destroy(); } catch (e) { /* ignore */ }
        resolve(r);
      };
      if (target.protocol === 'https:') {
        const tlsSock = tls.connect({ socket: sock, servername: target.hostname, rejectUnauthorized: false });
        tlsSock.setTimeout(timeoutMs);
        tlsSock.on('error', () => finish(null));
        tlsSock.on('timeout', () => finish(null));
        tlsSock.on('secureConnect', () => rawRequest(tlsSock, target, timeoutMs, finish));
      } else {
        rawRequest(sock, target, timeoutMs, finish);
      }
    }, () => resolve(null));
  });
}

/* ─── 工具函数 ─────────────────────────────────────────────────────────── */

/** 单次 GET 请求。opts.direct=true 时强制直连。返回 { statusCode, headers, res?, body? };失败返回 null。 */
function httpGet(urlStr, timeoutMs = 8000, opts = {}) {
  const proxy = readProxyFor(urlStr, !opts.direct);
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
 * 依次请求并跟随重定向。opts.direct=true 强制直连(国内短链用)。
 * 失败时返回 { urls: [], body: '', usedProxy }(而非 null,便于调用方
 * 根据 usedProxy 决定是否回退直连重试)。
 */
async function fetchFollowRedirects(urlStr, maxHops = 6, opts = {}) {
  const allowProxy = !opts.direct;
  const usedProxy = readProxyFor(urlStr, allowProxy) !== null;
  const failResult = { urls: [], body: '', usedProxy };
  const urls = [];
  let current = urlStr.startsWith('//') ? 'https:' + urlStr : urlStr;
  for (let hop = 0; hop <= maxHops; hop++) {
    const r = await httpGet(current, 8000, opts);
    if (!r) return failResult;
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
      urls.push(current);
      if (r.res) r.res.resume();
      try { current = new URL(r.headers.location, current).href; }
      catch (e) { return failResult; }
      continue;
    }
    urls.push(current);
    const body = r.body !== undefined ? r.body : await readBody(r.res);
    return { urls, body, usedProxy };
  }
  return failResult;
}

/**
 * 跟随 HTTP/HTTPS 重定向,返回最终 URL(b23.tv、hy.fan 用,强制直连)。
 * 超时(8 s)、网络错误或超过跳转次数时返回 null。
 */
function resolveRedirect(urlStr, maxHops = 6) {
  return fetchFollowRedirects(urlStr, maxHops, { direct: true }).then(
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
      // 优先代理(环境变量/系统代理),失败且确实走过代理时再直连兜底
      const result = await fetchFollowRedirects(requestUrl);
      let resolved = extractFacebookVideoUrl(result.urls, result.body);
      if (!resolved && result.usedProxy) {
        const direct = await fetchFollowRedirects(requestUrl, 6, { direct: true });
        resolved = direct ? extractFacebookVideoUrl(direct.urls, direct.body) : '';
      }
      if (resolved) {
        url = resolved;
      } else {
        // 解析失败(FB 插件不认短链,直接嵌入只会显示"视频不可用"),
        // 输出可操作的错误提示而不是坏掉的播放器
        return `<p style="${errStyle}">[Facebook 分享短链解析失败: ${String(url)}]<br>构建时无法访问 Facebook。可尝试:① 设置环境变量 HTTPS_PROXY(如 http://127.0.0.1:7890 或 socks5://127.0.0.1:10808)后重新生成;② Windows 系统代理已开启时会自动读取;③ 或直接粘贴完整的 Reel/视频链接。</p>`;
      }
    } else {
      // b23.tv / hy.fan 为国内链接:强制直连,不走任何代理
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
    // 竖屏(YouTube Shorts 等):固定 280px 手机尺寸,9:16 响应式
    paddingBottom = '177.77%';
    maxWidth      = '280px';
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
