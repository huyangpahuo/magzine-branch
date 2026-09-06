# Magzine Theme for Hexo

[中文](https://chatgpt.com/c/README.md)

A modern magazine-style Hexo theme with large-screen support, featuring a clean, elegant, and fast design. 👉 [Documentation](https://2am.top/2026/01/28/magzine主题指北/)

## Preview

Visit my [blog](https://2am.top/) or check out the preview snapshots:

## Features

- **Modern Design**: Clean and minimalist aesthetic with smooth interactions
- **Magazine-style Layout**: Dynamic article cards with multiple sizes and positions
- **Responsive Design**: Adapted for different devices with large-screen support
- **Highly Customizable**: Extensive theme configuration options
- **Performance Optimized**: Smooth scrolling and optimized animations
- **AI Summaries**: Integrated DeepSeek-powered article summaries
- **Tag Plugins**: Includes most of the tag plugins from the [AnZhiYu](https://blog.anheyu.com/posts/d50a.html) and [Butterfly](https://butterfly.js.org/posts/2df239ce/) themes

## Installation

1. Clone or download the theme into your Hexo project's `themes` directory:

```bash
git clone https://github.com/forever218/hexo-theme-magzine.git themes/magzine
```

1. Modify your Hexo site's `_config.yml` and set the theme to Magzine:

```yaml
theme: magzine
```

1. Install dependencies:

```bash
npm install
```

⚠️ Make sure your Hexo site's root `package.json` contains the following dependencies:

```json
{
  "hexo": "^7.0.0",
  "hexo-generator-archive": "^2.0.0",
  "hexo-generator-category": "^2.0.0",
  "hexo-generator-index": "^3.0.0",
  "hexo-generator-search": "^2.4.3",
  "hexo-generator-tag": "^2.0.0",
  "hexo-renderer-ejs": "^2.0.0",
  "hexo-renderer-marked": "^6.0.0",
  "hexo-renderer-pug": "^3.0.0",
  "hexo-renderer-stylus": "^3.0.0",
  "hexo-server": "^3.0.0",
  "hexo-theme-landscape": "^1.0.0",
  "hexo-util": "^3.3.0"
}
```

### Optional Enhancement Plugins

The following plugins provide additional features. They are optional and do not affect the normal operation of the theme if they are not installed.

| Plugin                         | Feature                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `hexo-wordcount`               | Post word count / reading time                               |
| `hexo-generator-search`        | Built-in search                                              |
| `hexo-filter-mermaid-diagrams` | Mermaid diagrams                                             |
| `sharp`                        | Automatic image compression (with the theme's `compress_images` configuration) |
| `hexo-asset-img`               | Insert images using `img` tags                               |
| `hexo-image-link`              | Insert images using `img` tags                               |

#### ① Post Word Count

Run the following command in your Hexo site's root directory:

```bash
npm install hexo-wordcount --save
```

#### ② Automatic Image Compression

Run the following command in your Hexo site's root directory:

```bash
npm install sharp --save
```

The theme supports automatic compression of article images and other image resources.

#### ③ Search

Run the following command in your Hexo site's root directory:

```bash
npm install hexo-generator-search@^2.4.3 --save
```

Then add the following configuration to the bottom of your Hexo site's `_config.yml`:

```yaml
# Search
search:
  path: search.json
  field: post
  content: true
  format: html
```

#### ④ Mermaid Diagrams

Run the following command in your Hexo site's root directory:

```bash
npm install hexo-filter-mermaid-diagrams --save
```

Then add the following configuration to the bottom of your Hexo site's `_config.yml`:

```yaml
# mermaid
mermaid:
  enable: true
  version: "10.6.1"
```

#### ⑤ Insert Images Using `img` Tags

If you want to insert images directly using HTML `img` tags in your articles, you can install:

```bash
npm install hexo-asset-img --save
npm install hexo-image-link --save
```

These two plugins do not disable or interfere with Markdown's native image syntax, so you can install them according to your needs.

## Contributing

1. Fork this repository
2. Create a feature branch
3. Make your changes
4. Add tests if necessary
5. Submit a Pull Request

## License

This theme is licensed under the **Apache License Version 2.0**. You are free to use, modify, and distribute this theme as long as you comply with the license terms.

## Support & Feedback

If you encounter any issues or have questions:

1. Check the [documentation](https://chatgpt.com/c/docs/)
2. Search existing [Issues](https://github.com/forever218/hexo-theme-magzine/issues)
3. Create a new Issue if necessary

## Credits

- [Hexo](https://hexo.io/) — Static site generator
- [Pug](https://pugjs.org/) — Template engine
- [Font Awesome](https://fontawesome.com/) — Icons