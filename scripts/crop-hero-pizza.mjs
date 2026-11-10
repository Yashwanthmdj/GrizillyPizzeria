import sharp from "sharp";
import { resolve } from "node:path";

/**
 * Manual crop tuned to menu-margherita.webp (1024×768):
 * round board sits left-of-center; handle extends right.
 * Inset past the wooden rim so only the pizza disc remains.
 */
const src = resolve("src/assets/menu-margherita.webp");
const out = resolve("src/assets/hero-margherita-circle.webp");

const cx = 450;
const cy = 378;
const radius = 272;

const left = cx - radius;
const top = cy - radius;
const size = radius * 2;

const sizeFinal = 1000;
const square = await sharp(src)
  .extract({ left, top, width: size, height: size })
  .resize(sizeFinal, sizeFinal, { fit: "fill" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const r = sizeFinal / 2 - 0.5;
const outBuf = Buffer.from(square.data);
for (let y = 0; y < sizeFinal; y++) {
  for (let x = 0; x < sizeFinal; x++) {
    const dx = x + 0.5 - sizeFinal / 2;
    const dy = y + 0.5 - sizeFinal / 2;
    const i = (y * sizeFinal + x) * 4;
    const d = Math.hypot(dx, dy);
    if (d >= r) outBuf[i + 3] = 0;
    else if (d > r - 2) outBuf[i + 3] = Math.round(outBuf[i + 3] * ((r - d) / 2));
  }
}

await sharp(outBuf, { raw: { width: sizeFinal, height: sizeFinal, channels: 4 } })
  .webp({ quality: 94, alphaQuality: 100 })
  .toFile(out);

console.log("wrote", out, { left, top, size });
