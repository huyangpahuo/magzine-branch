# Magzine Theme

A modern magazine-style Hexo theme with large-screen support, simplicity, elegance, and fast performance.

[中文](README.md)

## Preview

Check out my [blog](https://funingna-wakawaka.github.io/)

👉 [Documentation](https://funingna-wakawaka.github.io/2026/03/22/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E4%B8%BB%E9%A2%98%E7%9A%84%E4%B8%80%E4%BA%9B%E6%A0%87%E7%AD%BE%E8%AF%AD%E6%B3%95/)

## Installation

1. Clone or download the theme into the `themes` directory of your Hexo project:

```bash
git clone https://github.com/huyangpahuo/magzine-branch.git themes/magzine
```

2. Modify the `_config.yml` file of your Hexo site and set the theme to Magzine:

```yaml
theme: magzine
```

3. Install dependencies:

```bash
npm install
```

⚠️ Make sure that the `package.json` in the root directory of your Hexo project contains the following dependencies:

```json
"hexo": "^7.0.0",
"hexo-asset-img": "^1.2.0",
"hexo-generator-archive": "^2.0.0",
"hexo-generator-category": "^2.0.0",
"hexo-generator-feed": "^4.0.0",
"hexo-generator-index": "^3.0.0",
"hexo-generator-search": "^2.4.3",
"hexo-generator-tag": "^2.0.0",
"hexo-image-link": "^0.0.6",
"hexo-renderer-ejs": "^2.0.0",
"hexo-renderer-marked": "^6.0.0",
"hexo-renderer-pug": "^3.0.0",
"hexo-renderer-stylus": "^3.0.0",
"hexo-server": "^3.0.0",
"hexo-theme-landscape": "^1.0.0",
"hexo-util": "^3.3.0"
```

### Additional Plugins

The following plugins provide additional functionality:

| Plugin | Function |
| ------------------------------------- | ------------------------------------------------------------ |
| `hexo-wordcount` | Word count / Reading time |
| `hexo-generator-search` | Site search |
| `hexo-filter-mermaid-diagrams` | Mermaid diagrams |
| `sharp` | Automatic image compression (used together with the `compress_images` option in the theme's `_config.yml`) |
| `hexo-generator-feed` | RSS feed |
| `hexo-asset-img`<br>`hexo-image-link` | Insert images using the `img` tag |

#### ① Automatic Image Compression

The theme supports automatic compression of images in articles and other image resources. This process may take some time.

Compressing 2,262 images with a total size of 2.52 GB takes approximately 7–8 minutes. You can adjust the image compression quality in `_config.yml`.

There are two ways to trigger image compression:

- (1) `hexo clean` + `hexo generate` + `hexo generate` + `hexo deploy` (compress and deploy only)
- (2) `hexo clean` + `hexo generate` + `hexo server` + `hexo deploy` (compress, preview, and deploy)

The following output indicates that the process completed successfully:

```bash
🚀 [Image Compressor] Starting image optimization...
🎉 [Image Compressor] Finished! Processed 2262 images. Saved 1644.56 MB.
```

#### ② Search

Add the following configuration to the bottom of the `_config.yml` file in the root directory of your Hexo project:

```yaml
# Search
search:
  path: search.json
  field: post
  content: true
  format: html
```

#### ③ Mermaid Diagrams

Then add the following configuration to the bottom of the `_config.yml` file in the root directory of your Hexo project:

```yaml
# mermaid
mermaid:
  enable: true
  version: "10.6.1"
```

#### ④ Insert Images Using the `img` Tag

`hexo-asset-img` and `hexo-image-link` allow you to insert images using HTML's `img` tag directly in your posts.

You still need to add or configure the following settings at the bottom of the `_config.yml` file in the root directory of your Hexo project:

```yaml
post_asset_folder: true
marked:
  prependRoot: true
  postAsset: true
  relative_link: false
```

Of course, Hexo also provides its own built-in method for inserting images. See the [official Hexo documentation](https://hexo.io/zh-cn/docs/asset-folders) for details.

#### ⑤ RSS Feed

Add the following configuration to the bottom of the `_config.yml` file in the root directory of your Hexo project to enable RSS:

```yaml
# RSS Feed
feed:
  type: atom
  path: atom.xml
  limit: 20
  order_by: -date
```

The feed URL is:

`https://your-domain.com/atom.xml`

⚠️ Make sure to change the `url` in the `_config.yml` file in the root directory of your Hexo project to your actual site URL (the default value is `http://example.com`). Otherwise, the article links in the feed will be incorrect.

```yaml
# URL
## Set your site url here. For example, if you use GitHub Page, set url as 'https://username.github.io/project'
url: http://example.com
```

## Bilingual Theme

Due to my limited knowledge, I am currently unable to implement full i18n support, so the theme currently only supports Chinese and English.

## AI Comment Feature

See this [article](https://funingna-wakawaka.github.io/2026/04/26/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E7%BB%99Blog%E5%A2%9E%E5%8A%A0AI%E6%80%BB%E7%BB%93%E5%8A%9F%E8%83%BD/) for instructions.

## License

This theme is open-sourced under the **Apache License Version 2.0**. You are free to use, modify, and distribute this theme as long as you comply with the terms of the license.

## Acknowledgements

Special thanks to [forever218](https://github.com/forever218).

This theme is a branch version of the [magzine theme](https://github.com/forever218/hexo-theme-magzine). Since my modifications are extensive and were developed through Vibe Coding + manual review, there may be things I have overlooked and hidden bugs, so stability is not guaranteed.

If you encounter any issues, feel free to report them through an issue. Alternatively, you can let AI fix the problem and submit a PR!