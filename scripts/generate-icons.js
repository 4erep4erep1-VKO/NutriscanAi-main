import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

const outDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });

function generate(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#07090e';
  ctx.fillRect(0, 0, size, size);

  const fontSize = Math.floor(size * 0.6);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.fillText('🥗', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath}`);
}

generate(192, 'icon-192.png');
generate(512, 'icon-512.png');
