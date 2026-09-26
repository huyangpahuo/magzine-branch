/**
 * hero-fluid.js — WebGL 流体模拟特效(hero 专用)
 *
 * 原始实现:https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
 * MIT License © 2017 Pavel Dobryakov
 *
 * 适配改动(其余物理/渲染逻辑与原版一致):
 *   - 移除 demo 专属代码(dat.GUI/promo/截图/棋盘格背景);
 *   - 画布透明合成(TRANSPARENT)叠在 hero 背景图上;
 *   - 取色:通过 ctx.palette() 使用 hero 背景图主色调色板,
 *     无图/失败自动回退随机彩色;
 *   - 交互:监听 hero 区域(非画布),鼠标悬停即可产生流体;
 *   - 抖动纹理改为程序生成(原版从仓库加载 LDR_LLL1_0.png);
 *   - 生命周期:可暂停(离屏/后台)、可销毁重建(面板开关)、参数热更新;
 *   - pjax:面板管理器负责挂载/卸载,这里只管一块画布的生死。
 */
(function () {
  "use strict";

  if (!window.HeroFX) return;

  var CONTROLS = [
    {
      key: "color_source",
      label: "取色",
      type: "select",
      options: [["image", "背景图主色"], ["random", "随机彩色"]],
    },
    {
      key: "quality",
      label: "质量",
      type: "select",
      options: [["high", "高"], ["medium", "中"], ["low", "低"]],
    },
    { key: "curl", label: "涡旋强度", type: "range", min: 0, max: 50, step: 1 },
    {
      key: "splat_radius",
      label: "笔刷大小",
      type: "range",
      min: 0.05,
      max: 1,
      step: 0.05,
    },
    {
      key: "density_dissipation",
      label: "消散速度",
      type: "range",
      min: 0,
      max: 4,
      step: 0.1,
    },
    { key: "hover", label: "悬停触发", type: "checkbox" },
    { key: "bloom", label: "辉光", type: "checkbox" },
    { key: "__splats", label: "随机喷发", type: "button" },
  ];

  var DEFAULTS = {
    color_source: "image",
    quality: "high",
    curl: 30,
    splat_radius: 0.25,
    density_dissipation: 1,
    velocity_dissipation: 0.2,
    hover: true,
    idle_splat: false,
    bloom: false,
  };

  window.HeroFX.register({
    id: "fluid",
    name: "流体模拟",
    icon: "🌊",
    defaults: DEFAULTS,
    controls: CONTROLS,
    action: function (inst) {
      if (inst && inst.randomSplats) inst.randomSplats(8);
    },
    create: createFluid,
  });

  function createFluid(layer, params, ctx) {
    /* ═══════════════ 配置(原版 config 的子集 + 适配项) ═══════════════ */
    var config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      DENSITY_DISSIPATION: params.density_dissipation,
      VELOCITY_DISSIPATION: params.velocity_dissipation,
      PRESSURE: 0.8,
      PRESSURE_ITERATIONS: 20,
      CURL: params.curl,
      SPLAT_RADIUS: params.splat_radius,
      SPLAT_FORCE: 6000,
      SHADING: true,
      COLORFUL: true,
      COLOR_UPDATE_SPEED: 10,
      PAUSED: false,
      BACK_COLOR: { r: 0, g: 0, b: 0 },
      TRANSPARENT: true,
      BLOOM_ITERATIONS: 8,
      BLOOM_RESOLUTION: 256,
      BLOOM_INTENSITY: 0.8,
      BLOOM_THRESHOLD: 0.6,
      BLOOM_SOFT_KNEE: 0.7,
      SUNRAYS: false,
      SUNRAYS_RESOLUTION: 196,
      SUNRAYS_WEIGHT: 1.0,
    };

    var opts = {
      hover: params.hover !== false,
      // 空闲时不自动喷发;流体只由悬停/触摸交互或面板按钮触发。
      idleSplat: false,
      colorSource: params.color_source || "image",
      quality: params.quality || "high",
    };

    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* ═══════════════ 画布 ═══════════════ */
    var canvas = document.createElement("canvas");
    canvas.className = "hero-fx-canvas";
    layer.appendChild(canvas);

    var heroEl = ctx.heroEl;

    var gl = canvas.getContext("webgl", {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      canvas.remove();
      return { destroy: function () {}, setParam: function () {} };
    }

    var ext = getExtension(gl);
    if (!ext || !ext.halfFloatTexType || !ext.formatRGBA) {
      // 半浮点纹理不可用(极老旧设备):静默退出
      canvas.remove();
      return { destroy: function () {}, setParam: function () {} };
    }
    if (!ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 256;
      config.SHADING = false;
      config.BLOOM = false;
      config.SUNRAYS = false;
    }

    /* ═══════════════ Shaders(原版) ═══════════════ */
    var baseVertexShader = compileShader(
      gl.VERTEX_SHADER,
      "\n    precision highp float;\n    attribute vec2 aPosition;\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform vec2 texelSize;\n    void main () {\n        vUv = aPosition * 0.5 + 0.5;\n        vL = vUv - vec2(texelSize.x, 0.0);\n        vR = vUv + vec2(texelSize.x, 0.0);\n        vT = vUv + vec2(0.0, texelSize.y);\n        vB = vUv - vec2(0.0, texelSize.y);\n        gl_Position = vec4(aPosition, 0.0, 1.0);\n    }\n",
    );

    var blurVertexShader = compileShader(
      gl.VERTEX_SHADER,
      "\n    precision highp float;\n    attribute vec2 aPosition;\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    uniform vec2 texelSize;\n    void main () {\n        vUv = aPosition * 0.5 + 0.5;\n        float offset = 1.33333333;\n        vL = vUv - texelSize * offset;\n        vR = vUv + texelSize * offset;\n        gl_Position = vec4(aPosition, 0.0, 1.0);\n    }\n",
    );

    var blurShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    uniform sampler2D uTexture;\n    uniform vec2 curve;\n    void main () {\n        vec4 sum = texture2D(uTexture, vUv) * 0.29411764;\n        sum += texture2D(uTexture, vL) * 0.35294117;\n        sum += texture2D(uTexture, vR) * 0.35294117;\n        gl_FragColor = sum;\n    }\n",
    );

    var copyShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying highp vec2 vUv;\n    uniform sampler2D uTexture;\n    void main () {\n        gl_FragColor = texture2D(uTexture, vUv);\n    }\n",
    );

    var clearShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying highp vec2 vUv;\n    uniform sampler2D uTexture;\n    uniform float value;\n    void main () {\n        gl_FragColor = value * texture2D(uTexture, vUv);\n    }\n",
    );

    var colorShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    uniform vec4 color;\n    void main () {\n        gl_FragColor = color;\n    }\n",
    );

    var bloomPrefilterShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying vec2 vUv;\n    uniform sampler2D uTexture;\n    uniform vec3 curve;\n    uniform float threshold;\n    void main () {\n        vec3 c = texture2D(uTexture, vUv).rgb;\n        float br = max(c.r, max(c.g, c.b));\n        float rq = clamp(br - curve.x, 0.0, curve.y);\n        rq = curve.z * rq * rq;\n        c *= max(rq, br - threshold) / max(br, 0.0001);\n        gl_FragColor = vec4(c, 0.0);\n    }\n",
    );

    var bloomBlurShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uTexture;\n    void main () {\n        vec4 sum = vec4(0.0);\n        sum += texture2D(uTexture, vL);\n        sum += texture2D(uTexture, vR);\n        sum += texture2D(uTexture, vT);\n        sum += texture2D(uTexture, vB);\n        sum *= 0.25;\n        gl_FragColor = sum;\n    }\n",
    );

    var bloomFinalShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uTexture;\n    uniform float intensity;\n    void main () {\n        vec4 sum = vec4(0.0);\n        sum += texture2D(uTexture, vL);\n        sum += texture2D(uTexture, vR);\n        sum += texture2D(uTexture, vT);\n        sum += texture2D(uTexture, vB);\n        sum *= 0.25;\n        gl_FragColor = sum * intensity;\n    }\n",
    );

    var sunraysMaskShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision highp float;\n    precision highp sampler2D;\n    varying vec2 vUv;\n    uniform sampler2D uTexture;\n    void main () {\n        vec4 c = texture2D(uTexture, vUv);\n        float br = max(c.r, max(c.g, c.b));\n        c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);\n        gl_FragColor = c;\n    }\n",
    );

    var sunraysShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision highp float;\n    precision highp sampler2D;\n    varying vec2 vUv;\n    uniform sampler2D uTexture;\n    uniform float weight;\n    #define ITERATIONS 16\n    void main () {\n        float Density = 0.3;\n        float Decay = 0.95;\n        float Exposure = 0.7;\n        vec2 coord = vUv;\n        vec2 dir = vUv - 0.5;\n        dir *= 1.0 / float(ITERATIONS) * Density;\n        float illuminationDecay = 1.0;\n        float color = texture2D(uTexture, vUv).a;\n        for (int i = 0; i < ITERATIONS; i++)\n        {\n            coord -= dir;\n            float col = texture2D(uTexture, coord).a;\n            color += col * illuminationDecay * weight;\n            illuminationDecay *= Decay;\n        }\n        gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);\n    }\n",
    );

    var splatShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision highp float;\n    precision highp sampler2D;\n    varying vec2 vUv;\n    uniform sampler2D uTarget;\n    uniform float aspectRatio;\n    uniform vec3 color;\n    uniform vec2 point;\n    uniform float radius;\n    void main () {\n        vec2 p = vUv - point.xy;\n        p.x *= aspectRatio;\n        vec3 splat = exp(-dot(p, p) / radius) * color;\n        vec3 base = texture2D(uTarget, vUv).xyz;\n        gl_FragColor = vec4(base + splat, 1.0);\n    }\n",
    );

    var advectionShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision highp float;\n    precision highp sampler2D;\n    varying vec2 vUv;\n    uniform sampler2D uVelocity;\n    uniform sampler2D uSource;\n    uniform vec2 texelSize;\n    uniform vec2 dyeTexelSize;\n    uniform float dt;\n    uniform float dissipation;\n    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {\n        vec2 st = uv / tsize - 0.5;\n        vec2 iuv = floor(st);\n        vec2 fuv = fract(st);\n        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) / tsize);\n        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) / tsize);\n        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) / tsize);\n        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) / tsize);\n        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);\n    }\n    void main () {\n    #ifdef MANUAL_FILTERING\n        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;\n        vec4 result = bilerp(uSource, coord, dyeTexelSize);\n    #else\n        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;\n        vec4 result = texture2D(uSource, coord);\n    #endif\n        float decay = 1.0 + dissipation * dt;\n        gl_FragColor = result / decay;\n    }\n",
      ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"],
    );

    var divergenceShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uVelocity;\n    void main () {\n        float L = texture2D(uVelocity, vL).x;\n        float R = texture2D(uVelocity, vR).x;\n        float T = texture2D(uVelocity, vT).y;\n        float B = texture2D(uVelocity, vB).y;\n        vec2 C = texture2D(uVelocity, vUv).xy;\n        if (vL.x < 0.0) { L = -C.x; }\n        if (vR.x > 1.0) { R = -C.x; }\n        if (vT.y > 1.0) { T = -C.y; }\n        if (vB.y < 0.0) { B = -C.y; }\n        float div = 0.5 * (R - L + T - B);\n        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);\n    }\n",
    );

    var curlShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uVelocity;\n    void main () {\n        float L = texture2D(uVelocity, vL).y;\n        float R = texture2D(uVelocity, vR).y;\n        float T = texture2D(uVelocity, vT).x;\n        float B = texture2D(uVelocity, vB).x;\n        float vorticity = R - L - T + B;\n        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);\n    }\n",
    );

    var vorticityShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision highp float;\n    precision highp sampler2D;\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uVelocity;\n    uniform sampler2D uCurl;\n    uniform float curl;\n    uniform float dt;\n    void main () {\n        float L = texture2D(uCurl, vL).x;\n        float R = texture2D(uCurl, vR).x;\n        float T = texture2D(uCurl, vT).x;\n        float B = texture2D(uCurl, vB).x;\n        float C = texture2D(uCurl, vUv).x;\n        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n        force /= length(force) + 0.0001;\n        force *= curl * C;\n        force.y *= -1.0;\n        vec2 velocity = texture2D(uVelocity, vUv).xy;\n        velocity += force * dt;\n        velocity = min(max(velocity, -1000.0), 1000.0);\n        gl_FragColor = vec4(velocity, 0.0, 1.0);\n    }\n",
    );

    var pressureShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uPressure;\n    uniform sampler2D uDivergence;\n    void main () {\n        float L = texture2D(uPressure, vL).x;\n        float R = texture2D(uPressure, vR).x;\n        float T = texture2D(uPressure, vT).x;\n        float B = texture2D(uPressure, vB).x;\n        float C = texture2D(uPressure, vUv).x;\n        float divergence = texture2D(uDivergence, vUv).x;\n        float pressure = (L + R + B + T - divergence) * 0.25;\n        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);\n    }\n",
    );

    var gradientSubtractShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision mediump float;\n    precision mediump sampler2D;\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uPressure;\n    uniform sampler2D uVelocity;\n    void main () {\n        float L = texture2D(uPressure, vL).x;\n        float R = texture2D(uPressure, vR).x;\n        float T = texture2D(uPressure, vT).x;\n        float B = texture2D(uPressure, vB).x;\n        vec2 velocity = texture2D(uVelocity, vUv).xy;\n        velocity.xy -= vec2(R - L, T - B);\n        gl_FragColor = vec4(velocity, 0.0, 1.0);\n    }\n",
    );

    // 适配说明:画布 CSS 使用 mix-blend-mode: screen(叠光),染料只向
    // 背景图"加光",不会产生暗色蒙版;特效自身不透明度保持原版 100%。
    var displayShader = compileShader(
      gl.FRAGMENT_SHADER,
      "\n    precision highp float;\n    precision highp sampler2D;\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uTexture;\n    uniform sampler2D uBloom;\n    uniform sampler2D uSunrays;\n    uniform sampler2D uDithering;\n    uniform vec2 ditherScale;\n    uniform vec2 texelSize;\n    vec3 linearToGamma (vec3 color) {\n        color = max(color, vec3(0));\n        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));\n    }\n    void main () {\n        vec3 c = texture2D (uTexture, vUv).rgb;\n    #ifdef SHADING\n        vec3 lc = texture2D (uTexture, vL).rgb;\n        vec3 rc = texture2D (uTexture, vR).rgb;\n        vec3 tc = texture2D (uTexture, vT).rgb;\n        vec3 bc = texture2D (uTexture, vB).rgb;\n        float dx = length(rc) - length(lc);\n        float dy = length(tc) - length(bc);\n        vec3 n = normalize(vec3(dx, dy, length(texelSize)));\n        vec3 l = vec3(0.0, 0.0, 1.0);\n        float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);\n        c *= diffuse;\n    #endif\n    #ifdef BLOOM\n        vec3 bloom = texture2D (uBloom, vUv).rgb;\n    #endif\n    #ifdef SUNRAYS\n        float sunrays = texture2D (uSunrays, vUv).r;\n        c *= sunrays;\n    #endif\n    #ifdef BLOOM\n        float noise = texture2D (uDithering, vUv * ditherScale).r;\n        noise = noise * 2.0 - 1.0;\n        bloom += noise / 255.0;\n        bloom = linearToGamma (bloom);\n        c += bloom;\n    #endif\n        float a = max (c.r, max (c.g, c.b));\n        gl_FragColor = vec4 (c, a);\n    }\n",
    );

    /* ═══════════════ WebGL 基础设施(原版) ═══════════════ */
    var blit = (function () {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW,
      );
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array([0, 1, 2, 0, 2, 3]),
        gl.STATIC_DRAW,
      );
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return function (target) {
        if (target == null) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    /* ═══════════════ Programs/Materials/FBO(原版) ═══════════════ */
    var blurProgram = new Program(blurVertexShader, blurShader);
    var copyProgram = new Program(baseVertexShader, copyShader);
    var clearProgram = new Program(baseVertexShader, clearShader);
    var colorProgram = new Program(baseVertexShader, colorShader);
    var bloomPrefilterProgram = new Program(
      baseVertexShader,
      bloomPrefilterShader,
    );
    var bloomBlurProgram = new Program(baseVertexShader, bloomBlurShader);
    var bloomFinalProgram = new Program(baseVertexShader, bloomFinalShader);
    var sunraysMaskProgram = new Program(baseVertexShader, sunraysMaskShader);
    var sunraysProgram = new Program(baseVertexShader, sunraysShader);
    var splatProgram = new Program(baseVertexShader, splatShader);
    var advectionProgram = new Program(baseVertexShader, advectionShader);
    var divergenceProgram = new Program(baseVertexShader, divergenceShader);
    var curlProgram = new Program(baseVertexShader, curlShader);
    var vorticityProgram = new Program(baseVertexShader, vorticityShader);
    var pressureProgram = new Program(baseVertexShader, pressureShader);
    var gradienSubtractProgram = new Program(
      baseVertexShader,
      gradientSubtractShader,
    );
    var displayMaterial = new Material(baseVertexShader, displayShader);

    /* ═══════════════ 帧缓冲 ═══════════════ */
    var dye, velocity, divergence, curl, pressure, bloom, ditheringTexture, bloomFramebuffers = [], sunrays, sunraysTemp;

    var lastUpdateTime = Date.now();
    var colorUpdateTimer = 0;

    var pointers = [new PointerData()];
    var touchPointers = {}; // identifier → PointerData

    var windowResizeHandler = function () {
      resizeCanvas();
    };
    window.addEventListener("resize", windowResizeHandler);

    /* ═══════════════ 交互:监听 hero 区域 ═══════════════ */
    var heroMouseDown = function (e) {
      // 面板上的操作不触发喷溅
      if (e.target.closest && e.target.closest(".hero-fx-panel")) return;
      var pointer = pointers[0];
      var pos = eventPos(e);
      if (pos.x < 0 || pos.y < 0 || pos.x > canvas.width || pos.y > canvas.height)
        return;
      // 只记录按下位置,不额外喷发:点击瞬间蹦出一大团染料会把
      // 背景图盖黑再消散,视觉上就是"图片闪黑"。拖动才会有流体。
      updatePointerDownData(pointer, -1, pos.x, pos.y);
    };
    var windowMouseUp = function () {
      pointers[0].down = false;
    };
    var heroMouseMove = function (e) {
      if (e.target.closest && e.target.closest(".hero-fx-panel")) return;
      var pointer = pointers[0];
      var pos = eventPos(e);
      if (!pointer.down && !opts.hover) return;
      if (pos.x < 0 || pos.y < 0 || pos.x > canvas.width || pos.y > canvas.height) {
        pointer.down = false;
        return;
      }
      // hover 模式:无按下也标记 moved,使 applyInputs 产生流体
      updatePointerMoveData(pointer, pos.x, pos.y);
    };
    // 触摸:passive,不阻止页面滚动;划过 hero 即产生流体
    var heroTouchStart = function (e) {
      for (var i = 0; i < e.targetTouches.length; i++) {
        var t = e.targetTouches[i];
        var p = (touchPointers[t.identifier] = new PointerData());
        var pos = eventPos(t);
        updatePointerDownData(p, t.identifier, pos.x, pos.y);
      }
    };
    var heroTouchMove = function (e) {
      for (var i = 0; i < e.targetTouches.length; i++) {
        var t = e.targetTouches[i];
        var p = touchPointers[t.identifier];
        if (!p) continue;
        var pos = eventPos(t);
        updatePointerMoveData(p, pos.x, pos.y);
      }
    };
    var heroTouchEnd = function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        delete touchPointers[e.changedTouches[i].identifier];
      }
    };

    heroEl.addEventListener("mousedown", heroMouseDown);
    window.addEventListener("mouseup", windowMouseUp);
    heroEl.addEventListener("mousemove", heroMouseMove);
    heroEl.addEventListener("touchstart", heroTouchStart, { passive: true });
    heroEl.addEventListener("touchmove", heroTouchMove, { passive: true });
    heroEl.addEventListener("touchend", heroTouchEnd);

    var running = true;
    var visible = true;

    /* ═══════════════ 帧循环 ═══════════════ */
    function frame() {
      if (!running) return;
      if (!visible || document.hidden) {
        lastUpdateTime = Date.now();
        requestAnimationFrame(frame);
        return;
      }
      var dt = calcDeltaTime();
      if (resizeCanvas()) initFramebuffers();
      updateColors(dt);
      applyInputs();
      if (!config.PAUSED) step(dt);
      render(null);
      requestAnimationFrame(frame);
    }

    function calcDeltaTime() {
      var now = Date.now();
      var dt = (now - lastUpdateTime) / 1000;
      dt = Math.min(dt, 0.016666);
      lastUpdateTime = now;
      return dt;
    }

    function resizeCanvas() {
      var width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      var height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        return true;
      }
      return false;
    }

    function updateColors(dt) {
      if (!config.COLORFUL) return;
      colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        for (var i = 0; i < pointers.length; i++) pointers[i].color = generateColor();
      }
    }

    function applyInputs() {
      var i, p;
      for (i = 0; i < pointers.length; i++) {
        p = pointers[i];
        if (p.moved) {
          p.moved = false;
          splatPointer(p);
        }
      }
      var ids = Object.keys(touchPointers);
      for (i = 0; i < ids.length; i++) {
        p = touchPointers[ids[i]];
        if (p && p.moved) {
          p.moved = false;
          splatPointer(p);
        }
      }
    }

    function step(dt) {
      gl.disable(gl.BLEND);

      curlProgram.bind();
      gl.uniform2f(
        curlProgram.uniforms.texelSize,
        velocity.texelSizeX,
        velocity.texelSizeY,
      );
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      vorticityProgram.bind();
      gl.uniform2f(
        vorticityProgram.uniforms.texelSize,
        velocity.texelSizeX,
        velocity.texelSizeY,
      );
      gl.uniform1i(
        vorticityProgram.uniforms.uVelocity,
        velocity.read.attach(0),
      );
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      divergenceProgram.bind();
      gl.uniform2f(
        divergenceProgram.uniforms.texelSize,
        velocity.texelSizeX,
        velocity.texelSizeY,
      );
      gl.uniform1i(
        divergenceProgram.uniforms.uVelocity,
        velocity.read.attach(0),
      );
      blit(divergence);

      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      blit(pressure.write);
      pressure.swap();

      pressureProgram.bind();
      gl.uniform2f(
        pressureProgram.uniforms.texelSize,
        velocity.texelSizeX,
        velocity.texelSizeY,
      );
      gl.uniform1i(
        pressureProgram.uniforms.uDivergence,
        divergence.attach(0),
      );
      for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      gradienSubtractProgram.bind();
      gl.uniform2f(
        gradienSubtractProgram.uniforms.texelSize,
        velocity.texelSizeX,
        velocity.texelSizeY,
      );
      gl.uniform1i(
        gradienSubtractProgram.uniforms.uPressure,
        pressure.read.attach(0),
      );
      gl.uniform1i(
        gradienSubtractProgram.uniforms.uVelocity,
        velocity.read.attach(1),
      );
      blit(velocity.write);
      velocity.swap();

      advectionProgram.bind();
      gl.uniform2f(
        advectionProgram.uniforms.texelSize,
        velocity.texelSizeX,
        velocity.texelSizeY,
      );
      if (!ext.supportLinearFiltering)
        gl.uniform2f(
          advectionProgram.uniforms.dyeTexelSize,
          velocity.texelSizeX,
          velocity.texelSizeY,
        );
      var velocityId = velocity.read.attach(0);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(
        advectionProgram.uniforms.dissipation,
        config.VELOCITY_DISSIPATION,
      );
      blit(velocity.write);
      velocity.swap();

      if (!ext.supportLinearFiltering)
        gl.uniform2f(
          advectionProgram.uniforms.dyeTexelSize,
          dye.texelSizeX,
          dye.texelSizeY,
        );
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(
        advectionProgram.uniforms.dissipation,
        config.DENSITY_DISSIPATION,
      );
      blit(dye.write);
      dye.swap();
    }

    function render(target) {
      if (config.BLOOM) applyBloom(dye.read, bloom);
      if (config.SUNRAYS) {
        applySunrays(dye.read, dye.write, sunrays);
        blur(sunrays, sunraysTemp, 1);
      }

      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);

      drawDisplay(target);
    }

    function drawDisplay(target) {
      var width = target == null ? gl.drawingBufferWidth : target.width;
      var height = target == null ? gl.drawingBufferHeight : target.height;

      displayMaterial.bind();
      if (config.SHADING)
        gl.uniform2f(
          displayMaterial.uniforms.texelSize,
          1.0 / width,
          1.0 / height,
        );
      gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
      if (config.BLOOM) {
        gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
        gl.uniform1i(
          displayMaterial.uniforms.uDithering,
          ditheringTexture.attach(2),
        );
        gl.uniform2f(
          displayMaterial.uniforms.ditherScale,
          width / ditheringTexture.width,
          height / ditheringTexture.height,
        );
      }
      if (config.SUNRAYS)
        gl.uniform1i(displayMaterial.uniforms.uSunrays, sunrays.attach(3));
      blit(target);
    }

    function applyBloom(source, destination) {
      if (bloomFramebuffers.length < 2) return;

      var last = destination;

      gl.disable(gl.BLEND);
      bloomPrefilterProgram.bind();
      var knee =
        config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
      var curve0 = config.BLOOM_THRESHOLD - knee;
      var curve1 = knee * 2;
      var curve2 = 0.25 / knee;
      gl.uniform3f(
        bloomPrefilterProgram.uniforms.curve,
        curve0,
        curve1,
        curve2,
      );
      gl.uniform1f(
        bloomPrefilterProgram.uniforms.threshold,
        config.BLOOM_THRESHOLD,
      );
      gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
      blit(last);

      bloomBlurProgram.bind();
      for (var i = 0; i < bloomFramebuffers.length; i++) {
        var dest = bloomFramebuffers[i];
        gl.uniform2f(
          bloomBlurProgram.uniforms.texelSize,
          last.texelSizeX,
          last.texelSizeY,
        );
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        blit(dest);
        last = dest;
      }

      gl.blendFunc(gl.ONE, gl.ONE);
      gl.enable(gl.BLEND);

      for (i = bloomFramebuffers.length - 2; i >= 0; i--) {
        var baseTex = bloomFramebuffers[i];
        gl.uniform2f(
          bloomBlurProgram.uniforms.texelSize,
          last.texelSizeX,
          last.texelSizeY,
        );
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        blit(baseTex);
        last = baseTex;
      }

      gl.disable(gl.BLEND);
      bloomFinalProgram.bind();
      gl.uniform2f(
        bloomFinalProgram.uniforms.texelSize,
        last.texelSizeX,
        last.texelSizeY,
      );
      gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
      gl.uniform1f(
        bloomFinalProgram.uniforms.intensity,
        config.BLOOM_INTENSITY,
      );
      blit(destination);
    }

    function applySunrays(source, mask, destination) {
      gl.disable(gl.BLEND);
      sunraysMaskProgram.bind();
      gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
      blit(mask);

      sunraysProgram.bind();
      gl.uniform1f(sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
      gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
      blit(destination);
    }

    function blur(target, temp, iterations) {
      blurProgram.bind();
      for (var i = 0; i < iterations; i++) {
        gl.uniform2f(
          blurProgram.uniforms.texelSize,
          target.texelSizeX,
          0.0,
        );
        gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
        blit(temp);

        gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
        gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
        blit(target);
      }
    }

    /* ═══════════════ Splats ═══════════════ */
    function splatPointer(pointer) {
      var dx = pointer.deltaX * config.SPLAT_FORCE;
      var dy = pointer.deltaY * config.SPLAT_FORCE;
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
    }

    function multipleSplats(amount) {
      for (var i = 0; i < amount; i++) {
        var color = generateColor();
        color.r *= 10;
        color.g *= 10;
        color.b *= 10;
        var x = Math.random();
        var y = Math.random();
        var dx = 1000 * (Math.random() - 0.5);
        var dy = 1000 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color);
      }
    }

    function splat(x, y, dx, dy, color) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(
        splatProgram.uniforms.aspectRatio,
        canvas.width / canvas.height,
      );
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
      gl.uniform1f(
        splatProgram.uniforms.radius,
        correctRadius(config.SPLAT_RADIUS / 100.0),
      );
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(
        splatProgram.uniforms.color,
        color.r,
        color.g,
        color.b,
      );
      blit(dye.write);
      dye.swap();
    }

    /* ═══════════════ 取色(适配:背景图主色 → 随机回退) ═══════════════ */
    function generateColor() {
      var c;
      var palette =
        opts.colorSource === "image" ? ctx.palette() : null;
      if (palette && palette.length) {
        var e = palette[(Math.random() * palette.length) | 0];
        var h = e.h + (Math.random() - 0.5) * 0.06; // 同色系微抖动
        h = h - Math.floor(h);
        // 亮度抬到 0.8 以上:叠在图片上的染料需要"发光感",
        // 暗色染料在封顶浓度下会像一层灰黑墨渍
        c = HSVtoRGB(h, Math.min(1, e.s), Math.max(0.8, e.v));
      } else {
        c = HSVtoRGB(Math.random(), 1.0, 1.0);
      }
      c.r *= 0.15;
      c.g *= 0.15;
      c.b *= 0.15;
      return c;
    }

    /* ═══════════════ 工具(原版) ═══════════════ */
    function PointerData() {
      this.id = -1;
      this.texcoordX = 0;
      this.texcoordY = 0;
      this.prevTexcoordX = 0;
      this.prevTexcoordY = 0;
      this.deltaX = 0;
      this.deltaY = 0;
      this.down = false;
      this.moved = false;
      this.color = { r: 0.15, g: 0.15, b: 0.3 };
    }

    function eventPos(e) {
      var rect = canvas.getBoundingClientRect();
      var sx = canvas.width / rect.width;
      var sy = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      };
    }

    function updatePointerDownData(pointer, id, x, y) {
      pointer.id = id;
      pointer.down = true;
      pointer.moved = false;
      pointer.texcoordX = x / canvas.width;
      pointer.texcoordY = 1.0 - y / canvas.height;
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      pointer.color = generateColor();
    }

    function updatePointerMoveData(pointer, x, y) {
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = x / canvas.width;
      pointer.texcoordY = 1.0 - y / canvas.height;
      pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
      pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
      pointer.moved =
        Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    }

    function correctDeltaX(delta) {
      var aspectRatio = canvas.width / canvas.height;
      if (aspectRatio < 1) delta *= aspectRatio;
      return delta;
    }

    function correctDeltaY(delta) {
      var aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) delta /= aspectRatio;
      return delta;
    }

    function correctRadius(radius) {
      var aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) radius *= aspectRatio;
      return radius;
    }

    function HSVtoRGB(h, s, v) {
      var r, g, b, i, f, p, q, t;
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0:
          (r = v), (g = t), (b = p);
          break;
        case 1:
          (r = q), (g = v), (b = p);
          break;
        case 2:
          (r = p), (g = v), (b = t);
          break;
        case 3:
          (r = p), (g = q), (b = v);
          break;
        case 4:
          (r = t), (g = p), (b = v);
          break;
        default:
          (r = v), (g = p), (b = q);
      }
      return { r: r, g: g, b: b };
    }

    function wrap(value, min, max) {
      var range = max - min;
      if (range === 0) return min;
      return ((value - min) % range) + min;
    }

    /* ═══════════════ FBO 管理(原版) ═══════════════ */
    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        w,
        h,
        0,
        format,
        type,
        null,
      );

      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);

      return {
        texture: texture,
        fbo: fbo,
        width: w,
        height: h,
        texelSizeX: 1.0 / w,
        texelSizeY: 1.0 / h,
        attach: function (id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, param) {
      var fbo1 = createFBO(w, h, internalFormat, format, type, param);
      var fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read() {
          return fbo1;
        },
        set read(value) {
          fbo1 = value;
        },
        get write() {
          return fbo2;
        },
        set write(value) {
          fbo2 = value;
        },
        swap: function () {
          var temp = fbo1;
          fbo1 = fbo2;
          fbo2 = temp;
        },
      };
    }

    function resizeFBO(target, w, h, internalFormat, format, type, param) {
      var newFBO = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO);
      return newFBO;
    }

    function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(
        target.read,
        w,
        h,
        internalFormat,
        format,
        type,
        param,
      );
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w;
      target.height = h;
      target.texelSizeX = 1.0 / w;
      target.texelSizeY = 1.0 / h;
      return target;
    }

    function initFramebuffers() {
      var simRes = getResolution(config.SIM_RESOLUTION);
      var dyeRes = getResolution(config.DYE_RESOLUTION);
      var texType = ext.halfFloatTexType;
      var rgba = ext.formatRGBA;
      var rg = ext.formatRG;
      var r = ext.formatR;
      var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);

      if (dye == null)
        dye = createDoubleFBO(
          dyeRes.width,
          dyeRes.height,
          rgba.internalFormat,
          rgba.format,
          texType,
          filtering,
        );
      else
        dye = resizeDoubleFBO(
          dye,
          dyeRes.width,
          dyeRes.height,
          rgba.internalFormat,
          rgba.format,
          texType,
          filtering,
        );

      if (velocity == null)
        velocity = createDoubleFBO(
          simRes.width,
          simRes.height,
          rg.internalFormat,
          rg.format,
          texType,
          filtering,
        );
      else
        velocity = resizeDoubleFBO(
          velocity,
          simRes.width,
          simRes.height,
          rg.internalFormat,
          rg.format,
          texType,
          filtering,
        );

      divergence = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST,
      );
      curl = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST,
      );
      pressure = createDoubleFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST,
      );

      initBloomFramebuffers();
      initSunraysFramebuffers();
    }

    function initBloomFramebuffers() {
      var res = getResolution(config.BLOOM_RESOLUTION);
      var texType = ext.halfFloatTexType;
      var rgba = ext.formatRGBA;
      var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

      bloom = createFBO(
        res.width,
        res.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering,
      );
      bloomFramebuffers.length = 0;
      for (var i = 0; i < config.BLOOM_ITERATIONS; i++) {
        var width = res.width >> (i + 1);
        var height = res.height >> (i + 1);
        if (width < 2 || height < 2) break;
        bloomFramebuffers.push(
          createFBO(
            width,
            height,
            rgba.internalFormat,
            rgba.format,
            texType,
            filtering,
          ),
        );
      }
    }

    function initSunraysFramebuffers() {
      var res = getResolution(config.SUNRAYS_RESOLUTION);
      var texType = ext.halfFloatTexType;
      var r = ext.formatR;
      var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      sunrays = createFBO(
        res.width,
        res.height,
        r.internalFormat,
        r.format,
        texType,
        filtering,
      );
      sunraysTemp = createFBO(
        res.width,
        res.height,
        r.internalFormat,
        r.format,
        texType,
        filtering,
      );
    }

    function getResolution(resolution) {
      var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      var min = Math.round(resolution);
      var max = Math.round(resolution * aspectRatio);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight)
        return { width: max, height: min };
      return { width: min, height: max };
    }

    function createNoiseTexture() {
      var size = 64;
      var c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      var ictx = c.getContext("2d");
      var im = ictx.createImageData(size, size);
      for (var i = 0; i < im.data.length; i += 4) {
        var v = (Math.random() * 256) | 0;
        im.data[i] = v;
        im.data[i + 1] = v;
        im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
      ictx.putImageData(im, 0, 0);

      var texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        c,
      );
      return {
        texture: texture,
        width: size,
        height: size,
        attach: function (id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    /* ═══════════════ GL 对象封装(原版) ═══════════════ */
    function compileShader(type, source, keywords) {
      source = addKeywords(source, keywords);
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        console.trace(gl.getShaderInfoLog(shader));
      return shader;
    }

    function addKeywords(source, keywords) {
      if (keywords == null) return source;
      var keywordsString = "";
      keywords.forEach(function (keyword) {
        keywordsString += "#define " + keyword + "\n";
      });
      return keywordsString + source;
    }

    function Program(vertexShader, fragmentShader) {
      var program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.bindAttribLocation(program, 0, "aPosition");
      gl.linkProgram(program);

      this.program = program;
      this.uniforms = getUniforms(program);
    }

    Program.prototype.bind = function () {
      gl.useProgram(this.program);
    };

    function Material(vertexShader, fragmentShaderSource) {
      this.vertexShader = vertexShader;
      this.fragmentShaderSource = fragmentShaderSource;
      this.programs = [];
      this.activeProgram = null;
      this.uniforms = {};
    }

    Material.prototype.setKeywords = function (keywords) {
      var hash = 0;
      for (var i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);
      var program = this.programs[hash];
      if (program == null) {
        var fragmentShader = compileShader(
          gl.FRAGMENT_SHADER,
          this.fragmentShaderSource,
          keywords,
        );
        program = createProgram(this.vertexShader, fragmentShader);
        this.programs[hash] = program;
      }
      if (program === this.activeProgram) return;
      this.uniforms = getUniforms(program);
      this.activeProgram = program;
    };

    Material.prototype.bind = function () {
      gl.useProgram(this.activeProgram);
    };

    function createProgram(vertexShader, fragmentShader) {
      var program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.bindAttribLocation(program, 0, "aPosition");
      gl.linkProgram(program);
      return program;
    }

    function getUniforms(program) {
      var uniforms = {};
      var uniformCount = gl.getProgramParameter(
        program,
        gl.ACTIVE_UNIFORMS,
      );
      for (var i = 0; i < uniformCount; i++) {
        var uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
      }
      return uniforms;
    }

    function hashCode(s) {
      if (s.length === 0) return 0;
      var hash = 0;
      for (var i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }

    function getExtension(glc) {
      var halfFloat = glc.getExtension("OES_texture_half_float");
      var supportLinearFiltering =
        glc.getExtension("OES_texture_half_float_linear");
      if (halfFloat == null) return null;

      var halfFloatTexType = halfFloat.HALF_FLOAT_OES;
      var formatRGBA, formatRG, formatR;

      if (window.WebGL2RenderingContext && glc instanceof window.WebGL2RenderingContext) {
        glc.getExtension("EXT_color_buffer_float");
        supportLinearFiltering = true;
        formatRGBA = getSupportedFormat(
          glc,
          glc.RGBA16F,
          glc.RGBA,
          halfFloatTexType,
        );
        formatRG = getSupportedFormat(glc, glc.RG16F, glc.RG, halfFloatTexType);
        formatR = getSupportedFormat(glc, glc.R16F, glc.RED, halfFloatTexType);
      } else {
        formatRGBA = getSupportedFormat(glc, glc.RGBA, glc.RGBA, halfFloatTexType);
        formatRG = formatRGBA;
        formatR = formatRGBA;
      }

      return {
        halfFloatTexType: halfFloatTexType,
        supportLinearFiltering: supportLinearFiltering !== null && supportLinearFiltering !== false,
        formatRGBA: formatRGBA,
        formatRG: formatRG,
        formatR: formatR,
      };
    }

    function getSupportedFormat(glc, internalFormat, format, type) {
      if (!supportRenderTextureFormat(glc, internalFormat, format, type)) {
        switch (internalFormat) {
          case glc.R16F:
            return getSupportedFormat(glc, glc.RG16F, glc.RG, type);
          case glc.RG16F:
            return getSupportedFormat(glc, glc.RGBA16F, glc.RGBA, type);
          default:
            return null;
        }
      }
      return { internalFormat: internalFormat, format: format };
    }

    function supportRenderTextureFormat(glc, internalFormat, format, type) {
      var texture = glc.createTexture();
      glc.bindTexture(glc.TEXTURE_2D, texture);
      glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_MIN_FILTER, glc.NEAREST);
      glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_MAG_FILTER, glc.NEAREST);
      glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_WRAP_S, glc.CLAMP_TO_EDGE);
      glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_WRAP_T, glc.CLAMP_TO_EDGE);
      glc.texImage2D(
        glc.TEXTURE_2D,
        0,
        internalFormat,
        4,
        4,
        0,
        format,
        type,
        null,
      );
      var fbo = glc.createFramebuffer();
      glc.bindFramebuffer(glc.FRAMEBUFFER, fbo);
      glc.framebufferTexture2D(
        glc.FRAMEBUFFER,
        glc.COLOR_ATTACHMENT0,
        glc.TEXTURE_2D,
        texture,
        0,
      );
      var status = glc.checkFramebufferStatus(glc.FRAMEBUFFER);
      return status === glc.FRAMEBUFFER_COMPLETE;
    }

    function updateKeywords() {
      var displayKeywords = [];
      if (config.SHADING) displayKeywords.push("SHADING");
      if (config.BLOOM) displayKeywords.push("BLOOM");
      if (config.SUNRAYS) displayKeywords.push("SUNRAYS");
      displayMaterial.setKeywords(displayKeywords);
    }

    function applyQuality(q) {
      var mobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
      if (q === "low") {
        config.SIM_RESOLUTION = 64;
        config.DYE_RESOLUTION = mobile ? 128 : 256;
      } else if (q === "medium") {
        config.SIM_RESOLUTION = 96;
        config.DYE_RESOLUTION = 512;
      } else {
        config.SIM_RESOLUTION = mobile ? 96 : 128;
        config.DYE_RESOLUTION = mobile ? 512 : 1024;
      }
      initFramebuffers();
    }

    /* ═══════════════ 启动序列(须在全部原型方法挂载后执行) ═════ */
    applyQuality(opts.quality);
    config.BLOOM = params.bloom === true;
    updateKeywords();
    if (config.BLOOM) initBloomFramebuffers();
    // 抖动纹理:程序生成 64×64 灰度噪声(替代原版的 LDR_LLL1_0.png)
    ditheringTexture = createNoiseTexture();
    resizeCanvas();
    requestAnimationFrame(frame);

    /* ═══════════════ 对外接口:面板驱动 ═══════════════ */
    return {
      setParam: function (key, value) {
        switch (key) {
          case "quality":
            opts.quality = value;
            applyQuality(value);
            break;
          case "color_source":
            opts.colorSource = value;
            break;
          case "hover":
            opts.hover = !!value;
            break;
          case "curl":
            config.CURL = value;
            break;
          case "splat_radius":
            config.SPLAT_RADIUS = value;
            break;
          case "density_dissipation":
            config.DENSITY_DISSIPATION = value;
            break;
          case "velocity_dissipation":
            config.VELOCITY_DISSIPATION = value;
            break;
          case "bloom":
            config.BLOOM = !!value;
            if (config.BLOOM) initBloomFramebuffers();
            updateKeywords();
            break;
        }
      },
      setVisible: function (v) {
        visible = v;
      },
      randomSplats: function (n) {
        multipleSplats(n || 8);
      },
      destroy: function () {
        running = false;
        window.removeEventListener("resize", windowResizeHandler);
        heroEl.removeEventListener("mousedown", heroMouseDown);
        window.removeEventListener("mouseup", windowMouseUp);
        heroEl.removeEventListener("mousemove", heroMouseMove);
        heroEl.removeEventListener("touchstart", heroTouchStart);
        heroEl.removeEventListener("touchmove", heroTouchMove);
        heroEl.removeEventListener("touchend", heroTouchEnd);
        try {
          var loseCtx = gl.getExtension("WEBGL_lose_context");
          if (loseCtx) loseCtx.loseContext();
        } catch (e) {}
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
    };
  }
})();
