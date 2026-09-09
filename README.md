# Magzine主题   

一款现代化的杂志风格 Hexo 主题，大屏支持，简洁、优雅、快速。

[English](README_en.md)


## 预览  
查看我的[博客](https://funingna-wakawaka.github.io/)

👉[使用文档](https://funingna-wakawaka.github.io/2026/03/22/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E4%B8%BB%E9%A2%98%E7%9A%84%E4%B8%80%E4%BA%9B%E6%A0%87%E7%AD%BE%E8%AF%AD%E6%B3%95/)

## 安装方法

1.  将主题克隆或下载到 Hexo 项目的 `themes` 目录：

``` bash
git clone https://github.com/huyangpahuo/magzine-branch.git themes/magzine
```

2.  修改 Hexo 站点的 `_config.yml` 文件，设置主题为 Magzine：

``` yaml
theme: magzine
```

3.  安装依赖：

``` bash
npm install
```

⚠️请确保hexo根目录的`package.json`包含以下依赖：
``` json
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

### 可选增强插件

以下插件用于提供额外功能，不安装也不会影响主题的正常运行

| 插件                           | 功能                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `hexo-wordcount`               | 文章字数统计 / 阅读时长                                      |
| `hexo-generator-search`        | 站内搜索                                                     |
| `hexo-filter-mermaid-diagrams` | Mermaid 图表                                                 |
| `sharp`                        | 图片自动压缩（配合主题 `_config.yml` 中的 `compress_images` 配置） |
| `hexo-asset-img`               | 使用 `img` 标签插入文章图片                                  |
| `hexo-image-link`              | 使用 `img` 标签插入文章图片                                  |

#### ① 文章字数统计

在 Hexo 根目录执行：

```bash
npm install hexo-wordcount --save
```

#### ② 图片自动压缩

在 Hexo 根目录执行：

```bash
npm install sharp --save
```

主题支持自动压缩文章及其他图片资源,耗时可能较长

压缩1500张共1.5GB的图片约2~3分钟,按照_config.yml中的预设也就是

触发操作有两种

- (1)`hexo clean` + `hexo generate` + `hexo generate` + `hexo deploy` (只压缩 部署)
- (2)`hexo clean` + `hexo generate` + `hexo server` + `hexo deploy`(压缩 预览 加部署)

出现以下内容即成功

```bash
🚀 [Image Compressor] Starting image optimization..
🎉 [Image Compressor] Finished! Processed 619 images. Saved 190.29 MB.
```

#### ③ 搜索功能

在 Hexo 根目录执行：

```bash
npm install hexo-generator-search@^2.4.3 --save
```

然后在 Hexo 根目录的 `_config.yml` 底部添加：

```yaml
# Search
search:
  path: search.json
  field: post
  content: true
  format: html
```

#### ④ Mermaid 图表

在 Hexo 根目录执行：

```bash
npm install hexo-filter-mermaid-diagrams --save
```

然后在 Hexo 根目录的 `_config.yml` 底部添加：

```yaml
# mermaid
mermaid:
  enable: true
  version: "10.6.1"
```

#### ⑤ 使用 img 标签插入图片

如果希望在文章中直接使用 HTML 的 `img` 标签插入图片，可以安装：

```bash
npm install hexo-asset-img --save
npm install hexo-image-link --save
```

当然hexo有其自带的图片插入方式,详见[hexo官方文档](https://hexo.io/zh-cn/docs/asset-folders)

## 主题中英双语

由于自身水平有限我做不到i18n,所以目前只满足中英双语

## AI评论功能

详见[文章](https://funingna-wakawaka.github.io/2026/04/26/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E7%BB%99Blog%E5%A2%9E%E5%8A%A0AI%E6%80%BB%E7%BB%93%E5%8A%9F%E8%83%BD/)方法

## 开源协议
本主题使用 **Apache License Version 2.0** 协议开源，您可以在遵守协议的前提下自由使用、修改和分发本主题



## 致谢

感谢[forever218大佬](https://github.com/forever218)

本主题是[magzine主题](https://github.com/forever218/hexo-theme-magzine)的分支版本,由于我的修改过于巨大而且为Vibe Coding+人工 review,可能存在我忽视的地方以及潜藏bug,缺乏稳定性

已经不适合合并原主题
