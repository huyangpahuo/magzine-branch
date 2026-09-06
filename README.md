# Magzine主题   

一款现代化的杂志风格 Hexo 主题，大屏支持，简洁、优雅、快速。👉[使用手册](https://2am.top/2026/01/28/magzine%E4%B8%BB%E9%A2%98%E6%8C%87%E5%8C%97/)

[English](README_en.md)


## 预览  
查看我的[博客](https://2am.top)或是预览快照：   


<img width="2544" height="1326" alt="image" src="https://github.com/user-attachments/assets/a614374a-9d15-4fc9-b570-27dd86bd731f" />  
<img width="2545" height="1307" alt="image" src="https://github.com/user-attachments/assets/73373035-e3b4-468c-aeed-ed61cd7af0b9" />
<img width="2546" height="1325" alt="image" src="https://github.com/user-attachments/assets/f44855aa-4ac4-4d9b-b988-6341547f34bc" />




## 功能特性

-   **现代化设计**：简洁、极简的美学设计，流畅的交互体验   
-   **杂志式布局**：动态文章卡片，支持多种大小和位置     
-   **响应式设计**：适配设备，大屏支持  
-   **高度可定制**：丰富的主题配置选项  
-   **性能优化**：平滑滚动、动画优化  
-   **AI摘要**：接入deepseek摘要功能  
-   **标签外挂**： 移植了[anzhiyu](https://blog.anheyu.com/posts/d50a.html)和[butterfly](https://butterfly.js.org/posts/2df239ce/)主题的大部分标签外挂   



## 安装方法

1.  将主题克隆或下载到 Hexo 项目的 `themes` 目录：

``` bash
git clone https://github.com/forever218/hexo-theme-magzine.git themes/magzine
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

### 可选增强插件

以下插件用于提供额外功能，不安装也不会影响主题的正常运行。

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

主题支持自动压缩文章及其他图片资源。

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

## 贡献指南

1.  Fork 本仓库  
2.  创建功能分支   
3.  编写代码并提交   
4.  如果需要，添加测试   
5.  提交 Pull Request



## 开源协议
本主题使用 **Apache License Version 2.0** 协议开源，您可以在遵守协议的前提下自由使用、修改和分发本主题。



## 支持与反馈

如果遇到问题或有疑问：

1.  查看 [文档](docs/)\
2.  搜索已有
    [Issues](https://github.com/forever218/hexo-theme-magzine/issues)  
3.  必要时提交新 Issue



## 致谢

-   [Hexo](https://hexo.io/)静态博客框架  
-   [Pug](https://pugjs.org/)模板引擎  
-   [Font Awesome](https://fontawesome.com/)图标



