/**
 * ============================================
 * 桌宠文字避让 (pet-pretext-interaction.js)
 *
 * 桌宠在文章上走过时,把附近文字逐字符推开;走远后复原。
 *
 * ★ 性能架构(2026-09 重构,行为与旧版一致):
 *   1. 视口懒包裹:不再打开文章就给全篇每个字包 span,而是用
 *      IntersectionObserver(在 iframe 文档里创建)只包裹"视口上下
 *      各一屏"内的段落;滚出两屏以外的段落自动还原成纯文本,
 *      DOM 里同时存在的字符 span 始终约等于一屏的量。
 *   2. 读写分离:每次更新先集中读完所有 span 的位置,再集中写
 *      transform,消除"读一个→写一个"造成的逐元素强制重排
 *      (layout thrashing),这是旧版长文卡死的主因。
 *   3. 其余保护沿用旧版:allowSelector 白名单、单块 800 字上限、
 *      分批包裹每帧限时 8ms、50ms 节流。
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
    this.activeBlocks = []; // 已包裹且当前仍存在的块 {el, spans}
    this.isPreparing = false; // 是否正在分批处理包裹队列
    this.pendingWrap = []; // 等待包裹的块队列
    this.savedHTML = new Map(); // 块 -> 包裹前的 innerHTML(还原用)
    this.io = null; // iframe 文档内的 IntersectionObserver
    this.doc = null; // 当前正在处理的 iframe 文档
    this.prepared = false; // 当前 iframe 文档是否已初始化
    this.preparedDoc = null; // 已初始化的文档对象(检测换文章)
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

  /* ============ 包裹单个块 ============ */
  wrapBlock(block) {
    if (block.hasAttribute("data-pretext-ready")) return;
    // 嵌套在已处理块里的(如 li 里的 p)跳过,避免重复包裹
    if (block.closest("[data-pretext-ready]")) {
      block.setAttribute("data-pretext-ready", "skipped");
      return;
    }
    // 超长块(整段贴代码等)直接忽略
    if (block.textContent && block.textContent.length > this.maxBlockChars) {
      block.setAttribute("data-pretext-ready", "ignored");
      return;
    }
    // 保存原始 HTML,滚远后还原成纯文本,防止长文 DOM 无限膨胀
    this.savedHTML.set(block, block.innerHTML);
    const spans = this.wrapTextNodes(block, this.doc);
    block.setAttribute("data-pretext-ready", "true");
    if (spans.length > 0) {
      this.activeBlocks.push({ el: block, spans: spans });
    }
  }

  /* ============ 还原单个块(滚出较远视口后调用) ============ */
  unwrapBlock(block) {
    const saved = this.savedHTML.get(block);
    if (saved !== undefined) {
      block.innerHTML = saved;
      this.savedHTML.delete(block);
    }
    block.removeAttribute("data-pretext-ready");
    this.activeBlocks = this.activeBlocks.filter((b) => b.el !== block);
  }

  /* ============ 分批消费包裹队列(每帧限时,避免滚动时掉帧) ============ */
  processPendingWrap() {
    if (this.pendingWrap.length === 0) {
      this.isPreparing = false;
      return;
    }
    const startTime = performance.now();
    while (
      this.pendingWrap.length > 0 &&
      performance.now() - startTime < this.chunkTimeMs
    ) {
      this.wrapBlock(this.pendingWrap.shift());
    }
    if (this.pendingWrap.length > 0) {
      requestAnimationFrame(this.processPendingWrap.bind(this));
    } else {
      this.isPreparing = false;
    }
  }

  /* ============ 收集文章内容块并挂 IntersectionObserver(视口懒包裹) ============ */
  prepareIframeText() {
    if (!this.iframe || !this.iframe.contentDocument) {
      this.isPreparing = false;
      return;
    }
    const doc = this.iframe.contentDocument;
    this.doc = doc;

    const articleBody = doc.querySelector(
      ".post-content, .article-content, .markdown-body, #article-container",
    );
    if (!articleBody) {
      this.isPreparing = false;
      return;
    }

    // ★ 白名单:只有匹配 allowSelector 的元素会参与文字避让
    const blocks = articleBody.querySelectorAll(this.allowSelector);
    if (blocks.length === 0) {
      this.isPreparing = false;
      return;
    }

    this.activeBlocks = [];
    this.pendingWrap = [];
    this.savedHTML = new Map();

    // 优先用 iframe 文档自己的 IntersectionObserver 做视口懒包裹;
    // 拿不到(老浏览器)时退回旧版行为:一次性分批包裹全部块
    const IOWrapper = doc.defaultView && doc.defaultView.IntersectionObserver;
    if (IOWrapper) {
      if (this.io) this.io.disconnect();
      this.io = new IOWrapper(
        (entries) => {
          if (!this.doc || this.doc !== this.iframe.contentDocument) return;
          for (const entry of entries) {
            const el = entry.target;
            if (entry.isIntersecting) {
              // 进入"视口上下各一屏"范围:排队包裹
              if (
                !el.hasAttribute("data-pretext-ready") &&
                this.pendingWrap.indexOf(el) === -1
              ) {
                this.pendingWrap.push(el);
                if (!this.isPreparing) {
                  this.isPreparing = true;
                  requestAnimationFrame(this.processPendingWrap.bind(this));
                }
              }
            } else {
              // 离开范围:离得足够远才还原,防止边界上来回抖动
              const rect = el.getBoundingClientRect();
              const vh = doc.defaultView.innerHeight;
              if (rect.top > vh * 2.5 || rect.bottom < -vh * 2.5) {
                if (el.hasAttribute("data-pretext-ready")) {
                  this.unwrapBlock(el);
                }
              }
            }
          }
        },
        { root: null, rootMargin: "100% 0px 100% 0px", threshold: 0 },
      );
      blocks.forEach((b) => this.io.observe(b));
    } else {
      // 降级:一次性分批包裹全部块(旧版行为)
      this.pendingWrap = Array.prototype.slice.call(blocks);
    }

    if (this.pendingWrap.length > 0 && !this.isPreparing) {
      this.isPreparing = true;
      requestAnimationFrame(this.processPendingWrap.bind(this));
    }
    this.doc = doc;
    this.prepared = true;
    this.preparedDoc = doc;
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

    // 判断切文章:iframe 文档对象变了则彻底重置
    if (this.preparedDoc !== doc) {
      this.resetAll();
    }

    // 首次/换页:等 iframe 完全加载后开始准备(稍延迟避免页面仍在抖动)
    if (!this.prepared) {
      if (doc.readyState !== "complete") return;

      this.prepared = true;
      setTimeout(() => {
        if (this.iframe && this.iframe.contentDocument === doc) {
          this.prepareIframeText();
        }
      }, 800);
      return;
    }

    // 清理已经不在文档里的块(还原操作可能已被外界打断)
    if (this.activeBlocks.length > 0) {
      this.activeBlocks = this.activeBlocks.filter((b) => doc.contains(b.el));
    }

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

    // ★ 读写分离第一步:集中读取。
    //   先按块 rect 粗筛(只保留"视口内且桌宠附近"的块),
    //   再把入围块的所有 span 位置一次性读完。
    const scrollTop = doc.documentElement.scrollTop;
    const viewH = doc.defaultView.innerHeight;
    const margin = this.repelRadius + 100;

    const candidates = [];
    for (const blockObj of this.activeBlocks) {
      const pRect = blockObj.el.getBoundingClientRect();
      const pTopAbsolute = pRect.top + scrollTop;
      const pBottomAbsolute = pRect.bottom + scrollTop;

      // 块完全不在视口内:跳过(不读它的 span)
      if (pBottomAbsolute < scrollTop - 50 || pTopAbsolute > scrollTop + viewH + 50) {
        // 滚出视口但可能残留位移,便宜地整体复位
        blockObj.spans.forEach((span) => {
          if (
            span.style.transform !== "translate(0px, 0px)" &&
            span.style.transform !== ""
          ) {
            span.style.transform = "translate(0px, 0px)";
            span.style.zIndex = "1";
          }
        });
        continue;
      }

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
        continue;
      }

      // 块在桌宠附近:集中读出所有 span 的中心点
      const spanPos = [];
      for (const span of blockObj.spans) {
        const rect = span.getBoundingClientRect();
        spanPos.push([
          rect.left + rect.width / 2,
          rect.top + scrollTop + rect.height / 2,
        ]);
      }
      candidates.push({ blockObj, spanPos });
    }

    // ★ 读写分离第二步:集中写入,期间不再触发任何布局读取
    for (const { blockObj, spanPos } of candidates) {
      blockObj.spans.forEach((span, idx) => {
        const spanX = spanPos[idx][0];
        const spanY = spanPos[idx][1];

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
    }
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

  /* ============ 切换文章/关闭模态时彻底清理 ============ */
  resetAll() {
    this.activeBlocks = [];
    this.pendingWrap = [];
    this.isPreparing = false;
    if (this.io) {
      this.io.disconnect();
      this.io = null;
    }
    this.savedHTML = new Map();
    this.doc = null;
    this.prepared = false;
    this.preparedDoc = null;
  }
}
