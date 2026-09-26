# Magzine Theme

A modern magazine-style Hexo theme: large-screen support, clean and elegant,
with a desktop pet, Sakana widget, comments, AI summary, music player and many
other toggleable components — plus deep performance work (build-time image
compression/WebP, viewport-based rendering, rAF-batched interactions).

[中文](README.md) | [Theme docs](docs/README.md)

## Preview

Check out my [blog](https://funingna-wakawaka.github.io/)

👉 [Tag syntax documentation](https://funingna-wakawaka.github.io/2026/03/22/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E4%B8%BB%E9%A2%98%E7%9A%84%E4%B8%80%E4%BA%9B%E6%A0%87%E7%AD%BE%E8%AF%AD%E6%B3%95/)

## Highlights

- **Performance**: route-stream image compression/WebP at build time
  (references rewritten automatically, single generate), site-wide deferred
  scripts, viewport-lazy comments/diagrams/formulas, offscreen content skipped
- **Code blocks v2**: light/dark adaptive cards, line numbers, copy, folding,
  wheel-to-horizontal scrolling
- **Viewers**: fullscreen image/table/Mermaid viewers with 1:1 drag follow,
  momentum and rubber-banding
- **Desktop pet**: state-machine AI, hair physics, text-avoidance
  (viewport-lazy wrapping, smooth on long articles)
- **Components**: Sakana widget, animated cursor, leaves/click effects,
  color picker, local search, RSS, pjax, bilingual UI, reader settings panel
- **Hero effects**: fluid simulation and animated Watercolor mode (mutually
  exclusive), with hover/touch interaction and reader-panel controls

## Installation

1. Clone or download the theme into the `themes` directory:

```bash
git clone https://github.com/huyangpahuo/magzine-branch.git themes/magzine
```

2. Set the theme in your site's `_config.yml`:

```yaml
theme: magzine
```

3. Install dependencies (`npm install`); make sure `package.json` includes:

```json
"hexo": "^8.0.0",
"hexo-generator-archive": "^2.0.0",
"hexo-generator-category": "^2.0.0",
"hexo-generator-feed": "^4.0.0",
"hexo-generator-index": "^4.0.0",
"hexo-generator-search": "^2.4.3",
"hexo-generator-tag": "^2.0.0",
"hexo-renderer-ejs": "^2.0.0",
"hexo-renderer-marked": "^7.0.0",
"hexo-renderer-pug": "^3.0.0",
"hexo-renderer-stylus": "^3.0.1",
"hexo-server": "^3.0.0",
"hexo-util": "^3.3.0"
```

### Optional plugins

| Plugin | Feature |
| --- | --- |
| `hexo-wordcount` | Word count / reading time |
| `hexo-generator-search` | Local search |
| `hexo-filter-mermaid-diagrams` | Mermaid diagrams |
| `sharp` | Build-time image compression/WebP (see `compress_images` in theme config) |
| `hexo-generator-feed` | RSS |
| `hexo-asset-img` `hexo-image-link` | Insert images via `img` tags |

#### ① Automatic image compression / WebP

Done automatically at build time; references are rewritten for you:

```bash
hexo clean && hexo generate   # that's all; hexo server previews compressed output too
```

See [the compression guide](docs/图片压缩与工作流指南.md) for details.

#### ② Local search

Add to the site's `_config.yml`:

```yaml
search:
  path: search.json
  field: post
  content: true
  format: html
```

#### ③ Mermaid diagrams

```yaml
mermaid:
  enable: true
  version: "10.6.1"
```

#### ④ Insert images via `img` tags

```yaml
post_asset_folder: true
marked:
  prependRoot: true
  postAsset: true
relative_link: false
```

#### ⑤ RSS

```yaml
feed:
  type: atom
  path: atom.xml
  limit: 20
  order_by: -date
```

⚠️ Set the real `url` in your site `_config.yml`, otherwise feed links are wrong.

## Documentation

Full technical docs live in [docs/](docs/README.md): architecture (with
diagrams), per-module inventory, build & deploy, config reference, and
performance design notes.

## Bilingual UI

Full i18n is beyond my ability for now; Simplified Chinese ↔ English switching
is supported.

## AI Summary

See [this post](https://funingna-wakawaka.github.io/2026/04/26/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E7%BB%99Blog%E5%A2%9E%E5%8A%A0AI%E6%80%BB%E7%BB%93%E5%8A%9F%E8%83%BD/) (Chinese).

## License

Released under the **Apache License 2.0**. Third-party assets keep their own
licenses — see credits below.

## Credits

This theme is a fork of [hexo-theme-magzine](https://github.com/forever218/hexo-theme-magzine)
by [forever218](https://github.com/forever218) — many thanks! The fork has
diverged heavily (vibe coding + manual review), so bugs may lurk; issues and
PRs are welcome.

### Frameworks & engines

| Project | Used for |
| --- | --- |
| [Hexo](https://hexo.io/) | Static site framework |
| [Pug](https://pugjs.org/) | Template engine |
| [Stylus](https://stylus-lang.com/) / [marked](https://marked.js.org/) | Styles & Markdown (hexo-renderer-*) |
| [highlight.js](https://highlightjs.com/) (built into hexo-util) | Server-side code highlighting |
| [sharp](https://sharp.pixelplumbing.com/) | Build-time image compression/WebP |

### UI assets & widgets

| Project | Used for |
| --- | --- |
| [Font Awesome 6.4.0](https://fontawesome.com/) | Site-wide icons (self-hosted in `lib/font-awesome/`) |
| Anya animated cursor | Cursor frames — see asset author below |
| [Sakana widget](https://github.com/itorr/sakana) by itorr | Hanging character (engine & art self-hosted, swing tuned gentler) |
| [threejs-components liquid1](https://github.com/Dirack/Threejs-components) (via jsDelivr) | Cover WebGL liquid background (self-hosted) |
| Inter / Playfair Display / Fira Code | Font-stack names kept; rendered with system fallbacks (Google Fonts dependency removed) |

### Features & external services

| Project | Used for |
| --- | --- |
| [twikoo](https://twikoo.js.org/) (self-hosted) | Comments (default); also supports [Disqus](https://disqus.com/), [Gitalk](https://github.com/gitalk/gitalk), [Valine](https://valine.js.org/) |
| [MathJax 3](https://www.mathjax.org/) (jsDelivr, on demand) | Math formulas |
| [Mermaid 10](https://mermaid.js.org/) (cdnjs, viewport-lazy) | Diagrams |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) (cdnjs, loaded on click) | WeChat share QR code |
| [Post-Summary-AI](https://github.com/qxchuckle/Post-Summary-AI) by qxchuckle | AI summary style & solution (tianli0 CDN) |
| Bilibili / AcFun / Huya embeds | Video tags (overseas platforms need readers' own network) |

### Asset authors

**Anya animated cursor** (converted from a Windows cursor pack, frame-by-frame):

- Cursor owner: [Instagram @BySuspect](https://www.instagram.com/reel/CfNbAZelpGz/?igshid=YmMyMTA2M2Y=)
- Support the author: [Buy Me a Coffee](https://www.buymeacoffee.com/BySuspect)
- Tutorial Video: [YouTube](https://www.youtube.com/watch?v=Dyd3Ep7NzrM&t=4s)

If any of your assets are listed and you'd like them removed or credited
differently, please open an issue.
