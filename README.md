# Magzine 主题

一款现代化的杂志风格 Hexo 主题:大屏支持、简洁优雅,内置桌宠、Sakana 小人、
评论、AI 摘要、音乐播放器等大量可开关组件,并做了深度的性能优化
(构建期图片压缩/WebP、按视口渲染、rAF 合帧交互)。

[English](README_en.md) | [主题文档 docs/](docs/README.md)

## 预览

查看我的[博客](https://funingna-wakawaka.github.io/)

👉 [标签语法使用文档](https://funingna-wakawaka.github.io/2026/03/22/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E4%B8%BB%E9%A2%98%E7%9A%84%E4%B8%80%E4%BA%9B%E6%A0%87%E7%AD%BE%E8%AF%AD%E6%B3%95/)

## 主要特性

- **性能**:构建期路由流图片压缩/WebP 转换(引用自动改写,一次构建即生效)、
  全站脚本 defer、评论/图表/公式按视口懒加载、离屏内容跳过渲染
- **代码块 v2**:深浅自适应卡片、行号、复制、折叠、滚轮横滑
- **查看器三件套**:图片/表格/Mermaid 全屏查看,1:1 拖拽跟手+惯性+橡皮筋
- **桌宠**:状态机 AI、发丝物理、文字避让(视口懒包裹,长文不卡)
- **组件**:Sakana 小人、动态光标、落叶/点击特效、调色盘、本地搜索、
  RSS、pjax 无感刷新、中英双语、读者设置面板(右键)

## 安装

1. 将主题克隆或下载到 Hexo 项目的 `themes` 目录:

```bash
git clone https://github.com/huyangpahuo/magzine-branch.git themes/magzine
```

2. 修改 Hexo 站点的 `_config.yml`:

```yaml
theme: magzine
```

3. 安装依赖(`npm install`),确保 `package.json` 包含:

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

### 增强插件

| 插件 | 功能 |
| --- | --- |
| `hexo-wordcount` | 文章字数统计 / 阅读时长 |
| `hexo-generator-search` | 站内搜索 |
| `hexo-filter-mermaid-diagrams` | Mermaid 图表 |
| `sharp` | 构建期图片压缩/WebP(配合主题 `compress_images` 配置) |
| `hexo-generator-feed` | RSS 订阅 |
| `hexo-asset-img` `hexo-image-link` | 使用 img 标签插入图片 |

#### ① 图片自动压缩 / WebP

主题在构建期自动完成压缩与 WebP 转换,引用自动改写:

```bash
hexo clean && hexo generate   # 一次即可;hexo server 预览同为压缩后效果
```

出现以下内容即成功:

```bash
🖼 [Image Compressor] webp 模式:807 张图片输出时转为 webp,文本引用自动改写
```

详见 [docs/图片压缩与工作流指南](docs/图片压缩与工作流指南.md)。

#### ② 搜索功能

Hexo 根目录 `_config.yml` 底部添加:

```yaml
search:
  path: search.json
  field: post
  content: true
  format: html
```

#### ③ Mermaid 图表

```yaml
mermaid:
  enable: true
  version: "10.6.1"
```

#### ④ 使用 img 标签插入图片

```yaml
post_asset_folder: true
marked:
  prependRoot: true
  postAsset: true
relative_link: false
```

也可用 hexo 自带方式,见[官方文档](https://hexo.io/zh-cn/docs/asset-folders)。

#### ⑤ RSS 订阅

```yaml
feed:
  type: atom
  path: atom.xml
  limit: 20
  order_by: -date
```

⚠️ 请把根目录 `_config.yml` 的 `url` 改为真实站点地址,否则订阅源里的链接是错的。

## 更多文档

完整技术文档位于 [docs/](docs/README.md):架构总览(含图)、逐模块清单、
构建与部署、配置速查、性能设计与踩坑记录。

## 主题中英双语

由于自身水平有限做不到完整 i18n,目前满足中英双语切换。

## AI 评论功能

详见[文章](https://funingna-wakawaka.github.io/2026/04/26/%E8%BD%AF%E4%BB%B6%E7%9B%B8%E5%85%B3/%E7%BB%99Blog%E5%A2%9E%E5%8A%A0AI%E6%80%BB%E7%BB%93%E5%8A%9F%E8%83%BD/)方法

## 开源协议

本主题使用 **Apache License Version 2.0** 协议开源,您可以在遵守协议的前提下
自由使用、修改和分发本主题。第三方资源的版权归属见下方致谢,使用时请遵守
各自的许可。

## 致谢

本主题是 [forever218](https://github.com/forever218) 的
[magzine 主题](https://github.com/forever218/hexo-theme-magzine)的分支版本,
感谢原作者!由于我的修改过于巨大而且为 Vibe Coding + 人工 review,可能存在
忽视的地方与潜藏 bug;有问题欢迎 issue,或修好后 PR。

### 框架与引擎

| 项目 | 用途 |
| --- | --- |
| [Hexo](https://hexo.io/) | 静态博客框架 |
| [Pug](https://pugjs.org/) | 模板引擎 |
| [Stylus](https://stylus-lang.com/) / [marked](https://marked.js.org/) | 样式与 Markdown 渲染(hexo-renderer-*) |
| [highlight.js](https://highlight.js//)(经 hexo-util 内置) | 服务端代码高亮 |
| [sharp](https://sharp.pixelplumbing.com/) | 构建期图片压缩/WebP |

### 界面资源与小组件

| 项目 | 用途 |
| --- | --- |
| [Font Awesome 6.4.0](https://fontawesome.com/) | 全站图标(已本地化至 `lib/font-awesome/`) |
| 阿尼亚鼠标指针 | 动态光标素材,见下方"素材作者" |
| [Sakana 小人](https://github.com/itorr/sakana) by itorr | 悬挂小人组件(引擎本地化,立绘本地化,摆动参数已调温和) |
| [threejs-components liquid1](https://github.com/Dirack/Threejs-components)(via jsdelivr) | 启动封面 WebGL 液体背景(已本地化) |
| Inter / Playfair Display / Fira Code | 字体族名称沿用其字体栈设计,实际渲染回退系统字体(Google Fonts 依赖已移除) |

### 功能组件与外置服务

| 项目 | 用途 |
| --- | --- |
| [twikoo](https://twikoo.js.org/)(本地化) | 评论区(默认);亦支持 [Disqus](https://disqus.com/)、[Gitalk](https://github.com/gitalk/gitalk)、[Valine](https://valine.js.org/) |
| [MathJax 3](https://www.mathjax.org/)(jsDelivr CDN,按需) | 数学公式 |
| [Mermaid 10](https://mermaid.js.org/)(cdnjs,按视口) | 图表 |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs)(cdnjs,点击时加载) | 微信分享二维码 |
| [Post-Summary-AI](https://github.com/qxchuckle/Post-Summary-AI) by qxchuckle | AI 摘要样式与方案(天厉云 CDN) |
| Bilibili / AcFun / 虎牙等嵌入播放器 | 视频标签(境外平台需读者自备网络) |

### 素材作者

**阿尼亚鼠标指针**(转换自 Windows 光标包,逐帧动画):

- 素材作者(cursor owner):[Instagram @BySuspect](https://www.instagram.com/reel/CfNbAZelpGz/?igshid=YmMyMTA2M2Y=)
- 支持作者(Support me):[Buy Me a Coffee](https://www.buymeacoffee.com/BySuspect)
- 教程视频(Tutorial Video):[YouTube](https://www.youtube.com/watch?v=Dyd3Ep7NzrM&t=4s)

若你有资源愿意被收录/更换署名方式,欢迎 issue 告知。

