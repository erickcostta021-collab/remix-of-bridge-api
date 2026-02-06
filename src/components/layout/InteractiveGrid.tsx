import { useCallback, useRef, useEffect } from "react";

export function InteractiveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1, y: -1 });
  const animFrameRef = useRef<number>(0);

  const CELL_SIZE = 60;
  const LINE_COLOR = { r: 56, g: 161, b: 105 }; // brand-green
  const BASE_OPACITY = 0.12;
  const HOVER_OPACITY = 0.55;
  const SNAP_DISTANCE = 12; // px threshold to "snap" highlight to nearest line

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const { x: mx, y: my } = mouseRef.current;

    ctx.clearRect(0, 0, width, height);

    // Find nearest vertical and horizontal grid lines
    const nearestVx = mx >= 0 ? Math.round(mx / CELL_SIZE) * CELL_SIZE : -1;
    const nearestHy = my >= 0 ? Math.round(my / CELL_SIZE) * CELL_SIZE : -1;
    const distToV = mx >= 0 ? Math.abs(mx - nearestVx) : Infinity;
    const distToH = my >= 0 ? Math.abs(my - nearestHy) : Infinity;

    // Draw vertical lines
    for (let x = 0; x <= width; x += CELL_SIZE) {
      const isHovered = distToV <= SNAP_DISTANCE && x === nearestVx;
      const opacity = isHovered ? HOVER_OPACITY : BASE_OPACITY;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.strokeStyle = `rgba(${LINE_COLOR.r}, ${LINE_COLOR.g}, ${LINE_COLOR.b}, ${opacity})`;
      ctx.lineWidth = isHovered ? 1.5 : 1;
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= height; y += CELL_SIZE) {
      const isHovered = distToH <= SNAP_DISTANCE && y === nearestHy;
      const opacity = isHovered ? HOVER_OPACITY : BASE_OPACITY;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.strokeStyle = `rgba(${LINE_COLOR.r}, ${LINE_COLOR.g}, ${LINE_COLOR.b}, ${opacity})`;
      ctx.lineWidth = isHovered ? 1.5 : 1;
      ctx.stroke();
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1, y: -1 };
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw, handleMouseMove, handleMouseLeave]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
