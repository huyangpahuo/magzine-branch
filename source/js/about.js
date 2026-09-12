/**
 * 关于页面脚本 (js/about.js)
 *
 * 从 about.pug 抽离:背景几何图形漫游 + 卡片 3D 悬停。
 * layout.pug 全局加载(pjax 只换 main.main 不换 <head>,
 * 页面级脚本必须常驻);内部已做幂等守卫,重复执行无副作用。
 */

document.addEventListener('DOMContentLoaded', function () {
  // === 背景几何图形漫游 ===
  const shapeContainer = document.getElementById('background-shapes');
  if (shapeContainer) {
    // pjax: 同一容器只初始化一次,防止重复执行堆出一堆静止图形
    if (shapeContainer.dataset.shapesInit) return;
    shapeContainer.dataset.shapesInit = '1';

    // pjax: 再次进入本页时先停掉上一轮漫游动画,避免 rAF 循环越积越多
    if (window.__aboutShapesStop) {
      window.__aboutShapesStop();
      window.__aboutShapesStop = null;
    }
    if (!window.__aboutShapesStopHooked) {
      window.__aboutShapesStopHooked = true;
      document.addEventListener('pjax:send', function () {
        if (window.__aboutShapesStop) {
          window.__aboutShapesStop();
          window.__aboutShapesStop = null;
        }
      });
    }

    const shapeCount = 15;
    const shapes = [];

    for (let i = 0; i < shapeCount; i++) {
      const shape = document.createElement('div');
      shape.classList.add('shape');
      const type = Math.random();
      if (type < 0.33) shape.classList.add('shape-circle');
      else if (type < 0.66) shape.classList.add('shape-square');
      else shape.classList.add('shape-triangle');

      const size = Math.random() * 70 + 30;
      shape.style.width = `${size}px`;
      shape.style.height = `${size}px`;
      shape.style.opacity = Math.random() * 0.25 + 0.05;

      let x = Math.random() * window.innerWidth;
      let y = Math.random() * window.innerHeight;
      let vx = (Math.random() - 0.5) * 1.5;
      let vy = (Math.random() - 0.5) * 1.5;
      let r = Math.random() * 360;
      let vr = (Math.random() - 0.5) * 0.5;

      shapeContainer.appendChild(shape);
      shapes.push({ el: shape, x, y, vx, vy, r, vr });
    }

    let rafId = 0;
    function animateShapes() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      shapes.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.r += s.vr;
        if (s.x <= -50 || s.x >= w + 50) s.vx *= -1;
        if (s.y <= -50 || s.y >= h + 50) s.vy *= -1;
        s.el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.r}deg)`;
      });
      rafId = requestAnimationFrame(animateShapes);
    }
    animateShapes();

    window.__aboutShapesStop = function () {
      cancelAnimationFrame(rafId);
    };
  }

  // === 卡片 3D ===
  const cards = document.querySelectorAll('.interest-card');
  cards.forEach((card) => {
    card.addEventListener('mousemove', function (e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      let rotateY = x / 40;
      let rotateX = -y / 40;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02) translateY(-10px)`;
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform =
        'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1) translateY(0)';
    });
  });
});
