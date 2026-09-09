# Magzine Theme

A modern magazine-style Hexo theme with large-screen support, featuring a clean, elegant, and fast design.

[中文](README.md)

## Preview

Check out my [Blog](https://funingna-wakawaka.github.io/)

👉 [Documentation](https://funingna-wakawaka.github.io/2026/03/22/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E4%B8%BB%E9%A2%98%E7%9A%84%E4%B8%80%E4%BA%9B%E6%A0%87%E7%AD%BE%E8%AF%AD%E6%B3%95/)

## Installation

1. Clone or download the theme into the `themes` directory of your Hexo project:

```bash
git clone https://github.com/huyangpahuo/magzine-branch.git themes/magzine
```

2. Modify the `_config.yml` file in your Hexo site and set the theme to Magzine:

```yaml
theme: magzine
```

3. Install dependencies:

```bash
npm install
```

⚠️ Make sure the `package.json` in your Hexo root directory contains the following dependencies:

```json
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
```

### Optional Enhancement Plugins

The following plugins provide additional features. They are optional and will not affect the normal operation of the theme if not installed.

| Plugin | Function |
| ------------------------------ | ------------------------------------------------------------ |
| `hexo-wordcount` | Article word count / Reading time |
| `hexo-generator-search` | Site search |
| `hexo-filter-mermaid-diagrams` | Mermaid diagrams |
| `sharp` | Automatic image compression (used with the `compress_images` setting in the theme's `_config.yml`) |
| `hexo-asset-img` | Insert article images using the `img` tag |
| `hexo-image-link` | Insert article images using the `img` tag |

#### ① Article Word Count

Run the following command in the Hexo root directory:

```bash
npm install hexo-wordcount --save
```

#### ② Automatic Image Compression

Run the following command in the Hexo root directory:

```bash
npm install sharp --save
```

The theme supports automatic compression of article images and other image resources. The process may take some time.

Compressing 1,500 images totaling 1.5 GB takes approximately 2–3 minutes, depending on the settings in `_config.yml`.

There are two ways to trigger the image compression:

- (1) `hexo clean` + `hexo generate` + `hexo generate` + `hexo deploy` (Compress and deploy only)
- (2) `hexo clean` + `hexo generate` + `hexo server` + `hexo deploy` (Compress, preview, and deploy)

The following output indicates that the process completed successfully:

```text
🚀 [Image Compressor] Starting image optimization..
🎉 [Image Compressor] Finished! Processed 619 images. Saved 190.29 MB.
```

#### ③ Search Function

Run the following command in the Hexo root directory:

```bash
npm install hexo-generator-search@^2.4.3 --save
```

Then add the following configuration to the bottom of the `_config.yml` file in the Hexo root directory:

```yaml
# Search
search:
  path: search.json
  field: post
  content: true
  format: html
```

#### ④ Mermaid Diagrams

Run the following command in the Hexo root directory:

```bash
npm install hexo-filter-mermaid-diagrams --save
```

Then add the following configuration to the bottom of the `_config.yml` file:

```yaml
# mermaid
mermaid:
  enable: true
  version: "10.6.1"
```

#### ⑤ Insert Images Using the `img` Tag

If you want to insert images directly into articles using HTML's `img` tag, you can install:

```bash
npm install hexo-asset-img --save
npm install hexo-image-link --save
```

Hexo also provides its own built-in image insertion method. See the [official Hexo documentation](https://hexo.io/zh-cn/docs/asset-folders) for details.

## Bilingual Support

Due to my limited knowledge, I am currently unable to implement full i18n support. The theme currently supports Chinese and English.

## AI Comment Function

See the [article](https://funingna-wakawaka.github.io/2026/04/26/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E7%BB%99Blog%E5%A2%9E%E5%8A%A0AI%E6%80%BB%E7%BB%93%E5%8A%9F%E8%83%BD/) for instructions.

## License

This theme is licensed under the **Apache License Version 2.0**. You are free to use, modify, and distribute this theme in accordance with the license.

## Acknowledgements

Thanks to [forever218](https://github.com/forever218).

This theme is a fork of the [magzine theme](https://github.com/forever218/hexo-theme-magzine). Due to the extensive modifications I have made, as well as the use of Vibe Coding + manual review, there may be overlooked issues or hidden bugs, and the theme may lack stability.

It is no longer suitable for merging back into the original theme.