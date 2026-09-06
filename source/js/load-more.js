// ===== Load More Articles (多语言适配 + 智能去重 + 全局随机排版版) =====

/**
 * 核心排版函数：为文章列表应用随机大小样式
 * @param {NodeList|Array} articles - 要处理的文章元素列表
 * @param {number} startIndex - 起始索引（用于保持排版规律的连续性）
 */
function applyRandomLayout(articles, startIndex = 0) {
  // 获取当前屏幕宽度，确定列数
  let columns = 3; // 默认3列
  const width = window.innerWidth;

  if (width <= 480) columns = 1;
  else if (width <= 768) columns = 2;
  else if (width <= 1200) columns = 3;
  else columns = 4; // 大屏4列

  articles.forEach((article, index) => {
    // 移除可能已存在的尺寸类，防止冲突
    article.className = article.className
      .replace(/\barticle-card--(large|medium|small|wide|tall)\b/g, "")
      .trim();

    // 如果是单列布局，不需要复杂排版，统一 medium 即可
    if (columns === 1) {
      article.classList.add("article-card--medium");
      return;
    }

    // 计算全局位置索引（基于总文章列表的连续性）
    const globalIndex = startIndex + index;
    const positionInRow = globalIndex % columns;

    let sizeClass = "article-card--medium"; // 默认值

    // 随机排版逻辑
    if (columns === 2) {
      // 双列布局：每行的第一个元素有概率变大或变高
      if (positionInRow === 0) {
        sizeClass =
          Math.random() > 0.5 ? "article-card--large" : "article-card--tall";
      }
    } else if (columns === 3) {
      // 三列布局：每行的第一个元素有概率变宽或变大
      if (positionInRow === 0) {
        sizeClass =
          Math.random() > 0.5 ? "article-card--wide" : "article-card--large";
      }
    } else {
      // 四列及以上
      if (positionInRow === 0) {
        sizeClass = "article-card--large";
      } else if (positionInRow === 1) {
        sizeClass =
          Math.random() > 0.5 ? "article-card--tall" : "article-card--wide";
      }
    }

    // 添加计算出的尺寸类
    article.classList.add(sizeClass);
  });
}

function initLoadMore() {
  const articlesGrid = document.querySelector(".articles-grid");
  const loadMoreBtn = document.querySelector(".load-more-btn");

  // 1. === 初始化排版（针对页面已有文章）===
  if (articlesGrid) {
    const initialArticles = articlesGrid.querySelectorAll(".article-card");
    if (initialArticles.length > 0) {
      applyRandomLayout(initialArticles, 0);
    }
  }

  // 如果没有按钮，说明不需要加载更多逻辑，直接返回
  if (!loadMoreBtn) return;

  // ★ 防止重复初始化:main.js 与本文件都定义并调用了 initLoadMore(同名函数,
  //   后加载者覆盖前者,但两处 DOMContentLoaded 都会执行),不加守卫会绑定两次点击
  if (loadMoreBtn.dataset.loadMoreInit) return;
  loadMoreBtn.dataset.loadMoreInit = "1";

  // 2. 获取当前语言状态 (从 localStorage 读取)
  function isEnglish() {
    return localStorage.getItem("site_lang") === "en";
  }

  // 3. 定义多语言文本
  const texts = {
    loading: {
      zh: '<span class="loading"></span> 加载中...',
      en: '<span class="loading"></span> Loading...',
    },
    loadMore: {
      zh: "加载更多文章",
      en: "Load More Articles",
    },
    noMore: {
      zh: "没有了哦~",
      en: "No more articles~",
    },
    error: {
      zh: "加载文章失败",
      en: "Error loading articles",
    },
  };

  // 获取辅助函数：根据当前语言返回文本
  const getText = (key) => (isEnglish() ? texts[key].en : texts[key].zh);

  // ===== ‹ 页码 › 翻页器 =====
  // 页码 = 当前已完整展示的页数;箭头直接翻到对应页(pjax 无感)
  function basePath() {
    return (
      window.location.pathname.replace(/\/$/, "").replace(/\/page\/\d+$/, "") +
      "/"
    );
  }

  function pageUrl(p) {
    return p <= 1 ? basePath() : basePath() + "page/" + p + "/";
  }

  function goPage(p) {
    if (p < 1) return;
    const url = pageUrl(p);
    if (window.__magzinePjax && typeof window.__magzinePjax.load === "function") {
      window.__magzinePjax.load(url, true);
    } else {
      location.href = url;
    }
  }

  function renderPager() {
    const container = loadMoreBtn.parentElement;
    if (!container) return;
    let pager = container.querySelector(".load-more-pager");
    if (!pager) {
      pager = document.createElement("div");
      pager.className = "load-more-pager";
      container.insertBefore(pager, loadMoreBtn);
    }
    const cur = parseInt(loadMoreBtn.getAttribute("data-current-page")) || 1;
    const total = parseInt(loadMoreBtn.getAttribute("data-total-pages")) || 1;

    pager.innerHTML = "";
    const prev = document.createElement("button");
    prev.className = "pager-arrow pager-prev";
    prev.textContent = "‹";
    prev.disabled = cur <= 1;
    prev.setAttribute("aria-label", "上一页");
    prev.addEventListener("click", () => goPage(cur - 1));

    const num = document.createElement("span");
    num.className = "pager-num";
    num.textContent = cur;

    const next = document.createElement("button");
    next.className = "pager-arrow pager-next";
    next.textContent = "›";
    next.disabled = cur >= total;
    next.setAttribute("aria-label", "下一页");
    next.addEventListener("click", () => goPage(cur + 1));

    pager.appendChild(prev);
    pager.appendChild(num);
    pager.appendChild(next);
  }

  renderPager();

  // 手机端:从文章返回主页时,恢复离开前追加的页数并定位到原位置
  document.addEventListener("home:restore", function (e) {
    const detail = e.detail || {};
    const targetPage = detail.page || 1;
    const scrollY = detail.scrollY || 0;
    const btn = document.querySelector(".load-more-btn");
    const finish = () => setTimeout(() => window.scrollTo(0, scrollY), 400);

    if (
      !btn ||
      targetPage <= (parseInt(btn.getAttribute("data-current-page")) || 1)
    ) {
      if (scrollY) finish();
      return;
    }

    const appendStep = () => {
      const cur = parseInt(btn.getAttribute("data-current-page")) || 1;
      if (cur >= targetPage) {
        finish();
        return;
      }
      // 恢复流程的每次点击都应执行"追加"而不是"翻页",先清掉追加标记
      delete btn.dataset.appended;
      btn.click(); // 复用加载逻辑追加下一页
      const check = setInterval(() => {
        const now = parseInt(btn.getAttribute("data-current-page")) || 1;
        if (now > cur) {
          clearInterval(check);
          appendStep();
        } else if (btn.disabled) {
          // 没有更多页了,直接定位
          clearInterval(check);
          finish();
        }
      }, 200);
    };
    appendStep();
  });

  // 初始化按钮文字
  if (isEnglish()) {
    if (loadMoreBtn.innerText.trim() === "加载更多文章") {
      loadMoreBtn.innerText = texts.loadMore.en;
    }
  }

  loadMoreBtn.addEventListener("click", function () {
    const btn = this; // 缓存 this
    // 获取当前页码和总页数
    const currentPage = parseInt(btn.getAttribute("data-current-page")) || 1;
    const totalPages = parseInt(btn.getAttribute("data-total-pages")) || 1;
    const nextPage = currentPage + 1;

    // 如果已经是最后一页，隐藏按钮并返回
    if (currentPage >= totalPages) {
      btn.innerHTML = getText("noMore");
      btn.style.opacity = "0.6";
      btn.disabled = true;
      return;
    }

    // ★ 屏幕上已经追加过一页(超过一页的内容)后,再点"加载更多"就翻到下一页,
    //   页码随之变化;首次点击仍然是在当前页追加
    if (btn.dataset.appended === "1") {
      goPage(nextPage);
      return;
    }
    btn.dataset.appended = "1";

    // 显示加载状态
    btn.innerHTML = getText("loading");
    btn.disabled = true;

    // 构建下一页URL (适配 /page/2/ 结构)
    let currentPath = window.location.pathname;
    currentPath = currentPath.replace(/\/$/, "").replace(/\/page\/\d+$/, "");
    if (currentPath === "") currentPath = "";

    const nextPageUrl = currentPath + "/page/" + nextPage + "/";

    // 获取下一页内容
    fetch(nextPageUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.text();
      })
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // 获取新页面的文章
        const newArticles = doc.querySelectorAll(".article-card");

        if (newArticles.length > 0 && articlesGrid) {
          // 获取当前页面已有文章数量，作为新文章排版的起始索引
          // 这保证了随机规律是连续的，不会因为分页而断层
          const currentCount =
            articlesGrid.querySelectorAll(".article-card").length;

          // 准备一个数组来存放真正要插入的（去重后的）新文章元素
          const articlesToInsert = [];

          // ★★★ 核心去重 ★★★
          const existingLinks = Array.from(
            articlesGrid.querySelectorAll(".article-title a"),
          ).map((a) => a.getAttribute("href"));

          newArticles.forEach((article) => {
            const newLinkTag = article.querySelector(".article-title a");
            const newLink = newLinkTag ? newLinkTag.getAttribute("href") : null;

            // 如果链接不存在，才放入待插入列表
            if (newLink && !existingLinks.includes(newLink)) {
              // 处理英文模式下的静态文本翻译
              if (isEnglish()) {
                const readMore = article.querySelector(".read-more");
                if (readMore && readMore.innerText.includes("阅读更多")) {
                  readMore.innerText = "Read More →";
                }
                const readOverlay = article.querySelector(".read-text");
                if (readOverlay && readOverlay.innerText.includes("点击阅读")) {
                  readOverlay.innerText = "Click to Read ->";
                }
              }

              // 设置初始透明度为0，用于动画
              article.style.opacity = "0";
              article.classList.add("fade-in");

              articlesToInsert.push(article);
              articlesGrid.appendChild(article);
            }
          });

          // ★★★ 对新插入的文章应用随机排版 ★★★
          // 传入 currentCount 作为起始索引，确保排版逻辑接续上一页
          if (articlesToInsert.length > 0) {
            applyRandomLayout(articlesToInsert, currentCount);

            // 简单的淡入动画
            articlesToInsert.forEach((article, idx) => {
              setTimeout(
                () => {
                  article.style.opacity = "1";
                },
                10 + idx * 100,
              );
            });
          } else if (nextPage < totalPages) {
            console.warn("未添加新文章，可能是重复内容");
          }

          // ★★★ 更新按钮状态 ★★★
          if (nextPage >= totalPages) {
            btn.innerHTML = getText("noMore");
            btn.style.opacity = "0.6";
            btn.disabled = true;
          } else {
            btn.innerHTML = getText("loadMore");
            btn.disabled = false;
            btn.setAttribute("data-current-page", nextPage);
            renderPager(); // 页码随追加更新
          }

          // 如果有全局翻译插件，触发它
          if (
            window.i18n &&
            typeof window.i18n.translateNode === "function" &&
            isEnglish()
          ) {
            window.i18n.translateNode(articlesGrid);
            // ★★★ 新增：调用日期翻译函数，处理新加载文章的日期 ★★★
            if (typeof window.i18n.translateDates === "function") {
              window.i18n.translateDates();
            }
          }
        } else {
          btn.innerHTML = getText("noMore");
          btn.style.opacity = "0.6";
          btn.disabled = true;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        btn.innerHTML = getText("error");
        btn.style.opacity = "0.6";
        btn.disabled = false;
      });
  });
}

// 当DOM加载完成后初始化
document.addEventListener("DOMContentLoaded", initLoadMore);
