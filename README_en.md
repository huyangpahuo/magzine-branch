# Magzine Theme

A modern magazine-style Hexo theme: large-screen support, clean and elegant,
with a desktop pet, Sakana widget, comments, AI summary, music player, WebGL
hero effects and many other toggleable components — plus deep performance work
(build-time image compression/WebP, viewport-based rendering, rAF-batched
interactions).

**Multilingual**: Chinese / English / Japanese / Russian UI switches at runtime;
adding a language means adding a single yml file.

[中文](README.md) | [Theme docs](docs/README.md)

## Preview

Check out my [blog](https://funingna-wakawaka.github.io/)

👉 [Tag syntax documentation](https://funingna-wakawaka.github.io/2026/03/22/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E4%B8%BB%E9%A2%98%E7%9A%84%E4%B8%80%E4%BA%9B%E6%A0%87%E7%AD%BE%E8%AF%AD%E6%B3%95/)

### Light & Dark

| Light · Home | Dark · Home |
|---|---|
| <img src="docs/images/亮色模式-主页.png" width="460" alt="Light home"> | <img src="docs/images/暗色模式-主页.png" width="460" alt="Dark home"> |

| Light · Article | Dark · Article |
|---|---|
| <img src="docs/images/亮色模式-文章页.png" width="460" alt="Light article"> | <img src="docs/images/暗色模式-文章页.png" width="460" alt="Dark article"> |

### Standalone pages

| About | Links |
|---|---|
| <img src="docs/images/关于页.png" width="460" alt="About page"> | <img src="docs/images/友链页.png" width="460" alt="Links page"> |

| Anime | Categories |
|---|---|
| <img src="docs/images/追番页.png" width="460" alt="Anime page"> | <img src="docs/images/分类页.png" width="460" alt="Categories page"> |

| Tags | Multilingual UI |
|---|---|
| <img src="docs/images/标签页.png" width="460" alt="Tags page"> | <img src="docs/images/i18n.png" width="460" alt="Multilingual UI"> |

## Highlights

- **Multilingual**: Chinese/English/Japanese/Russian UI switches live; content
  fields (`title_en`…), date formats and the AI's reply language all follow.
  Adding a language = adding one `language/xx.yml`
- **Performance**: route-stream image compression/WebP at build time
  (references rewritten automatically, single generate), site-wide deferred
  scripts, viewport-lazy comments/diagrams/formulas, offscreen content skipped
- **Hero effects**: fluid simulation and watercolor glow (WebGL) with an
  extensible framework and a visual tuning panel (persistent params,
  auto-pause when offscreen)
- **Code blocks v2**: light/dark adaptive cards, line numbers, copy, folding,
  wheel-to-horizontal scrolling, language badge
- **Viewers**: fullscreen image/table/Mermaid viewers with 1:1 drag follow,
  momentum and rubber-banding
- **Desktop pet**: state-machine AI, hair physics, text-avoidance
  (viewport-lazy wrapping, smooth on long articles), built-in mini player,
  right-click menu
- **Components**: Sakana widget, animated cursor, leaves/click effects,
  color picker, local search, RSS, pjax, reader settings panel
- **Content tags**: button / image / carousel / folding / note / hide / label /
  tabs / timeline / video (click-to-load facades, never autoplay)
- **AI summary**: built-in "Alona" panel whose prompt language follows the UI

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

## Custom Animated Cursor (convert Windows cursor packs)

The CSS `cursor` property only accepts static images — **`.ani` animated cursors are
not supported natively**, so cursor packs downloaded from the web can't be used
as-is. The companion tool
[**web-cursor-converter-skill**](https://github.com/huyangpahuo/web-cursor-converter-skill)
splits `.ani` / `.cur` files into per-frame PNGs + hotspot coordinates + a
manifest, and the theme's CSS/JS plays them back at the original frame rate.

### Usage

```bash
# 1. Drop the skill into your project (use ~/.agents/skills/ for a global install)
cp -r web-cursor-converter ~/.agents/skills/

# 2. Install the dependency
pip install pillow

# 3. Convert: input cursor-pack dir → theme output dir; last arg is the cursor size (px)
python .agents/skills/web-cursor-converter/scripts/cursor_convert.py \
  <downloaded cursor pack dir> \
  themes/magzine/source/cursors/anya \
  32
```

You can also just hand the cursor pack to an AI and say "convert this cursor pack
with web-cursor-converter".

### Output layout

```
source/cursors/anya/
├── normal/     0.png 1.png …      # one directory per cursor type, frame-by-frame PNGs
├── link/  text/  busy/  working/  …
└── data.js                        # frame list / frame interval (ms) / hotspot / size
```

`data.js` looks like:

```js
window.ANYA_CURSOR = {
  busy: { frames: ["busy/0.png", "busy/1.png", …], ms: 100, hotspot: [16, 7], size: 32 },
  …
};
```

### How the theme plays it

| Piece | Location |
|---|---|
| Cursor frames & manifest | `source/cursors/anya/` |
| `cursor` declarations | `source/css/components/cursor.css` (`--anya-cursor-*` variables) |
| Frame stepping | `source/js/effects/anya-cursor.js` (multi-frame types cycle by `ms`; single-frame types set once; pauses when idle) |
| Master switch | `cursor.enable` in the theme `_config.yml` |

### Notes

- `source/cursors/` is on the image-compression `protect` list, so frames are
  **never renamed or converted to WebP** (the front end builds paths dynamically);
- The generated `data.js` variable name must match what the front end reads
  (`window.ANYA_CURSOR` in this theme). If your output uses another name, rename
  it in `data.js` or update the reference in `anya-cursor.js`;
- The tool itself is **GPL-3.0**. When swapping in your own cursor art, respect
  the original author's license.

## Multilingual

UI strings live in `themes/magzine/language/`:

```
language/
├── zh.yml    base dictionary (key = entry id, value = Chinese source text)
├── en.yml    English
├── ja.yml    Japanese
└── ru.yml    Russian (top-level _meta holds the flag/label for the switcher)
```

At build time `scripts/other/lang-dict.js` zips them into
`js/core/lang-dict.js`; at runtime `core/lang-switch.js` looks strings up. The
language button cycles through whatever language files exist, and date formats,
data fields (e.g. `title_en`) and the AI's reply language all follow the
current language.

**Adding a language**: copy `en.yml`, translate, edit `_meta`, run
`hexo generate` — no template or JS changes needed. See
[the i18n doc](docs/06-国际化架构.md) (Chinese).

## Documentation

Full technical docs live in [docs/](docs/README.md) (Chinese): architecture
(with diagrams), per-module inventory, build & deploy, config reference,
performance design, i18n architecture, hero-effects framework, pet system and
content tag syntax.

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
| [highlight.js](https://highlightjs.org/) (built into hexo-util) | Server-side code highlighting |
| [sharp](https://sharp.pixelplumbing.com/) | Build-time image compression/WebP |

### Effects & visuals

| Project | Used for |
| --- | --- |
| [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) by Pavel Dobryakov | **Hero fluid simulation** (MIT; adapted: transparent compositing over the hero, palette from the background image, hover/touch interaction, quality tiers) |
| [Shadertoy: lsyfWD](https://www.shadertoy.com/view/lsyfWD) | **Hero watercolor glow** (shader approach referenced; implemented locally on a transparent canvas, no remote iframe or API key) |
| [liquid-refraction-lab](https://github.com/feitangyuan/liquid-refraction-lab) | **Splash cover liquid refraction background** (WebGL, self-hosted) |
| [Sakana widget](https://github.com/itorr/sakana) by itorr | Hanging character (engine & art self-hosted, swing tuned gentler) |
| [Font Awesome 6.4.0](https://fontawesome.com/) | Site-wide icons (self-hosted in `lib/font-awesome/`) |
| Anya animated cursor | Cursor frames — see asset author below |
| Inter / Playfair Display / Fira Code | Font-stack names kept; rendered with system fallbacks (Google Fonts dependency removed) |

### Features & external services

| Project | Used for |
| --- | --- |
| [twikoo](https://twikoo.js.org/) (self-hosted) | Comments (default); also supports [Disqus](https://disqus.com/), [Gitalk](https://github.com/gitalk/gitalk), [Valine](https://valine.js.org/) |
| [MathJax 3](https://www.mathjax.org/) (jsDelivr, on demand) | Math formulas |
| [Mermaid 10](https://mermaid.js.org/) (cdnjs, viewport-lazy) | Diagrams |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) (cdnjs, loaded on click) | WeChat share QR code |
| [Post-Summary-AI](https://github.com/qxchuckle/Post-Summary-AI) by qxchuckle | AI summary style & solution |
| Bilibili / AcFun / Huya embeds | Video tags (overseas platforms need readers' own network) |

### Content & asset sources

| Source | Used for |
| --- | --- |
| [Bangumi](https://bangumi.tv/) | **Anime covers and character info** API source for the anime page |
| [HAOWALLPAPER](https://haowallpaper.com/) | **Wallpaper images** used on the site |
| Bilibili **乌龙茶速递** | **Desktop pet assets & prototype**: adapted from "【BA同人游戏】番外-简单摸鱼写的爱丽丝桌宠" ([video BV1MmdjY3E8r](https://www.bilibili.com/video/BV1MmdjY3E8r)) |

Thanks to the authors and platforms above. If you are a rights holder and want
the credit changed or the asset removed, please open an issue.

### Asset authors

**Anya animated cursor** (converted from a Windows cursor pack, frame-by-frame):

- Cursor owner: [Instagram @BySuspect](https://www.instagram.com/reel/CfNbAZelpGz/?igshid=YmMyMTA2M2Y=)
- Support the author: [Buy Me a Coffee](https://www.buymeacoffee.com/BySuspect)
- Tutorial Video: [YouTube](https://www.youtube.com/watch?v=Dyd3Ep7NzrM&t=4s)
- Converter: [web-cursor-converter-skill](https://github.com/huyangpahuo/web-cursor-converter-skill) (built by this project; see "Custom Animated Cursor" above)

## Contributors

Thanks to everyone who has contributed code or feedback:

<a href="https://github.com/huyangpahuo/magzine-branch/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=huyangpahuo/magzine-branch&max=100" alt="Contributors" />
</a>

> The image above is generated by [contrib.rocks](https://contrib.rocks) from
> the repository's GitHub contributors list and updates automatically.

Issues and PRs are welcome.
