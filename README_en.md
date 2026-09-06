# Magzine Theme for Hexo

A modern magazine-style Hexo theme featuring a fullscreen hero section with typing effect and dynamic article layouts.

![Preview](https://via.placeholder.com/1200x600/1a1a1a/ffffff?text=Magzine+Theme+Preview)

## Features

- **Fullscreen Hero Section**: Eye-catching landing page with typing animation
- **Magazine-style Layout**: Dynamic article cards with varying sizes and positions
- **Modern Design**: Clean, minimalist aesthetic with smooth animations
- **Responsive**: Fully responsive design that works on all devices
- **Customizable**: Extensive theme configuration options
- **Performance Optimized**: Lazy loading, smooth scrolling, and optimized animations

## Installation

1. Clone or download this theme to your Hexo site's `themes` directory:

```bash
git clone https://github.com/forever218/hexo-theme-magzine.git themes/magzine
```

2. Modify your site's `_config.yml` to use the Magzine theme:

```yaml
theme: magzine
```

3. Install the required dependencies:

```bash
npm install
```

> Make sure your Hexo site's root `package.json` contains the required dependencies — see the list in the Chinese [README](README.md).

### Optional enhancement plugins

The following plugins unlock extra features and are already declared in the theme's `package.json`, so there is no need to install them manually as described in `需要额外下载的插件(hexo plugn required).txt`. If you installed the theme with `git clone`, add them to your Hexo site's root `package.json`:

| Plugin | Feature |
| --- | --- |
| hexo-wordcount | Post word count / reading time |
| hexo-generator-search | Built-in search |
| hexo-filter-mermaid-diagrams | Mermaid diagrams |
| sharp | Automatic image compression (with the theme's `compress_images` option) |

`hexo-generator-search` and `hexo-filter-mermaid-diagrams` also require a small config block at the bottom of your root `_config.yml` — the snippets are in `需要额外下载的插件(hexo plugn required).txt`.

Two more plugins, `hexo-asset-img` and `hexo-image-link` (insert images via `img` tags), are intentionally **not** declared in `package.json`: installing them disables the native Markdown image syntax, so install them manually only if you really need them.

## Configuration

### Theme Configuration

Edit `themes/magzine/_config.yml` to customize the theme:

```yaml
# Hero Section
hero:
  enable: true
  background_image: /images/hero-bg.jpg
  typing_text: Welcome to my blog
  typing_speed: 100
  delete_speed: 50
  pause_duration: 2000
  scroll_hint: Scroll down to explore

# Article List
article_list:
  layout: magazine  # magazine or grid
  items_per_page: 12
  show_excerpt: true
  excerpt_length: 120

# Colors
colors:
  primary: '#1a1a1a'
  secondary: '#666666'
  accent: '#ff6b6b'
  background: '#ffffff'
  text: '#333333'
  overlay: 'rgba(0, 0, 0, 0.7)'
```

### Site Configuration

Configure your Hexo site's `_config.yml`:

```yaml
# Site
title: Your Blog Title
subtitle: Your Blog Subtitle
description: Your blog description
keywords: blog, technology, life
author: Your Name
language: en
timezone: UTC

# URL
url: https://yourdomain.com
root: /
permalink: :year/:month/:day/:title/

# Extensions
theme: magzine
```

## Usage

### Hero Background

Add a fullscreen background image to your hero section:

1. Create an `images` folder in your site's `source` directory
2. Add your hero background image (e.g., `hero-bg.jpg`)
3. Configure the path in `themes/magzine/_config.yml`:

```yaml
hero:
  background_image: /images/hero-bg.jpg
```

### Article Covers

Add cover images to your articles by including the `cover` variable in your front matter:

```markdown
---
title: My Awesome Article
date: 2024-01-01
cover: /images/article-cover.jpg
categories: [Technology]
tags: [web, development]
---

Your article content here...
```

### Customizing Layout

The theme supports different article card layouts:

- **Large**: Spans 2x2 grid cells
- **Wide**: Spans 2x1 grid cells  
- **Tall**: Spans 1x2 grid cells
- **Medium**: Standard 1x1 grid cell
- **Small**: Compact 1x1 grid cell

Cards are automatically assigned different sizes to create a magazine-style layout.

## Customization

### Colors

Customize the color scheme by modifying the color variables in `_config.yml`:

```yaml
colors:
  primary: '#1a1a1a'      # Main text color
  secondary: '#666666'    # Secondary text color
  accent: '#ff6b6b'       # Accent color for highlights
  background: '#ffffff'   # Background color
  text: '#333333'         # Body text color
  overlay: 'rgba(0, 0, 0, 0.7)'  # Hero overlay color
```

### Typography

The theme uses Google Fonts by default. You can customize the fonts in `_config.yml`:

```yaml
fonts:
  primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  secondary: 'Playfair Display, Georgia, serif'
  monospace: 'Fira Code, Monaco, Consolas, monospace'
```

### Social Links

Add your social media links in `_config.yml`:

```yaml
social:
  github: https://github.com/yourusername
  twitter: https://twitter.com/yourusername
  instagram: https://instagram.com/yourusername
  linkedin: https://linkedin.com/in/yourusername
  email: your.email@example.com
```

## Development

### Building the Theme

```bash
# Build your Hexo site
hexo generate

# Start the development server
hexo server

# Clean the generated files
hexo clean
```

### Custom CSS

To add custom CSS, create a `custom.css` file in your site's `source/css` directory:

```css
/* source/css/custom.css */
.custom-style {
  /* Your custom styles here */
}
```

### Custom JavaScript

To add custom JavaScript, create a `custom.js` file in your site's `source/js` directory:

```javascript
// source/js/custom.js
console.log('Custom JavaScript loaded');
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile, etc.)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This theme is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please:

1. Check the [documentation](docs/)
2. Search existing [issues](https://github.com/forever218/hexo-theme-magzine/issues)
3. Create a new issue if needed

## Credits

- [Hexo](https://hexo.io/) - The static site generator
- [Pug](https://pugjs.org/) - Template engine
- [Google Fonts](https://fonts.google.com/) - Typography
- [Font Awesome](https://fontawesome.com/) - Icons (optional)

## Changelog

### v1.0.0
- Initial release
- Fullscreen hero section with typing effect
- Magazine-style article layout
- Responsive design
- Customizable configuration options
- Social media integration
- SEO optimized