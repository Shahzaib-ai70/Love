import { useEffect, useRef } from "react";

const themeMap = {
  green: {
    core: "118, 255, 207",
    aura: "61, 255, 177",
    fill: "98, 255, 195",
    haze: "0, 255, 170",
    hueBase: 145,
  },
  pink: {
    core: "255, 120, 192",
    aura: "255, 80, 166",
    fill: "255, 161, 214",
    haze: "255, 62, 145",
    hueBase: 330,
  },
  purple: {
    core: "191, 148, 255",
    aura: "157, 103, 255",
    fill: "220, 191, 255",
    haze: "140, 86, 255",
    hueBase: 275,
  },
};

function createHeartPoints(totalPoints, scale) {
  const points = [];

  for (let index = 0; index < totalPoints; index += 1) {
    const t = (index / totalPoints) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);

    points.push({
      x: x * scale,
      y: -y * scale,
    });
  }

  return points;
}

function HeartCanvas({ theme = "green", density = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    const activeTheme = themeMap[theme] || themeMap.green;

    if (!context) {
      return undefined;
    }

    const particles = [];
    const heartPoints = createHeartPoints(260, 8.2);
    let animationFrameId = 0;
    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let auraParticles = [];

    const resize = () => {
      const parent = canvas.parentElement;

      if (!parent) {
        return;
      }

      const rect = parent.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;

      width = Math.max(rect.width, 320);
      height = Math.max(rect.height, 320);
      centerX = width / 2;
      centerY = height / 2 + 8;

      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      auraParticles = Array.from({ length: Math.floor(180 * density) }, (_, index) => {
        const point = heartPoints[index % heartPoints.length];

        return {
          baseX: point.x,
          baseY: point.y,
          radius: Math.random() * 2.2 + 0.8,
          alpha: Math.random() * 0.45 + 0.15,
          offset: Math.random() * Math.PI * 2,
          drift: Math.random() * 8 + 6,
        };
      });
    };

    const spawnTrailParticle = (point, time) => {
      particles.push({
        x: point.x + (Math.random() - 0.5) * 12,
        y: point.y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 0.65,
        vy: (Math.random() - 0.5) * 0.65 - 0.15,
        life: 1,
        decay: Math.random() * 0.02 + 0.013,
        radius: Math.random() * 2.8 + 1.2,
        hue: activeTheme.hueBase + Math.sin(time * 0.0018) * 20,
      });
    };

    const drawBackgroundGlow = () => {
      const backgroundGradient = context.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        Math.max(width, height) * 0.45
      );

      backgroundGradient.addColorStop(0, `rgba(${activeTheme.haze}, 0.15)`);
      backgroundGradient.addColorStop(0.45, `rgba(${activeTheme.haze}, 0.05)`);
      backgroundGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      context.fillStyle = backgroundGradient;
      context.fillRect(0, 0, width, height);
    };

    const drawAura = (time) => {
      for (const particle of auraParticles) {
        const wave = Math.sin(time * 0.0014 + particle.offset);
        const px = centerX + particle.baseX + wave * particle.drift;
        const py = centerY + particle.baseY + Math.cos(time * 0.0011 + particle.offset) * particle.drift;

        context.beginPath();
        context.fillStyle = `rgba(${activeTheme.fill}, ${particle.alpha})`;
        context.shadowBlur = 18;
        context.shadowColor = `rgba(${activeTheme.aura}, 0.9)`;
        context.arc(px, py, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 0;
    };

    const drawNeonPath = (time) => {
      const reveal = (Math.sin(time * 0.0018) + 1) / 2;
      const visibleCount = Math.max(
        40,
        Math.floor(heartPoints.length * (0.35 + reveal * 0.65))
      );

      context.beginPath();

      for (let index = 0; index < visibleCount; index += 1) {
        const point = heartPoints[index];
        const drawX = centerX + point.x;
        const drawY = centerY + point.y;

        if (index === 0) {
          context.moveTo(drawX, drawY);
        } else {
          context.lineTo(drawX, drawY);
        }
      }

      context.lineWidth = 4.5;
      context.lineCap = "round";
      context.strokeStyle = `rgba(${activeTheme.core}, 0.98)`;
      context.shadowBlur = 24;
      context.shadowColor = `rgba(${activeTheme.aura}, 0.95)`;
      context.stroke();

      context.lineWidth = 10;
      context.strokeStyle = `rgba(${activeTheme.haze}, 0.15)`;
      context.shadowBlur = 36;
      context.stroke();

      context.shadowBlur = 0;

      const headPoint = heartPoints[Math.max(0, visibleCount - 1)];
      spawnTrailParticle(
        {
          x: centerX + headPoint.x,
          y: centerY + headPoint.y,
        },
        time
      );
    };

    const drawTrailParticles = () => {
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;

        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }

        context.beginPath();
        context.fillStyle = `hsla(${particle.hue}, 100%, 68%, ${particle.life})`;
        context.shadowBlur = 16;
        context.shadowColor = `rgba(${activeTheme.aura}, 0.85)`;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 0;
    };

    const render = (time) => {
      context.clearRect(0, 0, width, height);

      drawBackgroundGlow();
      drawAura(time);
      drawNeonPath(time);
      drawTrailParticles();

      animationFrameId = window.requestAnimationFrame(render);
    };

    resize();
    render(0);

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas.parentElement);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [density, theme]);

  return <canvas className="heart-canvas" ref={canvasRef} aria-hidden="true" />;
}

export default HeartCanvas;
