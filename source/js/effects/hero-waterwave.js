/**
 * ============================================
 * Hero 特效:水波折射(hero-waterwave.js)
 * ============================================
 * 与开屏封面(cover.pug)同款的 WebGL 水波折射背景,
 * 作为 HeroFX 框架的第三个特效接入:
 * · 面板可开关,同一时刻与流体/水彩互斥(框架为单激活模式);
 * · 离开视口自动释放 WebGL,回到视口自动重建(纹理走浏览器缓存);
 * · 折射纹理 = 主题配置的 hero 背景图。
 * 依赖:js/vendor/liquid1.min.js(与封面共用,已本地化)。
 */

(function () {
  "use strict";

  if (!window.HeroFX) return;

  window.HeroFX.register({
    id: "waterwave",
    name: "水波折射", // i18n:allow
    icon: "💧",
    defaults: {},
    create: createWaterwave,
  });

  function createWaterwave(layer, params, ctx) {
    var canvas = document.createElement("canvas");
    canvas.className = "hero-fx-canvas hero-fx-waterwave-canvas";
    layer.appendChild(canvas);

    var disposed = false;
    var app = null;

    var api = {
      destroy: function () {
        disposed = true;
        if (app && app.dispose) {
          app.dispose();
          app = null;
        }
        canvas.remove();
      },
      setParam: function () {},
      setVisible: function (v) {
        // 离开视口:释放 WebGL;回到视口:重建(纹理来自浏览器缓存)
        if (!v) {
          if (app && app.dispose) {
            app.dispose();
            app = null;
          }
        } else if (!app && !disposed) {
          boot();
        }
      },
    };

    function boot() {
      import("/js/vendor/liquid1.min.js")
        .then(function (m) {
          if (disposed) return;
          var LiquidBackground = m.default;
          app = LiquidBackground(canvas);
          // 与封面一致的液面质感
          app.liquidPlane.material.metalness = 0.35;
          app.liquidPlane.material.roughness = 0.45;
          app.liquidPlane.uniforms.displacementScale.value = 2;
          app.setRain(false);
          // 折射纹理:主题配置的 hero 背景图
          var bg =
            window.theme && window.theme.hero && window.theme.hero.background_image;
          if (bg) app.loadImage(bg);
        })
        .catch(function (e) {
          console.error("[HeroFX] waterwave 模块加载失败:", e);
          canvas.remove();
        });
    }

    boot();
    return api;
  }
})();
