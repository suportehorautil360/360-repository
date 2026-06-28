import { useEffect, useRef } from "react";

type Node = {
  angle: number;
  dist: number;
  progress: number;
  /** Fração da linha percorrida por segundo (0–1). */
  speed: number;
  radius: number;
  pulse: number;
  pulseSpeed: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function PrefeituraLoginNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let slowMotion = motionQuery.matches;

    function onMotionChange(event: MediaQueryListEvent) {
      slowMotion = event.matches;
    }
    motionQuery.addEventListener("change", onMotionChange);

    let animId = 0;
    let running = true;
    let width = 0;
    let height = 0;
    let center = { x: 0, y: 0 };
    let nodes: Node[] = [];
    let lastFrame = performance.now();
    let layoutW = 0;
    let layoutH = 0;

    function outerPos(node: Node) {
      return {
        x: center.x + Math.cos(node.angle) * width * node.dist,
        y: center.y + Math.sin(node.angle) * height * node.dist,
      };
    }

    function nodePos(node: Node) {
      const outer = outerPos(node);
      return {
        x: lerp(outer.x, center.x, node.progress),
        y: lerp(outer.y, center.y, node.progress),
      };
    }

    function createNodes() {
      const count = Math.max(
        8,
        Math.min(14, Math.floor((width * height) / 45000)),
      );

      nodes = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
        return {
          angle,
          dist: 0.28 + Math.random() * 0.22,
          progress: Math.random() * 0.9,
          speed: 0.07 + Math.random() * 0.05,
          radius: 2 + Math.random() * 2.5,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 1.2 + Math.random() * 0.8,
        };
      });
    }

    function applySize(w: number, h: number, resetNodes: boolean) {
      if (w < 2 || h < 2) return;

      const sizeChanged =
        Math.abs(w - layoutW) > 1 || Math.abs(h - layoutH) > 1;
      if (!sizeChanged && !resetNodes) return;

      layoutW = w;
      layoutH = h;
      width = w;
      height = h;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      center = { x: width / 2, y: height / 2 };

      if (resetNodes || nodes.length === 0) {
        createNodes();
      }
    }

    function measure(resetNodes = false) {
      const parent = canvas.parentElement;
      if (!parent) return;
      applySize(parent.clientWidth, parent.clientHeight, resetNodes);
    }

    function drawHub(now: number) {
      const t = now / 600;
      const hubCore = 6 + Math.sin(t) * 1.5;
      const hubGlow = hubCore * 3.2;

      const glow = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        hubGlow,
      );
      glow.addColorStop(0, "rgba(249, 115, 22, 0.55)");
      glow.addColorStop(0.45, "rgba(249, 115, 22, 0.15)");
      glow.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.beginPath();
      ctx.arc(center.x, center.y, hubGlow, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(center.x, center.y, hubCore, 0, Math.PI * 2);
      ctx.fillStyle = "#f97316";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(center.x, center.y, hubCore * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = "#fff7ed";
      ctx.fill();
    }

    function frame(now: number) {
      if (!running) return;

      const dt = Math.min(48, now - lastFrame) / 1000;
      lastFrame = now;

      if (width < 2 || height < 2) {
        measure(false);
        animId = requestAnimationFrame(frame);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const motionScale = slowMotion ? 0.35 : 1;

      nodes.forEach((node) => {
        const outer = outerPos(node);
        const grad = ctx.createLinearGradient(
          outer.x,
          outer.y,
          center.x,
          center.y,
        );
        grad.addColorStop(0, "rgba(59, 130, 246, 0.22)");
        grad.addColorStop(0.65, "rgba(99, 102, 241, 0.18)");
        grad.addColorStop(1, "rgba(249, 115, 22, 0.42)");
        ctx.beginPath();
        ctx.moveTo(outer.x, outer.y);
        ctx.lineTo(center.x, center.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();

        node.progress += node.speed * dt * motionScale;
        node.pulse += node.pulseSpeed * dt;
        if (node.progress >= 1) node.progress = 0;
      });

      nodes.forEach((node) => {
        const pos = nodePos(node);
        const glow = 0.45 + Math.sin(node.pulse) * 0.35;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${glow})`;
        ctx.fill();
      });

      drawHub(now);
      animId = requestAnimationFrame(frame);
    }

    const onWindowResize = () => measure(false);

    const observer = new ResizeObserver(() => {
      measure(false);
    });
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    measure(true);
    window.addEventListener("resize", onWindowResize);
    animId = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener("resize", onWindowResize);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pf-login-network"
      aria-hidden="true"
    />
  );
}
