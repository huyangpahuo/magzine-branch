/**
 * ============================================
 * 桌宠文字避让 (pet-pretext-interaction.js)
 *
 * 桌宠在文章上走过时,把附近文字逐字符推开;走远后复原。
 *
 * ★ 处理范围由"允许选择器"(allowSelector)决定——只有匹配的元素才会
 *   参与文字避让,其余元素(表格、引用块等)一律忽略,避免大量逐字
 *   span 造成卡顿。默认允许: p, h1~h6, li, pre。
 *   可在 config.yml 的 pet.pretext_interaction.allow_selector 中修改。
 * ============================================
 */

export class PetPretextInteraction {
  constructor(options = {}) {
    this.repelRadius = options.repelRadius || 50; // 排斥半径(像素)
    this.throttleMs = options.throttleMs || 50; // 节流间隔(毫秒)
    // ★ 允许参与文字避让的元素(CSS 选择器,逗号分隔)
    this.allowSelector =
      options.allowSelector || "p, h1, h2, h3, h4, h5, h6, li, pre";
    this.maxBlockChars = 800; // 单块文字超过此长度则忽略(超大代码块等)
    this.chunkTimeMs = 8; // 分批处理时每帧的最大耗时(性能保护)
    this.lastRun = 0;

    this.iframe = null;
    this.activeBlocks = [];
    this.isPreparing = false; // 是否正在分批处理 DOM(防止重复执行)
  }

  /* ============ 核心:把块内文本逐字符包进 span(不破坏 HTML 结构) ============ */
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

    // 英文/数字按"整词"打包(不可断行),中文/标点逐字处理
    const isWordChar = (ch) => /[A-Za-z0-9'\-]/.test(ch);

    const makeCharSpan = (char) => {
      const span = doc.createElement("span");
      span.textContent = char;
      span.style.display = "inline-block";
      span.style.transition = "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
      span.style.position = "relative";
      spans.push(span);
      return span;
    };

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      if (!text.trim()) return;

      const fragment = doc.createDocumentFragment();
      let i = 0;
      while (i < text.length) {
        const char = text[i];

        if (char.trim() === "") {
          // 空白字符保持为普通文本节点,允许在此处换行
          fragment.appendChild(doc.createTextNode(char));
          i++;
          continue;
        }

        if (isWordChar(char)) {
          // 整词容器(inline-block + nowrap):保证英文单词不被从中间截断,
          // 容器内部仍是逐字符 span,供桌宠位移动画使用
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
          fragment.appendChild(makeCharSpan(char));
          i++;
        }
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return spans;
  }

  /* ============ 在模态 iframe 的文章内容里准备所有允许的块 ============ */
  prepareIframeText() {
    if (!this.iframe || !this.iframe.contentDocument) {
      this.isPreparing = false;
      return;
    }
    const doc = this.iframe.contentDocument;

    const articleBody = doc.querySelector(
      ".post-content, .article-content, .markdown-body, #article-container",
    );
    if (!articleBody) {
      this.isPreparing = false;
      return;
    }

    // ★ 白名单:只有匹配 allowSelector 的元素会参与文字避让
    //   (表格、引用块等不在名单内,天然被忽略)
    const blocks = articleBody.querySelectorAll(this.allowSelector);
    if (blocks.length === 0) {
      this.isPreparing = false;
      return;
    }

    this.activeBlocks = [];
    let i = 0;

    // 分批处理:每帧最多耗时 chunkTimeMs,避免长文一次性处理造成卡顿
    const processChunk = () => {
      const startTime = performance.now();

      while (
        i < blocks.length &&
        performance.now() - startTime < this.chunkTimeMs
      ) {
        const block = blocks[i];
        i++;

        // 已处理过的(或嵌套在已处理块里的)跳过
        if (block.closest("[data-pretext-ready]")) continue;

        // 超长块(整段贴代码等)直接忽略
        if (block.textContent && block.textContent.length > this.maxBlockChars) {
          block.setAttribute("data-pretext-ready", "ignored");
          continue;
        }

        const spans = this.wrapTextNodes(block, doc);
        if (spans.length > 0) {
          block.setAttribute("data-pretext-ready", "true");
          this.activeBlocks.push({ el: block, spans: spans });
        }
      }

      if (i < blocks.length) {
        requestAnimationFrame(processChunk);
      } else {
        this.isPreparing = false;
      }
    };

    requestAnimationFrame(processChunk);
  }

  /* ============ 每帧更新:根据桌宠位置推开附近文字 ============ */
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

    // 判断切文章:旧块已不在当前文档里则重置
    if (
      this.activeBlocks.length > 0 &&
      !doc.contains(this.activeBlocks[0].el)
    ) {
      this.activeBlocks = [];
      this.isPreparing = false;
    }

    // 首次/换页:等 iframe 完全加载后开始准备(稍延迟避免页面仍在抖动)
    if (this.activeBlocks.length === 0 && !this.isPreparing) {
      if (doc.readyState !== "complete") return;

      this.isPreparing = true;
      setTimeout(() => {
        if (this.iframe && this.iframe.contentDocument) {
          this.prepareIframeText();
        } else {
          this.isPreparing = false;
        }
      }, 800);
      return;
    }

    if (this.isPreparing) return;

    const iframeRect = this.iframe.getBoundingClientRect();

    // 桌宠不在模态范围内:复原所有文字
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

      // 块整体远离桌宠:复位该块的所有字符
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

      // 块在桌宠附近:逐字符计算斥力位移
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

  /* ============ 复原全部文字 ============ */
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
