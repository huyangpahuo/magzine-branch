/**
 * hero-watercolor.js — 水彩光晕 / Watercolor
 *
 * 参考页面: https://www.shadertoy.com/view/lsyfWD
 * 使用兼容 Shadertoy 的 iResolution / iTime / iMouse uniform，
 * 以本地透明 WebGL 画布叠加到 Hero，不依赖远程 iframe 或 API key。
 */
(function () {
  "use strict";

  if (!window.HeroFX) return;

  var CONTROLS = [
    { key: "speed", label: "动画速度", type: "range", min: 0, max: 1.5, step: 0.05 },
    { key: "intensity", label: "光晕强度", type: "range", min: 0, max: 1, step: 0.05 },
    { key: "hover", label: "悬停交互", type: "checkbox" },
  ];

  window.HeroFX.register({
    id: "watercolor",
    name: "水彩光晕",
    icon: "🖌️",
    defaults: { speed: 0.1, intensity: 0.55, hover: true },
    controls: CONTROLS,
    create: createWatercolor,
  });

  function createWatercolor(layer, params, ctx) {
    var canvas = document.createElement("canvas");
    canvas.className = "hero-fx-canvas hero-fx-shadertoy-canvas";
    layer.appendChild(canvas);
    var gl = canvas.getContext("webgl", { alpha: true, antialias: false });
    if (!gl) {
      canvas.remove();
      return { destroy: function () {}, setParam: function () {} };
    }

    var vertex = compile(gl, gl.VERTEX_SHADER, "attribute vec2 p; void main(){gl_Position=vec4(p,0.0,1.0);}");
    var fragment = compile(gl, gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform vec3 iResolution;
      uniform float iTime;
      uniform vec4 iMouse;
      uniform float uIntensity;
      void main() {
        float speed = 0.1;
        float scale = 0.002;
        vec2 p = gl_FragCoord.xy * scale;
        for (int i = 1; i < 10; i++) {
          p.x += 0.3 / float(i) * sin(float(i) * 3.0 * p.y + iTime * speed) + iMouse.x / 1000.0;
          p.y += 0.3 / float(i) * cos(float(i) * 3.0 * p.x + iTime * speed) + iMouse.y / 1000.0;
        }
        float r = cos(p.x + p.y + 1.0) * 0.5 + 0.5;
        float g = sin(p.x + p.y + 1.0) * 0.5 + 0.5;
        float b = (sin(p.x + p.y) + cos(p.x + p.y)) * 0.3 + 0.5;
        vec3 color = vec3(r, g, b);
        gl_FragColor = vec4(color * uIntensity, uIntensity);
      }
    `);
    if (!vertex || !fragment) {
      canvas.remove();
      return { destroy: function () {}, setParam: function () {} };
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.remove();
      return { destroy: function () {}, setParam: function () {} };
    }
    gl.useProgram(program);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    var resolution = gl.getUniformLocation(program, "iResolution");
    var time = gl.getUniformLocation(program, "iTime");
    var mouse = gl.getUniformLocation(program, "iMouse");
    var intensity = gl.getUniformLocation(program, "uIntensity");
    // Keep the shader alive even before the first pointer event. This gives
    // the Watercolor effect a visible, continuous motion on touch devices and
    // with a mouse that is resting outside the hero.
    var pointer = [0, 0];
    var hasPointer = false;
    var running = true;
    var raf = 0;
    var start = performance.now();

    function resize() {
      var rect = ctx.heroEl.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function move(e) {
      if (params.hover === false) return;
      var r = ctx.heroEl.getBoundingClientRect();
      pointer[0] = (e.clientX - r.left) * (window.devicePixelRatio || 1);
      pointer[1] = (r.height - (e.clientY - r.top)) * (window.devicePixelRatio || 1);
      hasPointer = true;
    }
    function frame(now) {
      raf = 0;
      if (!running) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3f(resolution, canvas.width, canvas.height, 1);
      var elapsed = (now - start) / 1000;
      // The original shader uses iTime * 0.1 internally. Keep iTime moving
      // independently from the UI value, then use speed as a real multiplier.
      gl.uniform1f(time, elapsed * Math.max(0, Number(params.speed == null ? 0.1 : params.speed)) / 0.1);
      if (!hasPointer && params.hover !== false) {
        // A gentle automatic drift makes the effect visibly animated without
        // requiring a random splash or a pointer interaction.
        pointer[0] = canvas.width * (0.5 + Math.sin(elapsed * 0.43) * 0.16);
        pointer[1] = canvas.height * (0.5 + Math.cos(elapsed * 0.31) * 0.12);
      }
      gl.uniform4f(mouse, pointer[0], pointer[1], pointer[0], pointer[1]);
      gl.uniform1f(intensity, Number(params.intensity || 0));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }
    function setVisible(visible) {
      running = visible !== false;
      if (running && !raf) raf = requestAnimationFrame(frame);
    }
    resize();
    ctx.heroEl.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return {
      setParam: function (key, value) { params[key] = value; },
      setVisible: setVisible,
      destroy: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        ctx.heroEl.removeEventListener("pointermove", move);
        window.removeEventListener("resize", resize);
        gl.deleteProgram(program);
        canvas.remove();
      },
    };
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("[HeroFX] Watercolor effect compile failed:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
})();
