/**
 * carousel.js | 图片轮播标签
 *
 * 在文章里把多张图片以轮播图形式展示:
 *
 *   {% carousel %}
 *   <img src="文章资源文件夹/1.png" alt="说明文字">
 *   <img src="文章资源文件夹/2.png">
 *   {% endcarousel %}
 *
 * 可选参数(空格分隔,可任意组合,顺序不限):
 *   interval=4000  自动播放间隔(毫秒),0 表示关闭自动播放,默认 4000
 *   height=480     轮播窗口固定高度(px),默认 480;手机端自动按屏宽收缩
 *   ratio=16:9     改用固定宽高比模式(设置后 height 失效),一般不用
 *   fit=contain    图片缩放方式:contain(等比缩放不裁剪,默认)/ cover(裁剪铺满)
 *   dots=false     是否显示圆点指示器,默认 true
 *
 * 每行一张图片。除了直接写 <img> 标签和 Markdown 图片外,还会自动识别
 * 渲染流水线(hexo-asset-img / hexo-image-link)改写出来的 {% asset_img %} 行:
 *
 *   在文章里写 <img src="文章名/图.png"> 或 ![](文章名/图.png) 时,
 *   before_post_render 阶段插件会先把它们改写成 {% asset_img ... %},
 *   传到本标签的内容里已经是改写后的样子,所以这里要一并解析。
 *   相对路径(相对文章资源的文件名)会按当前文章的访问路径补全成绝对路径。
 */

'use strict'

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 相对路径 -> 当前文章资源下的绝对路径;绝对/外链原样返回
function resolveUrl(url, pagePath) {
  if (!url) return url
  if (/^(https?:\/\/|\/|data:|#)/i.test(url)) return url
  return (pagePath || '') + url.split('/').pop()
}

// 解析 {% asset_img ... %} 行(hexo-asset-img / hexo-image-link 的产物)
// 两种格式:
//   {% asset_img "图片.png" "说明" %}          (hexo-image-link 的 markdown 转换)
//   {% asset_img a1b2c3d4 图片.png '"标题""说明"' %} (hexo-asset-img 的 img 转换)
function parseAssetImgLine(line, pagePath) {
  const m = line.match(/^\{%\s*asset_img\s+(.+?)\s*%\}$/)
  if (!m) return null
  let rest = m[1]
  let caption = ''

  // hexo-asset-img 把 title/alt 塞进一个 '"标题""说明"' 的单引号串
  const blob = rest.match(/'([^']*)'\s*$/)
  if (blob) {
    caption = blob[1]
      .split('""')
      .map(function (s) { return s.replace(/^"|"$/g, '').trim() })
      .filter(Boolean)
      .join(' ')
    rest = rest.slice(0, blob.index)
  }

  const quoted = rest.match(/"([^"]+)"/g)
  let file
  if (quoted && quoted.length) {
    // hexo-image-link 格式:第一个引号串是文件名,第二个是说明
    file = quoted[0].slice(1, -1)
    if (!caption && quoted[1]) caption = quoted[1].slice(1, -1)
  } else {
    // hexo-asset-img 格式:类名 文件名(或只有文件名)
    const parts = rest.trim().split(/\s+/)
    file = parts.length > 1 ? parts[1] : parts[0]
  }
  if (!file) return null
  return { url: resolveUrl(file, pagePath), caption: caption }
}

// 从 <img> 标签字符串里取属性值(单引号/双引号/无引号都认)
function imgAttr(line, name) {
  const m = line.match(
    new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'),
  )
  return m ? (m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || '') : ''
}

// 逐行解析图片:asset_img 行、<img> 标签、Markdown 图片语法或裸 URL
function parseImages(content, pagePath) {
  const lines = content.split(/\r?\n/)
  const images = []
  const mdImage = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+("[^"]*"|'[^']*'))?\s*\)/
  const bareUrl = /^(https?:\/\/|\/)[^\s]+\.(\w+)(\?\S*)?$/i

  lines.forEach(function (line) {
    line = line.trim()
    if (!line) return

    // {% asset_img ... %} 行(渲染流水线改写产物)
    const asset = parseAssetImgLine(line, pagePath)
    if (asset) {
      images.push(asset)
      return
    }

    // <img src="..." alt="..." title="..."> 格式
    if (/<img\b/i.test(line)) {
      const src = imgAttr(line, 'src')
      if (src) {
        images.push({
          url: resolveUrl(src, pagePath),
          caption: (imgAttr(line, 'alt') || imgAttr(line, 'title')).trim(),
        })
      }
      return
    }

    const m = line.match(mdImage)
    if (m) {
      const alt = (m[1] || '').trim()
      const title = m[3] ? m[3].slice(1, -1).trim() : ''
      images.push({ url: resolveUrl(m[2], pagePath), caption: alt || title })
      return
    }
    if (bareUrl.test(line)) images.push({ url: line, caption: '' })
  })
  return images
}

function carousel(args, content) {
  // Hexo 调用标签时 this 就是文章/页面对象:path 是访问路径
  // (形如 2026/09/14/文章名/,自带结尾斜杠),用于补全相对路径
  const pagePath = (this && (this.path || (this.page && this.page.path))) || ''
  const root = (hexo.config.root || '/').replace(/\/?$/, '/')
  const base = root + pagePath

  // 参数解析:args 是逗号/空格混合,统一按空白拆 key=value
  // 默认固定高度 + 等比缩放(contain);传 ratio 则切换为宽高比模式
  const opts = { interval: 4000, height: 480, ratio: '', fit: 'contain', dots: true }
  ;(args.join(' ') || '').split(/\s+/).forEach(function (token) {
    const kv = token.split('=')
    if (kv.length !== 2) return
    const key = kv[0].trim().toLowerCase()
    const value = kv[1].trim()
    if (key === 'interval') {
      const n = parseInt(value, 10)
      if (!isNaN(n) && n >= 0) opts.interval = n
    } else if (key === 'height') {
      const n = parseInt(value, 10)
      if (!isNaN(n) && n >= 120) opts.height = n
    } else if (key === 'ratio') {
      if (/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(value)) opts.ratio = value
    } else if (key === 'fit') {
      if (value === 'contain' || value === 'cover') opts.fit = value
    } else if (key === 'dots') {
      opts.dots = value !== 'false'
    }
  })

  const images = parseImages(content, base)
  if (!images.length) return ''

  // 输出尺寸模式:固定高度(默认)或固定宽高比(ratio 参数)
  // fit 是图片缩放方式,交给 CSS 的 object-fit 处理
  const sizeStyle = opts.ratio
    ? '--carousel-ratio:' + opts.ratio.split(':').join(' / ') + ';--carousel-fit:' + opts.fit + ';'
    : '--carousel-h:' + opts.height + 'px;--carousel-fit:' + opts.fit + ';'
  const many = images.length > 1
  const hasCaption = images.some(function (img) { return img.caption })

  const slides = images
    .map(function (img, i) {
      return (
        '<figure class="carousel-slide' + (i === 0 ? ' active' : '') + '">' +
        '<img src="' + escapeHtml(img.url) + '" alt="' + escapeHtml(img.caption || '') + '"' +
        (i === 0 ? '' : ' loading="lazy"') +
        ' draggable="false"/>' +
        '</figure>'
      )
    })
    .join('')

  const captions = images
    .map(function (img, i) {
      return img.caption
        ? '<figcaption class="carousel-caption' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' + escapeHtml(img.caption) + '</figcaption>'
        : ''
    })
    .join('')

  const dots = opts.dots && many
    ? '<div class="carousel-dots">' +
      images.map(function (_, i) {
        return '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" type="button" data-index="' + i + '" aria-label="跳到第' + (i + 1) + '张"></button>'
      }).join('') +
      '</div>'
    : ''

  const arrows = many
    ? '<button class="carousel-arrow carousel-prev" type="button" aria-label="上一张">&#10094;</button>' +
      '<button class="carousel-arrow carousel-next" type="button" aria-label="下一张">&#10095;</button>'
    : ''

  return (
    '<div class="carousel' + (many ? '' : ' carousel-single') + (hasCaption ? ' has-caption' : '') + (opts.ratio ? ' ratio-mode' : '') + '"' +
    ' data-interval="' + opts.interval + '"' +
    ' style="' + sizeStyle + '"' +
    ' role="region" aria-roledescription="轮播图" aria-label="图片轮播"' +
    ' tabindex="0"' +
    '>' +
    '<div class="carousel-viewport">' +
    '<div class="carousel-track">' + slides + '</div>' +
    arrows +
    '</div>' +
    captions +
    dots +
    (many ? '<div class="carousel-counter">1 / ' + images.length + '</div>' : '') +
    '</div>'
  )
}

hexo.extend.tag.register('carousel', carousel, { ends: true })
