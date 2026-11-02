/**
 * 文章访问统计(PV/UV)客户端 — 配置见主题 config.yml 的 post_stats
 * 数据源:Cloudflare Worker + D1 统计服务(接口同 rightdoor/visitor-stats)
 *
 * 工作方式:
 *  1. 埋点:每次页面加载 GET /log?path=...(fire-and-forget,不缓存不限速)
 *     - 文章页(带 [data-stats-page])上报容器上的统计 key /posts/<hash>,
 *       与 /total 返回的 path 键一致才能计入该文章;
 *     - 其他页面(首页/归档等)上报 location.pathname,只计入全站。
 *  2. 数字:统一走 GET /total(一次返回全站 + 全部文章列表),
 *     页面上任意多篇卡片共用这一次请求。
 *  3. 减压:localStorage TTL 缓存(跨标签页/新窗口共享) + in-flight 去重 +
 *     sessionStorage 负缓存(TTL 内失败不重试,避免失败请求风暴)。
 *  4. 挂载点:[data-stats="article-pv"|"article-uv"],外层容器带 data-stats-path;
 *     初始「-」占位,成功填充数字,失败保留「-」。
 *
 * pjax 兼容:pjax 换页会重新派发 DOMContentLoaded(见 pjax-init.js),
 * 本脚本监听该事件,每次换页都会重新收集挂载点并填充。
 * 动态插入的节点(加载更多的新卡片、just-read 重建的置顶卡)由调用方
 * 触发 window.__statsRefresh() 重新填充(只填充,不重复埋点)。
 */
(function () {
  var cfg = (window.theme && window.theme.post_stats) || {};
  if (!cfg.enable || !cfg.api_base) return;

  var BASE = String(cfg.api_base).replace(/\/+$/, '');
  var TTL = Number(cfg.cache_ttl) > 0 ? Number(cfg.cache_ttl) : 5 * 60 * 1000;
  var MOCK = !!cfg.mock;

  var TOTAL_CACHE_KEY = 'visitor-stats:total';
  var FAIL_CACHE_KEY = 'visitor-stats:failed';
  var totalPromise = null;

  // ★ 与 scripts/other/stats-key.js 的哈希保持一致:
  //   供动态渲染的节点(just-read 置顶卡等)从文章真实路径反推统计 key
  window.__statsKey = function (path) {
    if (!path) return '';
    var p = String(path).replace(/^\/+|\/+$/g, '');
    var h = 0x811c9dc5;
    for (var i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return '/posts/' + h.toString(16);
  };

  // ---------- /total 缓存(localStorage,跨标签页共享,仅缓存成功结果) ----------
  function readTotalCache() {
    try {
      var raw = localStorage.getItem(TOTAL_CACHE_KEY);
      if (!raw) return null;
      var hit = JSON.parse(raw);
      if (!hit || typeof hit.t !== 'number' || !hit.data) return null;
      if (Date.now() - hit.t > TTL) return null;
      return hit.data;
    } catch (e) {
      return null;
    }
  }

  function fetchTotal() {
    if (totalPromise) return totalPromise; // in-flight 去重
    totalPromise = (async function () {
      // 负缓存:TTL 内请求失败过就不再发,挂载点保持「-」
      var failed = false;
      try {
        var failT = Number(sessionStorage.getItem(FAIL_CACHE_KEY));
        failed = failT > 0 && Date.now() - failT <= TTL;
      } catch (e) {
        /* 隐私模式等取不到就当作没有 */
      }
      if (failed) throw new Error('negative cache');

      var hit = readTotalCache();
      if (hit) return hit;

      var res = await fetch(BASE + '/total');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      try {
        localStorage.setItem(TOTAL_CACHE_KEY, JSON.stringify({ t: Date.now(), data: data }));
        sessionStorage.removeItem(FAIL_CACHE_KEY);
      } catch (e) {
        /* 存储满等可忽略 */
      }
      return data;
    })();
    // 失败后清掉 in-flight,负缓存过期后允许重试
    totalPromise.catch(function () {
      totalPromise = null;
    });
    return totalPromise;
  }

  // ---------- 埋点 ----------
  function trackVisit(path) {
    if (MOCK) return;
    fetch(BASE + '/log?path=' + encodeURIComponent(path), { keepalive: true }).catch(function () {});
  }

  // ---------- 挂载点收集与填充 ----------
  function collect() {
    var groups = new Map(); // path -> { pv: [...], uv: [...] }
    document.querySelectorAll('[data-stats]').forEach(function (el) {
      var kind = el.getAttribute('data-stats');
      if (kind !== 'article-pv' && kind !== 'article-uv') return;
      var host = el.closest('[data-stats-path]');
      var path = host && host.getAttribute('data-stats-path');
      if (!path) return;
      var g = groups.get(path);
      if (!g) groups.set(path, (g = { pv: [], uv: [] }));
      g[kind === 'article-pv' ? 'pv' : 'uv'].push(el);
    });
    return groups;
  }

  function fill(group, pv, uv) {
    var lang = document.documentElement.lang || undefined;
    var p = Number(pv) || 0;
    var u = Number(uv) || 0;
    group.pv.forEach(function (el) {
      el.textContent = p.toLocaleString(lang);
    });
    group.uv.forEach(function (el) {
      el.textContent = u.toLocaleString(lang);
    });
  }

  function fillAll(groups, data) {
    var map = {};
    (data.articles || []).forEach(function (a) {
      map[a.path] = a;
    });
    groups.forEach(function (g, path) {
      var a = map[path];
      // 未收录的文章(刚发布还没被埋点过)统一显示 0
      fill(g, a ? a.articleTotal : 0, a ? a.articleUnique : 0);
    });
  }

  function refresh(track) {
    var groups = collect();

    // 埋点:只在真实页面加载(整页 + pjax 换页)时上报一次;
    // 程序化刷新(加载更多插入卡片、置顶卡重建等)不埋点,只重新填充。
    if (track) {
      var own = document.querySelector('[data-stats-page]');
      if (own) trackVisit(own.getAttribute('data-stats-path') || location.pathname);
      else trackVisit(location.pathname);
    }

    if (!groups.size) return;

    if (MOCK) {
      // 调试模式:随机数字,不发任何请求
      setTimeout(function () {
        groups.forEach(function (g) {
          fill(g, 1 + Math.floor(Math.random() * 999), 1 + Math.floor(Math.random() * 99));
        });
      }, 300);
      return;
    }

    fetchTotal()
      .then(function (data) {
        fillAll(groups, data);
      })
      .catch(function (err) {
        // 失败:挂载点保留「-」占位
        if (err && err.message !== 'negative cache') {
          console.warn('[stats] 获取访问统计失败:', err);
        }
      });
  }

  // 供动态插入/重建节点的场景调用(加载更多、just-read 置顶卡片等):
  // 只重新收集并填充数字,不重复埋点。
  window.__statsRefresh = function () {
    refresh(false);
  };

  document.addEventListener('DOMContentLoaded', function () {
    refresh(true);
  });
})();
