/**
 * ============================================
 * 桌宠文字避让功能 (pet-pretext-interaction.js)
 * 进阶版：支持标题、列表、表格和代码高亮块，且不破坏HTML结构
 * 【已加入时间切片与性能保护】
 * ============================================
 */

export class PetPretextInteraction {
  constructor(options = {}) {
    this.repelRadius = options.repelRadius || 50;
    this.throttleMs = options.throttleMs || 50;
    this.lastRun = 0;

    this.iframe = null;
    this.activeBlocks = [];

    // 新增：标识是否正在分批处理DOM中，防止重复执行
    this.isPreparing = false;
  }

  // 核心黑科技：深度遍历文本节点，不破坏任何原有 HTML 结构
  wrapTextNodes(element, doc) {
    const spans = [];
    const walker = doc.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parentName = node.parentNode.nodeName;
          if (parentName === "SCRIPT" || parentName === "STYLE")
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false,
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    // 判断一个字符是否是"会被空白/CJK自然断行"的字符
    // （用于决定是否需要把连续字符打包进一个不可断行的单词容器）
    const isWordChar = (ch) => /[A-Za-z0-9'\-]/.test(ch);

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      if (!text.trim()) return;

      const fragment = doc.createDocumentFragment();

      // 创建单个字符的 span（用于位移动画）
      const makeCharSpan = (char) => {
        const span = doc.createElement("span");
        span.textContent = char;
        span.style.display = "inline-block";
        span.style.transition =
          "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
        span.style.position = "relative";
        spans.push(span);
        return span;
      };

      let i = 0;
      while (i < text.length) {
        const char = text[i];

        if (char.trim() === "") {
          // 空白字符：保持为普通文本节点，允许在此处换行
          fragment.appendChild(doc.createTextNode(char));
          i++;
          continue;
        }

        if (isWordChar(char)) {
          // ★★★ 关键修复 ★★★
          // 英文/数字：把整个单词打包进一个 inline-block + white-space:nowrap
          // 的容器里，让浏览器把这个容器当成"一个不可拆分的原子盒子"来换行，
          // 而不是把每个字母单独当成一个可换行的原子盒子（这正是英文单词
          // 被从中间截断的根本原因）。容器内部仍然拆成逐字符 span，
          // 供桌宠位移动画使用，不影响换行逻辑。
          let j = i;
          let word = "";
          while (j < text.length && isWordChar(text[j])) {
            word += text[j];
            j++;
          }

          const wordWrapper = doc.createElement("span");
          wordWrapper.style.display = "inline-block";
          wordWrapper.style.whiteSpace = "nowrap";
          for (const wChar of word) {
            wordWrapper.appendChild(makeCharSpan(wChar));
          }
          fragment.appendChild(wordWrapper);
          i = j;
        } else {
          // 中文 / 标点等：逐字符本身就是天然断行单元，保持原逻辑即可
          fragment.appendChild(makeCharSpan(char));
          i++;
        }
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return spans;
  }

  prepareIframeText() {
    if (!this.iframe || !this.iframe.contentDocument) {
      this.isPreparing = false; // 退出时必须解锁
      return;
    }
    const doc = this.iframe.contentDocument;

    const articleBody = doc.querySelector(
      ".post-content, .article-content, .markdown-body, #article-container",
    );
    if (!articleBody) {
      this.isPreparing = false; // 退出时必须解锁
      return;
    }

    const blocks = articleBody.querySelectorAll(
      "p, h1, h2, h3, h4, h5, h6, li, td:not(.gutter), th, pre",
    );

    if (blocks.length === 0) {
      this.isPreparing = false; // 退出时必须解锁
      return;
    }

    this.activeBlocks = [];
    let i = 0;

    const processChunk = () => {
      const maxTimePerFrame = 8;
      const startTime = performance.now();

      while (
        i < blocks.length &&
        performance.now() - startTime < maxTimePerFrame
      ) {
        const block = blocks[i];
        i++;

        if (
          block.closest("[data-pretext-ready]") ||
          block.closest("blockquote")
        )
          continue;

        if (block.textContent && block.textContent.length > 800) {
          block.setAttribute("data-pretext-ready", "ignored");
          continue;
        }

        const spans = this.wrapTextNodes(block, doc);
        if (spans.length > 0) {
          block.setAttribute("data-pretext-ready", "true");
          this.activeBlocks.push({
            el: block,
            spans: spans,
          });
        }
      }

      if (i < blocks.length) {
        requestAnimationFrame(processChunk);
      } else {
        // 全部处理完毕，真正解锁
        this.isPreparing = false;
      }
    };

    requestAnimationFrame(processChunk);
  }

  update(petScreenX, petScreenY, timestamp) {
    if (!this.iframe) {
      this.iframe = document.querySelector(".article-modal-iframe");
    }
    if (!this.iframe) return;

    if (timestamp - this.lastRun < this.throttleMs) return;
    this.lastRun = timestamp;

    const modal = document.querySelector(".article-modal");
    if (!modal || !modal.classList.contains("active")) return;

    const doc = this.iframe.contentDocument;
    if (!doc) return;

    // 判断切文章
    if (
      this.activeBlocks.length > 0 &&
      !doc.contains(this.activeBlocks[0].el)
    ) {
      this.activeBlocks = [];
      this.isPreparing = false;
    }

    // 【修复死锁的核心逻辑】
    if (this.activeBlocks.length === 0 && !this.isPreparing) {
      // 在上锁之前，先确保 iframe 已经完全加载完毕，否则直接 return 等待下一帧，不上锁
      if (doc.readyState !== "complete") return;

      this.isPreparing = true; // 上锁

      setTimeout(() => {
        if (this.iframe && this.iframe.contentDocument) {
          this.prepareIframeText();
        } else {
          this.isPreparing = false; // 没找到文档也得解锁
        }
      }, 800);
      return;
    }

    if (this.isPreparing) return;

    const iframeRect = this.iframe.getBoundingClientRect();

    if (
      petScreenX < iframeRect.left ||
      petScreenX > iframeRect.right ||
      petScreenY < iframeRect.top ||
      petScreenY > iframeRect.bottom
    ) {
      this.resetText();
      return;
    }

    const petIframeX = petScreenX - iframeRect.left;
    const petIframeY =
      petScreenY - iframeRect.top + doc.documentElement.scrollTop;

    this.activeBlocks.forEach((blockObj) => {
      const pRect = blockObj.el.getBoundingClientRect();
      const pTopAbsolute = pRect.top + doc.documentElement.scrollTop;
      const pBottomAbsolute = pRect.bottom + doc.documentElement.scrollTop;
      const margin = this.repelRadius + 100;

      if (
        petIframeY < pTopAbsolute - margin ||
        petIframeY > pBottomAbsolute + margin
      ) {
        blockObj.spans.forEach((span) => {
          if (
            span.style.transform !== "translate(0px, 0px)" &&
            span.style.transform !== ""
          ) {
            span.style.transform = "translate(0px, 0px)";
            span.style.zIndex = "1";
          }
        });
        return;
      }

      blockObj.spans.forEach((span) => {
        const rect = span.getBoundingClientRect();
        const spanX = rect.left + rect.width / 2;
        const spanY =
          rect.top + doc.documentElement.scrollTop + rect.height / 2;

        const dx = spanX - petIframeX;
        const dy = spanY - petIframeY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.repelRadius) {
          const force = (this.repelRadius - distance) / this.repelRadius;
          const pushX = (dx / distance) * force * 15;
          const pushY = (dy / distance) * force * 15;

          span.style.transform = `translate(${pushX}px, ${pushY}px)`;
          span.style.zIndex = "10";
        } else if (
          span.style.transform !== "translate(0px, 0px)" &&
          span.style.transform !== ""
        ) {
          span.style.transform = "translate(0px, 0px)";
          span.style.zIndex = "1";
        }
      });
    });
  }

  resetText() {
    this.activeBlocks.forEach((blockObj) => {
      blockObj.spans.forEach((span) => {
        if (
          span.style.transform !== "translate(0px, 0px)" &&
          span.style.transform !== ""
        ) {
          span.style.transform = "translate(0px, 0px)";
          span.style.zIndex = "1";
        }
      });
    });
  }
}
