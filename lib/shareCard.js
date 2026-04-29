// Generates a 1080×1920 portrait PNG of a week's recap, suitable for dropping
// into the league group text. Pure canvas — no external libs, no images, just
// shapes + system text. The visual style mirrors the in-app dark hero card.
//
// Inputs:
//   meta = { wk, raceName, track }
//   players = [{ name, color, pts, drivers: [{ num, name, primary, secondary }], wins }]
//             (already sorted, leader first)

const W = 1080;
const H = 1920;
const PAD = 64;

// Colors mirror lib/constants T tokens
const C_INK = '#14110D';
const C_BG  = '#F7F4ED';
const C_HOT = '#B8935A';
const C_INK2 = 'rgba(247,244,237,0.85)';
const C_DIM = 'rgba(247,244,237,0.5)';

// Fonts: use system stack — Helvetica/Arial show up reliably across devices.
const F_DISPLAY = `700 96px "Helvetica Neue", Arial, sans-serif`;
const F_DISPLAY_LG = `700 140px "Helvetica Neue", Arial, sans-serif`;
const F_DISPLAY_SM = `600 56px "Helvetica Neue", Arial, sans-serif`;
const F_BODY    = `500 32px "Helvetica Neue", Arial, sans-serif`;
const F_LABEL   = `600 24px "Helvetica Neue", Arial, sans-serif`;
const F_NUM     = `700 80px "Helvetica Neue", Arial, sans-serif`;

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawText(ctx, text, x, y, font, color, options = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = options.baseline || 'alphabetic';
  ctx.textAlign = options.align || 'left';
  ctx.fillText(text, x, y);
}

// Carved car-number plate matching the in-app CarNum primitive: rounded
// square colored by primary livery, secondary stripe at bottom, big number.
function drawCarNum(ctx, x, y, size, num, primary, secondary) {
  const r = size * 0.18;
  // Outer plate
  ctx.fillStyle = primary;
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();
  // Secondary stripe along the bottom 28%
  ctx.fillStyle = secondary;
  roundRect(ctx, x, y + size * 0.72, size, size * 0.28, [0, 0, r, r]);
  ctx.fill();
  // Number
  const numStr = String(num);
  const fontSize = size * (numStr.length >= 3 ? 0.42 : numStr.length === 2 ? 0.55 : 0.65);
  ctx.font = `800 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(numStr, x + size / 2, y + size / 2);
  ctx.fillText(numStr, x + size / 2, y + size / 2);
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

// Player badge: simple colored disc with initial (used in roster row).
function drawBadge(ctx, x, y, size, color, initial) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 ${size * 0.5}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, x + size / 2, y + size / 2);
}

// Render the full card to an off-screen canvas; return the canvas itself so
// the caller can either display a preview or convert to a Blob for download.
export function renderShareCard({ meta, players }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Paper background
  drawRect(ctx, 0, 0, W, H, C_BG);

  // Top dark hero block — race title
  const heroH = 540;
  drawRect(ctx, 0, 0, W, heroH, C_INK);

  // Copper accent stripe at top
  drawRect(ctx, 0, 0, W, 8, C_HOT);

  // Header text (week, race name, track)
  drawText(ctx, `WEEK ${String(meta.wk).padStart(2, '0')} · FINAL`,
    PAD, 100, F_LABEL, C_HOT, { baseline: 'top' });

  // Race name — wrap if needed (shrink a half-step if very long)
  const raceName = meta.raceName || meta.track;
  ctx.font = raceName.length > 22 ? F_DISPLAY : F_DISPLAY_LG;
  ctx.textBaseline = 'top';
  ctx.fillStyle = C_BG;
  ctx.fillText(raceName, PAD, 150);

  if (meta.raceName) {
    drawText(ctx, meta.track, PAD, 320, F_BODY, C_DIM, { baseline: 'top' });
  }

  // Leader callout in hero
  const leader = players[0];
  if (leader) {
    drawText(ctx, 'WINNER', PAD, 390, F_LABEL, C_HOT, { baseline: 'top' });
    ctx.font = F_DISPLAY_SM;
    ctx.fillStyle = C_BG;
    ctx.fillText(`${leader.name} · ${leader.pts} pts`, PAD, 430);
  }

  // Standings list (full)
  const listTop = heroH + 80;
  const rowH = 130;
  drawText(ctx, 'WEEK STANDINGS', PAD, listTop, F_LABEL, '#7A7268', { baseline: 'top' });
  let y = listTop + 60;
  players.forEach((p, i) => {
    const rowY = y + i * rowH;
    // Position number
    ctx.font = F_NUM;
    ctx.fillStyle = i === 0 ? C_HOT : C_INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1).padStart(2, '0'), PAD, rowY + rowH / 2);

    // Badge
    drawBadge(ctx, PAD + 130, rowY + 25, 80, p.color || C_INK, (p.name?.[0] || '?').toUpperCase());

    // Name
    ctx.font = `700 56px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = C_INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name, PAD + 240, rowY + rowH / 2);

    // Points (right-aligned)
    ctx.font = `700 64px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = i === 0 ? C_HOT : C_INK;
    ctx.textAlign = 'right';
    ctx.fillText(String(p.pts), W - PAD, rowY + rowH / 2);

    // Hairline
    if (i < players.length - 1) {
      ctx.strokeStyle = 'rgba(20,17,13,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, rowY + rowH);
      ctx.lineTo(W - PAD, rowY + rowH);
      ctx.stroke();
    }
  });

  // Winner's roster strip at the bottom
  const rosterTop = listTop + 60 + players.length * rowH + 80;
  if (leader && leader.drivers && leader.drivers.length > 0) {
    drawText(ctx, `${leader.name.toUpperCase()}'S WINNING ROSTER`,
      PAD, rosterTop, F_LABEL, C_HOT, { baseline: 'top' });

    const tileSize = 140;
    const gap = 28;
    const totalWidth = leader.drivers.length * tileSize + (leader.drivers.length - 1) * gap;
    const startX = (W - totalWidth) / 2;
    leader.drivers.forEach((d, i) => {
      drawCarNum(ctx, startX + i * (tileSize + gap), rosterTop + 60, tileSize,
        d.num, d.primary || '#888', d.secondary || '#444');
    });
  }

  // Footer
  drawText(ctx, 'HARVEST MOON · WEEKLY RE-DRAFT FANTASY LEAGUE',
    W / 2, H - 64, F_LABEL, '#7A7268', { align: 'center' });

  return canvas;
}

// Convenience: render then trigger a download.
export function downloadShareCard(payload) {
  const canvas = renderShareCard(payload);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvest-moon-wk${String(payload.meta.wk).padStart(2, '0')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, 'image/png');
}
