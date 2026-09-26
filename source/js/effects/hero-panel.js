/**
 * hero-panel.js — 首页 Hero 特效管理器 + 控制面板(可扩展框架)
 *
 * ★ 扩展方式(新增一种特效只需三步):
 *   1. 新建 js/effects/hero-xxx.js,调用 window.HeroFX.register(def)
 *      def = { id, name, icon, defaults, controls, action?, create(layer, params, ctx) }
 *      create 返回 { destroy(), setParam(key, value), setVisible?(v) }
 *   2. layout.pug 中 hero 特效脚本区追加一行 <script defer>
 *   3. _config.yml 的 hero.effects 下加 xxx.enable 开关
 *   面板开关/滑杆/下拉控件由 controls 声明自动生成,无需写 UI 代码。
 *
 * 管理器职责:
 *   - 调色板:从 hero 背景图提取主色(无图/失败则回退随机),存入
 *     HeroFX.palette 供各特效取色(取色来自背景图片,没有图片就随机);
 *   - 参数合并:defaults ← 主题 _config.yml(hero.effects.xxx)← localStorage;
 *   - 生命周期:DOMContentLoaded(pjax 会重新派发)挂载/卸载,
 *     IntersectionObserver + visibilitychange 在 hero 离屏时暂停渲染;
 *   - 面板:默认折叠成右下角小胶囊,展开后每个特效一个可折叠分组。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "heroFX";
  var registry = []; // 特效定义(注册顺序即面板顺序)
  var mounted = null; // { layer, heroEl, panel, instances:{}, observer, onDocHidden }

  /* ── 状态持久化 ─────────────────────────────────────────────── */
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  var state = loadState();
  state.effects = state.effects || {};
  state.collapsed = state.collapsed !== false; // 默认折叠

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  /* ── 注册表 ─────────────────────────────────────────────────── */
  window.HeroFX = {
    palette: null, // [{h,s,v}] 或 null(随机);由管理器在挂载后填充
    register: function (def) {
      registry.push(def);
      // defer 脚本按序执行:管理器 boot 时特效脚本可能尚未注册,
      // 这里补一次挂载(boot 内部有幂等保护)
      if (pendingBoot || mounted || document.readyState !== "loading") boot();
    },
    _debug: function () {
      return {
        registered: registry.map(function (d) {
          return d.id;
        }),
        mounted: !!mounted,
        instances: mounted ? Object.keys(mounted.instances) : [],
        collapsed: state.collapsed,
      };
    },
  };

  var pendingBoot = false; // 已到启动点但特效尚未注册,等 register 触发

  /* ── 背景图主色提取(取色来自背景图片) ──────────────────────── */
  function rgbHue(r, g, b, max, delta) {
    var h;
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h / 360;
  }

  function extractPalette(img, cb) {
    try {
      var S = 64;
      var c = document.createElement("canvas");
      c.width = S;
      c.height = S;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, S, S);
      var d = ctx.getImageData(0, 0, S, S).data;
      var BINS = 18;
      var bins = [];
      for (var k = 0; k < BINS; k++)
        bins.push({ score: 0, s: 0, v: 0, h: 0, n: 0 });
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i] / 255,
          g = d[i + 1] / 255,
          b = d[i + 2] / 255;
        var max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          delta = max - min;
        if (max < 0.12 || delta < 0.15) continue; // 跳过暗部与近灰
        var hue = rgbHue(r, g, b, max, delta);
        var bin = bins[Math.min(BINS - 1, Math.floor(hue * BINS))];
        bin.score += delta * max; // 饱和且明亮的颜色权重高
        bin.s += max > 0 ? delta / max : 0;
        bin.v += max;
        bin.h += hue;
        bin.n++;
      }
      var picked = bins
        .filter(function (bn) {
          return bn.n > 4;
        })
        .sort(function (a, b) {
          return b.score - a.score;
        })
        .slice(0, 5);
      if (!picked.length) return cb(null);
      cb(
        picked.map(function (bn) {
          return {
            h: bn.h / bn.n,
            s: Math.min(1, (bn.s / bn.n) * 1.3 + 0.15), // 提一点饱和度,流体更好看
            v: Math.min(1, bn.v / bn.n + 0.15),
          };
        }),
      );
    } catch (e) {
      cb(null); // 图片跨域污染等异常 → 随机
    }
  }

  function buildPalette(done) {
    var settled = false;
    function finish(p) {
      if (settled) return;
      settled = true;
      window.HeroFX.palette = p;
      done();
    }
    var img = document.querySelector(".hero-background img");
    if (!img || !img.currentSrc && !img.src) return finish(null);
    var run = function () {
      extractPalette(img, finish);
    };
    if (img.complete && img.naturalWidth) run();
    else {
      img.addEventListener("load", run, { once: true });
      img.addEventListener("error", function () {
        finish(null);
      }, { once: true });
      setTimeout(function () {
        finish(null);
      }, 2000); // 图片迟迟不来的兜底
    }
  }

  /* ── 状态项初始化(每个注册特效都保证有 {on, open, params}) ──── */
  function ensureState(id) {
    if (!state.effects[id]) state.effects[id] = { on: true, open: true, params: {} };
    if (state.effects[id].on === undefined) state.effects[id].on = true;
    if (state.effects[id].open === undefined) state.effects[id].open = true;
    return state.effects[id];
  }

  /* ── 参数合并:defaults ← 主题配置 ← 本地保存 ────────────────── */
  function resolveParams(def, themeCfg) {
    var params = Object.assign({}, def.defaults || {});
    var t = themeCfg && themeCfg[def.id];
    if (t) {
      Object.keys(params).forEach(function (key) {
        if (t[key] !== undefined && t[key] !== null) params[key] = t[key];
      });
    }
    var saved = ensureState(def.id);
    if (saved.params) {
      Object.keys(params).forEach(function (key) {
        if (saved.params[key] !== undefined && saved.params[key] !== null)
          params[key] = saved.params[key];
      });
    }
    return params;
  }

  /* ── 挂载/卸载 ──────────────────────────────────────────────── */
  function boot() {
    var cfg = (window.theme && window.theme.hero && window.theme.hero.effects) || {};
    var layer = document.querySelector(".hero-fx-layer");
    if (!cfg.enable || !layer ||
        (window.__readerSettings && window.__readerSettings.hero_effects === "off")) {
      pendingBoot = false;
      unmount();
      return;
    }
    if (!registry.length) {
      // 特效脚本(defer 链上位于本脚本之后)还没注册,挂起等待
      pendingBoot = true;
      return;
    }
    pendingBoot = false;
    if (mounted) unmount(); // pjax 重复派发 DOMContentLoaded
    mount(layer, cfg);
  }

  function unmount() {
    if (!mounted) return;
    Object.keys(mounted.instances).forEach(function (id) {
      var inst = mounted.instances[id];
      if (inst) inst.destroy();
    });
    if (mounted.observer) mounted.observer.disconnect();
    if (mounted.onDocHidden) document.removeEventListener("visibilitychange", mounted.onDocHidden);
    if (mounted.onDocPointerDown)
      document.removeEventListener("pointerdown", mounted.onDocPointerDown);
    if (mounted.panel && mounted.panel.parentNode)
      mounted.panel.parentNode.removeChild(mounted.panel);
    mounted = null;
  }

  function mount(layer, cfg) {
    var heroEl = layer.closest(".hero-section") || layer.parentNode;
    mounted = { layer: layer, heroEl: heroEl, instances: {} };

    buildPalette(function () {
      if (!mounted) return; // 期间被卸载(pjax 快速切页)
      try {
        createPanel(cfg);
      } catch (e) {
        console.error("[HeroFX] 面板创建失败:", e);
      }
      startEffects(cfg);
      watchVisibility();
    });
  }

  function startEffects(cfg) {
    var activeId = null;
    registry.some(function (def) {
      var t = cfg[def.id] || {};
      var st = ensureState(def.id);
      if (t.enable !== false && st.on !== false) {
        activeId = def.id;
        return true;
      }
      return false;
    });

    // 多种视觉特效互斥:兼容旧版 localStorage 时只保留注册顺序中第一个开启项。
    registry.forEach(function (def) {
      var st = ensureState(def.id);
      st.on = activeId === def.id;
    });
    saveState();

    if (mounted && mounted.switches) {
      registry.forEach(function (def) {
        if (mounted.switches[def.id])
          mounted.switches[def.id].checked = activeId === def.id;
      });
    }

    if (!activeId) return;
    registry.forEach(function (def) {
      var t = cfg[def.id] || {};
      if (t.enable === false) return; // 主题配置里显式关闭
      var st = ensureState(def.id);
      if (def.id !== activeId || st.on === false) return; // 读者在面板里关掉
      createInstance(def, cfg);
    });
  }

  function createInstance(def, cfg) {
    if (mounted.instances[def.id]) return;
    var params = resolveParams(def, cfg);
    var ctx = {
      heroEl: mounted.heroEl,
      palette: function () {
        return window.HeroFX.palette;
      },
      reducedMotion: window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    };
    try {
      var inst = def.create(mounted.layer, params, ctx);
      mounted.instances[def.id] = inst;
    } catch (e) {
      // WebGL 不可用等情况:记录后静默,面板里仍可重试开启
      console.error("[HeroFX] " + def.id + " 启动失败:", e);
    }
  }

  function destroyInstance(id) {
    var inst = mounted && mounted.instances[id];
    if (inst) {
      inst.destroy();
      delete mounted.instances[id];
    }
  }

  function watchVisibility() {
    var io = new IntersectionObserver(
      function (entries) {
        var visible = entries[0] && entries[0].isIntersecting;
        Object.keys(mounted.instances).forEach(function (id) {
          var inst = mounted.instances[id];
          if (inst && typeof inst.setVisible === "function")
            inst.setVisible(visible && !document.hidden);
        });
      },
      { threshold: 0.02 },
    );
    io.observe(mounted.heroEl);
    mounted.observer = io;

    mounted.onDocHidden = function () {
      var visible = !document.hidden;
      Object.keys(mounted.instances).forEach(function (id) {
        var inst = mounted.instances[id];
        if (inst && typeof inst.setVisible === "function")
          inst.setVisible(visible);
      });
    };
    document.addEventListener("visibilitychange", mounted.onDocHidden);
  }

  /* ── 控制面板 UI ────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function createPanel(cfg) {
    if (cfg.panel_enable === false) return;

    var panel = el("div", "hero-fx-panel");
    var toggle = el("button", "hero-fx-toggle", "✦ 特效");
    toggle.type = "button";
    toggle.setAttribute("aria-label", "首页特效面板");
    toggle.setAttribute("aria-expanded", "false");

    var body = el("div", "hero-fx-body");
    var head = el("div", "hero-fx-head");
    head.appendChild(el("span", "hero-fx-title", "首页特效"));
    var closeBtn = el("button", "hero-fx-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "收起面板");
    head.appendChild(closeBtn);
    body.appendChild(head);

    var list = el("div", "hero-fx-list");

    var switches = {};
    mounted.switches = switches;

    registry.forEach(function (def) {
      var t = cfg[def.id] || {};
      var disabledByTheme = t.enable === false;
      var st = ensureState(def.id);

      var item = el("div", "hero-fx-item");
      item.setAttribute("data-fx", def.id);

      var itemHead = el("div", "hero-fx-item-head");
      var nameWrap = el("button", "hero-fx-item-name");
      nameWrap.type = "button";
      nameWrap.appendChild(el("span", "hero-fx-item-icon", def.icon || "✦"));
      nameWrap.appendChild(el("span", "hero-fx-item-text", def.name));
      var chev = el("span", "hero-fx-chevron", "▾");
      nameWrap.appendChild(chev);
      itemHead.appendChild(nameWrap);

      var sw = el("label", "hero-fx-switch");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !disabledByTheme && st.on !== false;
      cb.disabled = disabledByTheme;
      switches[def.id] = cb;
      sw.appendChild(cb);
      sw.appendChild(el("span", "hero-fx-slider"));
      itemHead.appendChild(sw);
      item.appendChild(itemHead);

      var itemBody = el("div", "hero-fx-item-body");
      if (!st.open) item.classList.add("collapsed");

      (def.controls || []).forEach(function (ctl) {
        itemBody.appendChild(buildControl(def, ctl, cfg));
      });
      item.appendChild(itemBody);

      // 开关:销毁/重建实例
      cb.addEventListener("change", function () {
        if (cb.checked) {
          // 开启一个特效时关闭其他特效,但允许全部关闭。
          registry.forEach(function (other) {
            var otherState = ensureState(other.id);
            otherState.on = other.id === def.id;
            if (switches[other.id]) switches[other.id].checked = other.id === def.id;
            if (other.id !== def.id) destroyInstance(other.id);
          });
        } else {
          st.on = false;
        }
        saveState();
        if (cb.checked) createInstance(def, cfg);
        else destroyInstance(def.id);
      });
      // 折叠分组
      nameWrap.addEventListener("click", function () {
        item.classList.toggle("collapsed");
        st.open = !item.classList.contains("collapsed");
        saveState();
      });

      list.appendChild(item);
    });

    body.appendChild(list);
    panel.appendChild(toggle);
    panel.appendChild(body);
    if (state.collapsed) panel.classList.add("collapsed");
    toggle.setAttribute("aria-expanded", String(!state.collapsed));
    mounted.panel = panel;
    // 面板放到 hero 容器本身,避免被特效层的 stacking context 压在标题文字下面。
    // 画布仍留在 .hero-fx-layer 中,只让控制面板浮到文字之上。
    mounted.heroEl.appendChild(panel);

    function setCollapsed(c) {
      state.collapsed = c;
      panel.classList.toggle("collapsed", c);
      toggle.setAttribute("aria-expanded", String(!c));
      saveState();
    }
    toggle.addEventListener("click", function () {
      setCollapsed(!panel.classList.contains("collapsed"));
    });
    closeBtn.addEventListener("click", function () {
      setCollapsed(true);
    });

    // 点击面板外部区域自动收起;面板和“特效”按钮内部点击不受影响。
    mounted.onDocPointerDown = function (event) {
      if (!panel.contains(event.target)) setCollapsed(true);
    };
    document.addEventListener("pointerdown", mounted.onDocPointerDown);
  }

  function buildControl(def, ctl, cfg) {
    var row = el("div", "hero-fx-ctl");

    if (ctl.type === "button") {
      var btn = el("button", "hero-fx-btn", ctl.label);
      btn.type = "button";
      btn.addEventListener("click", function () {
        var inst = mounted && mounted.instances[def.id];
        if (inst && typeof def.action === "function")
          def.action(inst, resolveParams(def, cfg));
      });
      row.appendChild(btn);
      return row;
    }

    row.appendChild(el("span", "hero-fx-ctl-label", ctl.label));

    var input;
    if (ctl.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!resolveParams(def, cfg)[ctl.key];
      row.appendChild(input);
    } else if (ctl.type === "select") {
      input = document.createElement("select");
      (ctl.options || []).forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt[0];
        o.textContent = opt[1];
        input.appendChild(o);
      });
      input.value = String(resolveParams(def, cfg)[ctl.key]);
      row.appendChild(input);
    } else {
      // range
      var val = resolveParams(def, cfg)[ctl.key];
      input = document.createElement("input");
      input.type = "range";
      input.min = ctl.min != null ? ctl.min : 0;
      input.max = ctl.max != null ? ctl.max : 1;
      input.step = ctl.step != null ? ctl.step : 0.01;
      input.value = val;
      var readout = el("span", "hero-fx-val", fmtVal(val, ctl.step));
      row.appendChild(input);
      row.appendChild(readout);
      input.addEventListener("input", function () {
        readout.textContent = fmtVal(input.value, ctl.step);
      });
    }

    input.addEventListener("input", function () {
      applyParam(def, ctl, input, cfg);
    });
    input.addEventListener("change", function () {
      applyParam(def, ctl, input, cfg);
    });
    return row;
  }

  function fmtVal(v, step) {
    var n = step >= 1 || step == null ? 0 : String(step).split(".")[1].length;
    return Number(v).toFixed ? Number(v).toFixed(Math.min(n, 2)) : v;
  }

  function applyParam(def, ctl, input, cfg) {
    var v;
    if (ctl.type === "checkbox") v = input.checked;
    else if (ctl.type === "select" || ctl.type === "button") v = input.value;
    else v = parseFloat(input.value);
    var st = state.effects[def.id];
    st.params = st.params || {};
    st.params[ctl.key] = v;
    saveState();
    var inst = mounted && mounted.instances[def.id];
    if (inst) inst.setParam(ctl.key, v);
  }

  /* ── 启动 ───────────────────────────────────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
