import * as THREE from "three";
// Each drawing uses square coordinates; panels preserve the physical aspect ratio.
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  id: number,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#314d45";
  ctx.fillStyle = "#314d45";
  ctx.beginPath();
  if (id === 0) {
    ctx.moveTo(-29, 31);
    ctx.bezierCurveTo(-42, -18, -5, -39, 32, -32);
    ctx.bezierCurveTo(39, 4, 15, 40, -29, 31);
    ctx.fill();
    ctx.strokeStyle = "#e7e5c8";
    ctx.beginPath();
    ctx.moveTo(-26, 27);
    ctx.lineTo(22, -22);
    ctx.stroke();
  }
  if (id === 1) {
    ctx.arc(0, 0, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eee8d0";
    ctx.beginPath();
    ctx.arc(16, -10, 29, 0, Math.PI * 2);
    ctx.fill();
  }
  if (id === 2) {
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38);
      ctx.stroke();
    }
  }
  if (id === 3) {
    for (let row = -1; row <= 1; row++) {
      ctx.beginPath();
      ctx.moveTo(-36, row * 20);
      ctx.bezierCurveTo(-12, row * 20 - 24, 12, row * 20 + 24, 36, row * 20);
      ctx.stroke();
    }
  }
  ctx.restore();
}
export function panelTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * 300);
  canvas.height = Math.round(height * 300);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eee8d0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#a79b72";
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  draw(ctx, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
