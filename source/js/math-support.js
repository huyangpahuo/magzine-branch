// MathJax 配置与加载脚本
// ★ 性能修改(2026-09):
//   1. 只有页面正文确实包含公式标记($...$、\(...\)、\[...\])时才下载
//     MathJax——绝大多数页面零公式,不再为它付出 ~1MB 脚本的请求与解析;
//   2. 下载推迟到浏览器空闲(requestIdleCallback),不与首屏渲染抢主线程。
(function () {
  function pageHasMath() {
    var scope = document.querySelector(".post-content") || document.body;
    var text = scope ? scope.textContent : "";
    // $...$ / $$...$$ / \( ... \) / \[ ... \]
    return (
      /\$[^$\n]{1,200}\$/.test(text) ||
      text.indexOf("\\(") !== -1 ||
      text.indexOf("\\[") !== -1
    );
  }

  // MathJax 本体加载前必须先挂好配置,这里保持原配置不变
  function boot() {
    if (document.getElementById("MathJax-script")) return;

    // 1. 配置 MathJax
    window.MathJax = {
      tex: {
        inlineMath: [
          ["$", "$"],
          ["\\(", "\\)"],
        ],
        displayMath: [
          ["$$", "$$"],
          ["\\[", "\\]"],
        ],
        processEscapes: true,
      },
      chtml: {
        scale: 0.9,
        matchFontHeight: true,
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      },
      startup: {
        pageReady: () => {
          return MathJax.startup.defaultPageReady().then(() => {
            // --- 长数学公式横向滚动交互逻辑 ---
            const displayMathContainers = document.querySelectorAll(
              'mjx-container[display="true"]',
            );

            displayMathContainers.forEach((container) => {
              container.style.overflowX = "auto";
              container.style.overflowY = "hidden";
              container.style.maxWidth = "100%";

              container.addEventListener(
                "wheel",
                (e) => {
                  if (container.scrollWidth > container.clientWidth) {
                    if (Math.abs(e.deltaY) > 0 && e.deltaX === 0) {
                      e.preventDefault();
                      container.scrollLeft += e.deltaY;
                    }
                  }
                },
                { passive: false },
              );
            });
          });
        },
      },
    };

    // 2. 动态加载 MathJax 脚本
    let script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
    script.async = true;
    script.id = "MathJax-script";
    document.head.appendChild(script);
  }

  function start() {
    if (!pageHasMath()) return; // 无公式页面:完全不加载 MathJax
    if ("requestIdleCallback" in window) {
      requestIdleCallback(boot, { timeout: 3000 });
    } else {
      setTimeout(boot, 200);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
    // pjax 换页后正文可能变化,重新检测
    document.addEventListener("DOMContentLoaded", function () {
      if (!document.getElementById("MathJax-script")) start();
    });
  }
})();
