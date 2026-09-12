/**
 * B站视频元数据获取(文章标签与万花筒共用)
 *
 * 构建时通过 B站开放接口拿 aid/cid,用于生成与官方"分享-嵌入代码"同构的
 * isOutside=true 播放地址(外链风控概率更低)。同一 BV 进程内只请求一次。
 */
'use strict';
const https = require('https');
const http  = require('http');

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const cache = new Map(); // bvid -> { aid, cid } | null

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
        'Accept': 'application/json,text/html,*/*;q=0.8',
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
 * 获取 B站视频的 aid/cid。失败(网络/接口风控/无效 BV)返回 null。
 */
async function fetchBiliMeta(bvid) {
  if (cache.has(bvid)) return cache.get(bvid);
  let meta = null;
  try {
    const r = await httpGet(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    if (r && r.statusCode === 200) {
      const body = await readBody(r.res);
      const j = JSON.parse(body);
      if (j && j.code === 0 && j.data && j.data.aid && j.data.cid) {
        meta = { aid: j.data.aid, cid: j.data.cid };
      }
    }
  } catch (e) { meta = null; }
  cache.set(bvid, meta);
  return meta;
}

/** 生成官方"分享-嵌入代码"同构的播放地址(isOutside 形式,强制不自动播放)。 */
function buildOfficialSrc(bvid, meta) {
  return `https://player.bilibili.com/player.html?isOutside=true&aid=${meta.aid}&bvid=${bvid}&cid=${meta.cid}&p=1&autoplay=0&danmaku=0&muted=0`;
}

module.exports = { fetchBiliMeta, buildOfficialSrc };
