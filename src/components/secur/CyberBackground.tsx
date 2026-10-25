import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

export function CyberBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Generate network nodes
    const nodeCount = Math.min(65, Math.floor((width * height) / 22000));
    const nodes: Node[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        radius: Math.random() * 1.8 + 1,
        alpha: Math.random() * 0.5 + 0.3,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Radar scanner line angle
    let radarAngle = 0;

    let mouseX = -1000;
    let mouseY = -1000;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle tactical grid lines
      const gridSize = 56;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.035)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Radar sweep from center
      const centerX = width * 0.5;
      const centerY = height * 0.38;
      const radarRadius = Math.min(width, height) * 0.75;
      radarAngle += 0.007;

      const grad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radarRadius);
      grad.addColorStop(0, "rgba(6, 182, 212, 0.07)");
      grad.addColorStop(0.5, "rgba(2, 132, 199, 0.025)");
      grad.addColorStop(1, "transparent");

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radarRadius, radarAngle, radarAngle + 0.45);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Radar outer concentric target rings
      ctx.strokeStyle = "rgba(6, 182, 212, 0.06)";
      ctx.lineWidth = 1;
      [0.2, 0.4, 0.65, 0.95].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radarRadius * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();

      // 3. Update & render connected cybersecurity nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        n.x += n.vx;
        n.y += n.vy;
        n.pulsePhase += n.pulseSpeed;

        if (n.x < 0) n.x = width;
        if (n.x > width) n.x = 0;
        if (n.y < 0) n.y = height;
        if (n.y > height) n.y = 0;

        // Mouse proximity interaction
        const mdx = n.x - mouseX;
        const mdy = n.y - mouseY;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < 140) {
          const force = (140 - mDist) / 140;
          n.x += (mdx / (mDist || 1)) * force * 1.5;
          n.y += (mdy / (mDist || 1)) * force * 1.5;
        }

        // Draw connections
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j]!;
          const dx = n.x - n2.x;
          const dy = n.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 135) {
            const alpha = (1 - dist / 135) * 0.22;
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }

        // Draw node dot with pulsation
        const pulse = Math.sin(n.pulsePhase) * 0.3 + 0.7;
        const curAlpha = n.alpha * pulse;
        ctx.fillStyle = `rgba(103, 232, 249, ${curAlpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * (0.85 + pulse * 0.3), 0, Math.PI * 2);
        ctx.fill();

        // Glowing halo for larger nodes
        if (n.radius > 2.0) {
          ctx.fillStyle = `rgba(6, 182, 212, ${curAlpha * 0.35})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* Dynamic Animated Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-85" />

      {/* Cyber Ambient Deep Space Glows */}
      <div className="absolute -top-36 left-1/2 h-[550px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.14_210/0.18),transparent_65%)] blur-3xl" />
      <div className="absolute top-1/3 -left-40 h-[480px] w-[620px] rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.48_0.18_195/0.12),transparent_70%)] blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-[450px] w-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.42_0.12_230/0.14),transparent_70%)] blur-3xl" />

      {/* Tactical Sci-Fi HUD Crosshair & Bracket Accents */}
      <div className="absolute top-6 left-6 font-mono text-[0.62rem] tracking-widest text-primary/30 uppercase">
        SYS_GRID // 0x7F2A.LIVE
      </div>
      <div className="absolute top-6 right-6 font-mono text-[0.62rem] tracking-widest text-primary/30 uppercase">
        FEED // ENCRYPTED_TLS_v1.3
      </div>
      <div className="absolute bottom-6 left-6 font-mono text-[0.62rem] tracking-widest text-muted-foreground/30 uppercase">
        NODE: AS701_INTEL_DEFENSE
      </div>
      <div className="absolute bottom-6 right-6 font-mono text-[0.62rem] tracking-widest text-muted-foreground/30 uppercase">
        STATUS: ACTIVE_SURVEILLANCE
      </div>

      {/* Sci-Fi Corner Brackets */}
      <div className="absolute top-4 left-4 h-6 w-6 border-t-2 border-l-2 border-primary/25" />
      <div className="absolute top-4 right-4 h-6 w-6 border-t-2 border-r-2 border-primary/25" />
      <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-primary/25" />
      <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-primary/25" />

      {/* Scanline overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,0.22)_50%)] bg-[length:100%_4px] opacity-40 pointer-events-none" />
    </div>
  );
}
