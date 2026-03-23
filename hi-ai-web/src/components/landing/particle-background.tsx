"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  // 轨道相关属性
  orbitIndex: number; // -1 表示随机粒子，0-2 表示轨道索引
  orbitAngle: number; // 轨道上的角度
  orbitOffset: number; // 距离轨道中心的偏移
  orbitSpeed: number; // 轨道旋转速度
  // 原始位置（用于弹性回归）
  originX: number;
  originY: number;
}

// 轨道配置
interface OrbitConfig {
  radiusX: number; // 椭圆X轴半径比例
  radiusY: number; // 椭圆Y轴半径比例
  speed: number; // 旋转速度
}

const ORBIT_CONFIGS: OrbitConfig[] = [
  { radiusX: 0.15, radiusY: 0.2, speed: 0.0008 }, // 内圈快
  { radiusX: 0.28, radiusY: 0.35, speed: 0.0005 }, // 中圈
  { radiusX: 0.42, radiusY: 0.48, speed: 0.0003 }, // 外圈慢
];

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const centerRef = useRef({ x: 0, y: 0 });

  const isDarkMode = useCallback(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  }, []);

  const getParticleCount = useCallback(() => {
    if (typeof window === "undefined") return 180;
    return window.innerWidth < 768 ? 90 : 190;
  }, []);

  const initParticles = useCallback(
    (width: number, height: number) => {
      const count = getParticleCount();
      const particles: Particle[] = [];
      const centerX = width / 2;
      const centerY = height / 2;
      centerRef.current = { x: centerX, y: centerY };

      // 60% 轨道粒子，40% 随机粒子
      const orbitParticleCount = Math.floor(count * 0.6);
      const randomParticleCount = count - orbitParticleCount;

      // 创建轨道粒子
      const particlesPerOrbit = Math.floor(orbitParticleCount / ORBIT_CONFIGS.length);
      
      for (let orbitIndex = 0; orbitIndex < ORBIT_CONFIGS.length; orbitIndex++) {
        const orbit = ORBIT_CONFIGS[orbitIndex];
        const orbitRadiusX = width * orbit.radiusX;
        const orbitRadiusY = height * orbit.radiusY;

        for (let i = 0; i < particlesPerOrbit; i++) {
          const angle = (Math.PI * 2 * i) / particlesPerOrbit + Math.random() * 0.5;
          const offset = (Math.random() - 0.5) * 60; // 轨道偏移
          const baseRadius = Math.random() * 0.8 + 0.5; // 0.5-1.3px
          
          const x = centerX + Math.cos(angle) * (orbitRadiusX + offset);
          const y = centerY + Math.sin(angle) * (orbitRadiusY + offset);

          particles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            radius: baseRadius,
            baseRadius,
            orbitIndex,
            orbitAngle: angle,
            orbitOffset: offset,
            orbitSpeed: orbit.speed * (0.8 + Math.random() * 0.4), // 速度微调
            originX: x,
            originY: y,
          });
        }
      }

      // 创建随机粒子
      for (let i = 0; i < randomParticleCount; i++) {
        const baseRadius = Math.random() * 1.0 + 0.5; // 0.5-1.5px
        const x = Math.random() * width;
        const y = Math.random() * height;
        
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: baseRadius,
          baseRadius,
          orbitIndex: -1,
          orbitAngle: 0,
          orbitOffset: 0,
          orbitSpeed: 0,
          originX: x,
          originY: y,
        });
      }

      particlesRef.current = particles;
    },
    [getParticleCount]
  );

  const drawParticles = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const center = centerRef.current;
      const dark = isDarkMode();

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // 绘制径向渐变背景
      const gradient = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        Math.max(width, height) * 0.7
      );
      
      if (dark) {
        gradient.addColorStop(0, "rgba(20, 35, 90, 0.35)");
        gradient.addColorStop(0.4, "rgba(15, 25, 60, 0.2)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      } else {
        gradient.addColorStop(0, "rgba(100, 140, 220, 0.15)");
        gradient.addColorStop(0.4, "rgba(80, 120, 200, 0.08)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const mouseRadius = 130;
      const connectionDistance = 90;
      const returnStrength = 0.02; // 弹性回归强度

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 更新轨道粒子的目标位置
        if (p.orbitIndex >= 0) {
          const orbit = ORBIT_CONFIGS[p.orbitIndex];
          p.orbitAngle += p.orbitSpeed;
          
          const orbitRadiusX = width * orbit.radiusX;
          const orbitRadiusY = height * orbit.radiusY;
          
          p.originX = center.x + Math.cos(p.orbitAngle) * (orbitRadiusX + p.orbitOffset);
          p.originY = center.y + Math.sin(p.orbitAngle) * (orbitRadiusY + p.orbitOffset);
        }

        // Mouse interaction - repulsion effect with stronger force
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseRadius && dist > 0) {
          const force = ((mouseRadius - dist) / mouseRadius) * 2;
          const angle = Math.atan2(dy, dx);
          p.vx -= Math.cos(angle) * force * 0.8;
          p.vy -= Math.sin(angle) * force * 0.8;
        }

        // 弹性回归到原位置/轨道位置
        const returnDx = p.originX - p.x;
        const returnDy = p.originY - p.y;
        p.vx += returnDx * returnStrength;
        p.vy += returnDy * returnStrength;

        // Apply velocity with damping
        p.vx *= 0.95;
        p.vy *= 0.95;

        // 对于随机粒子，保持最小速度
        if (p.orbitIndex === -1) {
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed < 0.05) {
            p.vx += (Math.random() - 0.5) * 0.08;
            p.vy += (Math.random() - 0.5) * 0.08;
          }
        }

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges for random particles only
        if (p.orbitIndex === -1) {
          if (p.x < -50) { p.x = width + 50; p.originX = p.x; }
          if (p.x > width + 50) { p.x = -50; p.originX = p.x; }
          if (p.y < -50) { p.y = height + 50; p.originY = p.y; }
          if (p.y > height + 50) { p.y = -50; p.originY = p.y; }
        }

        // Particle color based on theme - higher contrast
        const particleOpacity = dark 
          ? 0.5 + Math.random() * 0.2 
          : 0.3 + Math.random() * 0.1;
        
        const particleColor = dark
          ? `rgba(160, 190, 255, ${particleOpacity})`
          : `rgba(30, 50, 160, ${particleOpacity})`;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
        ctx.fill();
      }

      // Draw connections - separate pass for better performance
      // 优先连接同轨道粒子
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          // 同轨道粒子连接距离更长
          const maxDist = (p.orbitIndex >= 0 && p.orbitIndex === p2.orbitIndex) 
            ? connectionDistance * 1.2 
            : connectionDistance;

          if (dist2 < maxDist) {
            const opacity = 1 - dist2 / maxDist;
            
            // 鼠标附近连线增强
            const mouseDistP1 = Math.sqrt(
              (mouse.x - p.x) ** 2 + (mouse.y - p.y) ** 2
            );
            const mouseDistP2 = Math.sqrt(
              (mouse.x - p2.x) ** 2 + (mouse.y - p2.y) ** 2
            );
            const mouseBoost = 
              (mouseDistP1 < mouseRadius * 1.5 || mouseDistP2 < mouseRadius * 1.5) 
                ? 1.5 
                : 1;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = dark
              ? `rgba(130, 170, 255, ${opacity * 0.4 * mouseBoost})`
              : `rgba(50, 70, 180, ${opacity * 0.3 * mouseBoost})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    },
    [isDarkMode]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };

    resizeCanvas();

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    // Mouse leave handler
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    // Animation loop
    const animate = () => {
      drawParticles(ctx, canvas.width, canvas.height);
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Event listeners
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [initParticles, drawParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
