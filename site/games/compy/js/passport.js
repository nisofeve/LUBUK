// ==================== PASSPORT / AVATAR SYSTEM ====================

export const AVATAR_DEFS = [
  { name: 'Sunny',   bg: '#fbbf24', skin: '#fde68a', hair: 'spiky',    hairCol: '#f59e0b', eyes: 'round',      eyeCol: '#78350f', mouth: 'bigsmile',  acc: 'none'      },
  { name: 'Luna',    bg: '#6d28d9', skin: '#ede9fe', hair: 'long',     hairCol: '#3b0764', eyes: 'star',       eyeCol: '#7c3aed', mouth: 'gentle',    acc: 'none'      },
  { name: 'Blaze',   bg: '#b91c1c', skin: '#fca5a5', hair: 'mohawk',   hairCol: '#dc2626', eyes: 'sharp',      eyeCol: '#1c1917', mouth: 'grin',      acc: 'none'      },
  { name: 'Misty',   bg: '#0e7490', skin: '#cffafe', hair: 'bob',      hairCol: '#164e63', eyes: 'sleepy',     eyeCol: '#155e75', mouth: 'smile',     acc: 'none'      },
  { name: 'Rosy',    bg: '#be185d', skin: '#fce7f3', hair: 'curly',    hairCol: '#9d174d', eyes: 'heart',      eyeCol: '#831843', mouth: 'bigsmile',  acc: 'bow'       },
  { name: 'Stone',   bg: '#4b5563', skin: '#d1d5db', hair: 'bald',     hairCol: '#1f2937', eyes: 'stern',      eyeCol: '#111827', mouth: 'frown',     acc: 'none'      },
  { name: 'Leaf',    bg: '#15803d', skin: '#dcfce7', hair: 'ponytail', hairCol: '#14532d', eyes: 'wink',       eyeCol: '#052e16', mouth: 'catmouth',  acc: 'none'      },
  { name: 'Ember',   bg: '#c2410c', skin: '#ffedd5', hair: 'wild',     hairCol: '#9a3412', eyes: 'wide',       eyeCol: '#431407', mouth: 'ohface',    acc: 'none'      },
  { name: 'Nova',    bg: '#5b21b6', skin: '#92400e', hair: 'afro',     hairCol: '#1c1917', eyes: 'round',      eyeCol: '#1c1917', mouth: 'smile',     acc: 'glasses'   },
  { name: 'Frost',   bg: '#0284c7', skin: '#e0f2fe', hair: 'straight', hairCol: '#bae6fd', eyes: 'narrow',     eyeCol: '#075985', mouth: 'smirk',     acc: 'none'      },
  { name: 'Coco',    bg: '#92400e', skin: '#b45309', hair: 'braids',   hairCol: '#451a03', eyes: 'dot',        eyeCol: '#1c0d00', mouth: 'smile',     acc: 'flower'    },
  { name: 'Shadow',  bg: '#1e1b4b', skin: '#c4b5fd', hair: 'long',     hairCol: '#0f0e1e', eyes: 'halflidded', eyeCol: '#4338ca', mouth: 'smirk',     acc: 'none'      },
  { name: 'Mint',    bg: '#047857', skin: '#d1fae5', hair: 'spiky',    hairCol: '#064e3b', eyes: 'round',      eyeCol: '#022c22', mouth: 'catmouth',  acc: 'none'      },
  { name: 'Honey',   bg: '#b45309', skin: '#fef3c7', hair: 'ponytail', hairCol: '#78350f', eyes: 'squinty',    eyeCol: '#451a03', mouth: 'smile',     acc: 'none'      },
  { name: 'Coral',   bg: '#e11d48', skin: '#ffe4e6', hair: 'shoulder', hairCol: '#9f1239', eyes: 'expressive', eyeCol: '#4c0519', mouth: 'biggrin',   acc: 'none'      },
  { name: 'Sky',     bg: '#3b82f6', skin: '#dbeafe', hair: 'cloud',    hairCol: '#93c5fd', eyes: 'dreamy',     eyeCol: '#1d4ed8', mouth: 'opensmile', acc: 'none'      },
  { name: 'Pepper',  bg: '#1f2937', skin: '#6b7280', hair: 'crop',     hairCol: '#030712', eyes: 'round',      eyeCol: '#030712', mouth: 'grin',      acc: 'glasses'   },
  { name: 'Dusk',    bg: '#3b0764', skin: '#ddd6fe', hair: 'long',     hairCol: '#0f0a1e', eyes: 'dramatic',   eyeCol: '#4338ca', mouth: 'smirk',     acc: 'horns'     },
  { name: 'Bloom',   bg: '#db2777', skin: '#fdf2f8', hair: 'wavy',     hairCol: '#9d174d', eyes: 'soft',       eyeCol: '#500724', mouth: 'gentle',    acc: 'crown'     },
  { name: 'Thunder', bg: '#a16207', skin: '#fef9c3', hair: 'spiky',    hairCol: '#854d0e', eyes: 'fierce',     eyeCol: '#1c1917', mouth: 'grin',      acc: 'lightning' },
];

export function drawPassportAvatar(ctx, idx, size) {
  const def = AVATAR_DEFS[idx];
  if (!def) return;
  const s = size;
  const cx = s / 2, cy = s / 2;

  ctx.save();
  ctx.clearRect(0, 0, s, s);

  // ── Background circle ──
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = def.bg;
  ctx.fill();
  const grad = ctx.createRadialGradient(cx, cy * 0.55, 0, cx, cy, s * 0.48);
  grad.addColorStop(0, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Clip to circle ──
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.47, 0, Math.PI * 2);
  ctx.clip();

  // ── Hair back layer ──
  _hair(ctx, def.hair, def.hairCol, cx, cy, s, false);

  // ── Face oval ──
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.05, s * 0.26, s * 0.30, 0, 0, Math.PI * 2);
  ctx.fillStyle = def.skin;
  ctx.fill();
  // chin shadow
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.2, s * 0.2, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fill();
  // cheeks
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#f87171';
  ctx.beginPath(); ctx.ellipse(cx - s*0.15, cy + s*0.1, s*0.07, s*0.042, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s*0.15, cy + s*0.1, s*0.07, s*0.042, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── Accessories behind face ──
  _acc(ctx, def.acc, def.bg, cx, cy, s, true);

  // ── Eyes ──
  _eyes(ctx, def.eyes, def.eyeCol, cx, cy, s);

  // ── Mouth ──
  _mouth(ctx, def.mouth, cx, cy, s);

  // ── Hair front layer ──
  _hair(ctx, def.hair, def.hairCol, cx, cy, s, true);

  // ── Accessories in front ──
  _acc(ctx, def.acc, def.bg, cx, cy, s, false);

  ctx.restore();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HAIR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _hair(ctx, style, col, cx, cy, s, front) {
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  const fy = cy + s * 0.05; // face center y

  switch (style) {
    case 'spiky': {
      if (front) return;
      // Cap base
      ctx.beginPath();
      ctx.arc(cx, fy, s * 0.27, Math.PI, Math.PI * 2);
      ctx.fill();
      // Spikes
      const spikes = [[-0.22,-0.34],[-0.12,-0.44],[0,-0.48],[0.12,-0.44],[0.22,-0.34],[0.30,-0.22],[-0.30,-0.22]];
      spikes.forEach(([dx, dy]) => {
        const angle = Math.atan2(dy, dx);
        const bx = cx + Math.cos(angle) * s*0.25;
        const by = fy + Math.sin(angle) * s*0.25;
        ctx.beginPath();
        ctx.moveTo(bx - Math.sin(angle)*s*0.055, by + Math.cos(angle)*s*0.055);
        ctx.lineTo(cx + dx*s*1.55, fy + dy*s*1.55);
        ctx.lineTo(bx + Math.sin(angle)*s*0.055, by - Math.cos(angle)*s*0.055);
        ctx.closePath();
        ctx.fill();
      });
      break;
    }
    case 'mohawk': {
      if (front) return;
      // Shaved sides (darker)
      ctx.beginPath();
      ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
      ctx.fillStyle = _dim(col, 0.55);
      ctx.fill();
      ctx.fillStyle = col;
      // Central tall spike
      ctx.beginPath();
      ctx.moveTo(cx - s*0.075, fy - s*0.18);
      ctx.lineTo(cx, fy - s*0.52);
      ctx.lineTo(cx + s*0.075, fy - s*0.18);
      ctx.closePath();
      ctx.fill();
      // Base block
      ctx.beginPath();
      ctx.rect(cx - s*0.075, fy - s*0.25, s*0.15, s*0.08);
      ctx.fill();
      break;
    }
    case 'bob': {
      if (front) return;
      // Rounded bob ending at jaw
      ctx.beginPath();
      ctx.arc(cx, fy, s*0.29, Math.PI*0.08, Math.PI*0.92);
      ctx.lineTo(cx + s*0.29, fy + s*0.14);
      ctx.arcTo(cx, fy + s*0.28, cx - s*0.29, fy + s*0.14, s*0.28);
      ctx.lineTo(cx - s*0.29, fy + s*0.14);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
      ctx.fill();
      break;
    }
    case 'long': {
      if (!front) {
        // Long back curtain
        ctx.beginPath();
        ctx.ellipse(cx, fy + s*0.28, s*0.33, s*0.44, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
        ctx.fill();
      }
      break;
    }
    case 'straight': {
      // Straight medium curtain
      if (!front) {
        ctx.beginPath();
        ctx.rect(cx - s*0.28, fy - s*0.24, s*0.56, s*0.52);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, fy - s*0.16, s*0.28, Math.PI, Math.PI*2);
        ctx.fill();
      }
      break;
    }
    case 'shoulder': {
      if (!front) {
        ctx.beginPath();
        ctx.ellipse(cx, fy + s*0.2, s*0.30, s*0.36, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
        ctx.fill();
      }
      break;
    }
    case 'curly': {
      if (front) return;
      const curls = [[0,-0.40],[0.16,-0.35],[-0.16,-0.35],[0.28,-0.22],[-0.28,-0.22],[0.08,-0.46],[-0.08,-0.46]];
      curls.forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(cx + dx*s, fy + dy*s, s*0.15, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.beginPath();
      ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
      ctx.fill();
      break;
    }
    case 'afro': {
      if (front) return;
      // Big round afro
      ctx.beginPath();
      ctx.arc(cx, fy - s*0.05, s*0.40, 0, Math.PI*2);
      ctx.fill();
      // Extra puff texture
      [[-.22,-.24],[.22,-.24],[0,-.38],[.30,-.10],[-.30,-.10],[0.12,-.42],[-.12,-.42]].forEach(([dx,dy]) => {
        ctx.beginPath();
        ctx.arc(cx+dx*s, fy+dy*s, s*0.14, 0, Math.PI*2);
        ctx.fill();
      });
      break;
    }
    case 'ponytail': {
      if (!front) {
        ctx.beginPath();
        ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
        ctx.fill();
        // Ponytail stalk + bun
        ctx.beginPath();
        ctx.ellipse(cx + s*0.17, fy - s*0.20, s*0.065, s*0.13, -0.4, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + s*0.17, fy - s*0.30, s*0.095, 0, Math.PI*2);
        ctx.fill();
      }
      break;
    }
    case 'wild': {
      if (front) return;
      // Fixed wild strands (no Math.random)
      const strands = [
        [0,-0.44],[-.12,-0.43],[.12,-0.43],[-.24,-0.38],[.24,-0.38],
        [-.32,-0.26],[.32,-0.26],[-.35,-0.10],[.35,-0.10],[.08,-0.47],[-.08,-0.47]
      ];
      ctx.lineWidth = s * 0.048;
      ctx.lineCap = 'round';
      strands.forEach(([dx, dy]) => {
        const a = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a)*s*0.24, fy + Math.sin(a)*s*0.24);
        ctx.lineTo(cx + dx*s*1.55, fy + dy*s*1.55);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
      ctx.fill();
      break;
    }
    case 'braids': {
      if (!front) {
        ctx.beginPath();
        ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
        ctx.fill();
        [-1, 1].forEach(side => {
          // Braid segments
          for (let i = 0; i < 5; i++) {
            const offset = (i % 2) * side * s * 0.03;
            ctx.beginPath();
            ctx.ellipse(cx + side*s*0.22 + offset, fy + s*0.04 + i*s*0.1, s*0.065, s*0.055, 0.2*side, 0, Math.PI*2);
            ctx.fill();
          }
        });
      }
      break;
    }
    case 'bald': {
      // Very subtle stubble/shine
      if (front) return;
      ctx.lineWidth = s * 0.015;
      ctx.strokeStyle = _dim(col, 0.7);
      ctx.beginPath();
      ctx.arc(cx, fy, s*0.265, Math.PI*1.05, Math.PI*1.95);
      ctx.stroke();
      break;
    }
    case 'cloud': {
      if (front) return;
      [[-.10,-.37],[.10,-.37],[0,-.43],[-.20,-.32],[.20,-.32],[0,-.29]].forEach(([dx,dy]) => {
        ctx.beginPath();
        ctx.arc(cx+dx*s, fy+dy*s, s*0.105, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.beginPath();
      ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
      ctx.fill();
      break;
    }
    case 'crop': {
      if (front) return;
      // Short crop close to head
      ctx.beginPath();
      ctx.arc(cx, fy - s*0.05, s*0.28, Math.PI, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.rect(cx - s*0.28, fy - s*0.07, s*0.56, s*0.08);
      ctx.fill();
      break;
    }
    case 'wavy': {
      if (!front) {
        ctx.beginPath();
        ctx.arc(cx, fy, s*0.27, Math.PI, Math.PI*2);
        ctx.fill();
        // Wavy sides
        [-1, 1].forEach(side => {
          ctx.lineWidth = s * 0.095;
          ctx.strokeStyle = col;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx + side*s*0.24, fy - s*0.12);
          ctx.bezierCurveTo(
            cx + side*s*0.40, fy + s*0.04,
            cx + side*s*0.30, fy + s*0.22,
            cx + side*s*0.26, fy + s*0.36
          );
          ctx.stroke();
        });
      }
      break;
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EYES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _eyes(ctx, style, col, cx, cy, s) {
  const ey = cy + s * 0.0;
  const ex1 = cx - s * 0.095, ex2 = cx + s * 0.095;
  const er  = s * 0.055;

  ctx.fillStyle  = col;
  ctx.strokeStyle = col;

  switch (style) {
    case 'round':
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey, er, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(x - er*0.28, ey - er*0.32, er*0.32, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = col;
      });
      break;

    case 'star':
      [ex1, ex2].forEach(x => _star(ctx, x, ey, er*0.82, er*0.38, 5, col));
      break;

    case 'sharp': {
      ctx.lineWidth = s*0.024; ctx.lineCap = 'round';
      [[ex1,-1],[ex2,1]].forEach(([x, side]) => {
        ctx.beginPath();
        ctx.moveTo(x - er*1.1, ey + er*0.5);
        ctx.lineTo(x + er*0.2*side, ey - er*0.6);
        ctx.lineTo(x + er, ey + er*0.5);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, ey + er*0.1, er*0.62, 0, Math.PI*2); ctx.fill();
      });
      break;
    }

    case 'sleepy': {
      ctx.lineWidth = s*0.026; ctx.lineCap = 'round';
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey + er*0.4, er, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, ey + er*0.7, er*0.38, 0, Math.PI*2); ctx.fill();
      });
      break;
    }

    case 'heart':
      [ex1, ex2].forEach(x => _heart(ctx, x, ey + er*0.1, er*0.78, col));
      break;

    case 'stern': {
      ctx.lineWidth = s*0.026;
      [[ex1,-1],[ex2,1]].forEach(([x, side]) => {
        // Brow slant
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(x - er*1.0, ey - er*0.9 - s*0.01);
        ctx.lineTo(x + er*0.7*side, ey - er*0.5);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(x, ey + er*0.1, er*0.9, er*0.7, 0, 0, Math.PI*2); ctx.fill();
      });
      break;
    }

    case 'wink': {
      ctx.lineWidth = s*0.024; ctx.lineCap = 'round';
      // Left = closed arc
      ctx.beginPath(); ctx.arc(ex1, ey, er, 0.1, Math.PI - 0.1); ctx.stroke();
      // Right = open circle
      ctx.beginPath(); ctx.arc(ex2, ey, er, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(ex2 - er*0.28, ey - er*0.32, er*0.30, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = col;
      break;
    }

    case 'wide':
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey, er*1.35, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - er*0.38, ey - er*0.38, er*0.45, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = col;
      });
      break;

    case 'dot':
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey + er*0.1, er*0.48, 0, Math.PI*2); ctx.fill();
      });
      break;

    case 'narrow': {
      ctx.lineWidth = s*0.024; ctx.lineCap = 'round';
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.moveTo(x - er, ey); ctx.lineTo(x + er, ey); ctx.stroke();
      });
      break;
    }

    case 'halflidded': {
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey, er, 0, Math.PI*2); ctx.fill();
        // Heavy lid line drooping over top half
        ctx.strokeStyle = col; ctx.lineWidth = s*0.032; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - er*1.1, ey);
        ctx.quadraticCurveTo(x, ey - er*0.95, x + er*1.1, ey);
        ctx.stroke();
      });
      break;
    }

    case 'squinty': {
      ctx.lineWidth = s*0.024; ctx.lineCap = 'round';
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey + er*0.38, er*1.08, Math.PI*1.12, Math.PI*1.88); ctx.stroke();
      });
      break;
    }

    case 'expressive': {
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey, er*1.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - er*0.32, ey - er*0.38, er*0.42, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = col;
        // Top lashes
        ctx.strokeStyle = col; ctx.lineWidth = s*0.018;
        [-0.6, 0, 0.6].forEach(la => {
          ctx.beginPath();
          ctx.moveTo(x + la*er*0.7, ey - er*0.98);
          ctx.lineTo(x + la*er*0.85, ey - er*1.48);
          ctx.stroke();
        });
      });
      break;
    }

    case 'dreamy': {
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey, er, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.beginPath(); ctx.arc(x - er*0.22, ey - er*0.28, er*0.33, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + er*0.32, ey + er*0.12, er*0.14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = col;
      });
      break;
    }

    case 'dramatic': {
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ey, er*1.1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - er*0.28, ey - er*0.34, er*0.38, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = col;
        ctx.strokeStyle = col; ctx.lineWidth = s*0.022;
        for (let l = 0; l < 5; l++) {
          const a = Math.PI + (l / 4) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a)*er*0.88, ey + Math.sin(a)*er*0.88);
          ctx.lineTo(x + Math.cos(a)*er*1.72, ey + Math.sin(a)*er*1.72);
          ctx.stroke();
        }
      });
      break;
    }

    case 'soft': {
      [ex1, ex2].forEach(x => {
        ctx.beginPath(); ctx.ellipse(x, ey, er*1.0, er*0.82, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.beginPath(); ctx.arc(x - er*0.22, ey - er*0.24, er*0.30, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = col;
      });
      break;
    }

    case 'fierce': {
      [[ex1,-1],[ex2,1]].forEach(([x, side]) => {
        ctx.beginPath(); ctx.arc(x, ey, er*1.1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(x, ey, er*0.62, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(x + side*er*0.12, ey, er*0.28, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = col;
        // Fierce brow
        ctx.strokeStyle = col; ctx.lineWidth = s*0.032; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - er*1.2, ey - er - s*0.005);
        ctx.lineTo(x + er*0.7*side, ey - er*0.4);
        ctx.stroke();
      });
      break;
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOUTH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _mouth(ctx, style, cx, cy, s) {
  const my = cy + s * 0.12;
  ctx.strokeStyle = '#6b3a20';
  ctx.fillStyle   = '#6b3a20';
  ctx.lineWidth   = s * 0.025;
  ctx.lineCap     = 'round';

  switch (style) {
    case 'bigsmile':
      ctx.beginPath(); ctx.arc(cx, my - s*0.02, s*0.125, 0.22, Math.PI - 0.22); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, my - s*0.02, s*0.115, 0.28, Math.PI - 0.28); ctx.fill();
      break;

    case 'smile':
      ctx.beginPath(); ctx.arc(cx, my - s*0.01, s*0.095, 0.30, Math.PI - 0.30); ctx.stroke();
      break;

    case 'gentle':
      ctx.beginPath(); ctx.arc(cx, my, s*0.068, 0.42, Math.PI - 0.42); ctx.stroke();
      break;

    case 'grin':
      ctx.beginPath(); ctx.arc(cx, my - s*0.025, s*0.135, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, my - s*0.025, s*0.125, 0.15, Math.PI - 0.15); ctx.fill();
      ctx.strokeStyle = '#c07850'; ctx.lineWidth = s*0.018;
      ctx.beginPath(); ctx.moveTo(cx - s*0.12, my - s*0.022); ctx.lineTo(cx + s*0.12, my - s*0.022); ctx.stroke();
      break;

    case 'biggrin':
      ctx.beginPath(); ctx.arc(cx, my - s*0.03, s*0.14, 0.08, Math.PI - 0.08); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, my - s*0.03, s*0.132, 0.12, Math.PI - 0.12); ctx.fill();
      break;

    case 'frown':
      ctx.beginPath(); ctx.arc(cx, my + s*0.065, s*0.095, Math.PI + 0.32, Math.PI*2 - 0.32); ctx.stroke();
      break;

    case 'catmouth':
      ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.moveTo(cx - s*0.088, my); ctx.lineTo(cx, my + s*0.042); ctx.lineTo(cx + s*0.088, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, my + s*0.042); ctx.lineTo(cx, my + s*0.01); ctx.stroke();
      break;

    case 'ohface':
      ctx.beginPath(); ctx.ellipse(cx, my + s*0.018, s*0.068, s*0.088, 0, 0, Math.PI*2); ctx.stroke();
      break;

    case 'smirk':
      ctx.lineWidth = s*0.024;
      ctx.beginPath();
      ctx.moveTo(cx - s*0.06, my + s*0.01);
      ctx.bezierCurveTo(cx - s*0.01, my - s*0.005, cx + s*0.048, my - s*0.022, cx + s*0.1, my - s*0.042);
      ctx.stroke();
      break;

    case 'opensmile':
      ctx.beginPath(); ctx.arc(cx, my - s*0.015, s*0.105, 0.26, Math.PI - 0.26); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, my + s*0.018, s*0.082, Math.PI + 0.32, Math.PI*2 - 0.32); ctx.fill();
      break;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCESSORIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function _acc(ctx, acc, bgCol, cx, cy, s, behind) {
  const fy = cy + s * 0.05;

  switch (acc) {
    case 'bow': {
      if (behind) return;
      const bx = cx + s*0.18, by = fy - s*0.30;
      ctx.fillStyle = '#f9a8d4'; ctx.strokeStyle = '#be185d'; ctx.lineWidth = s*0.015;
      ctx.beginPath(); ctx.ellipse(bx - s*0.075, by, s*0.068, s*0.042, -0.48, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx + s*0.075, by, s*0.068, s*0.042,  0.48, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#be185d';
      ctx.beginPath(); ctx.arc(bx, by, s*0.024, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'flower': {
      if (behind) return;
      const fx = cx - s*0.21, ffy = fy - s*0.28;
      ctx.fillStyle = '#fde047';
      for (let p = 0; p < 6; p++) {
        const a = p * Math.PI / 3;
        ctx.beginPath(); ctx.ellipse(fx + Math.cos(a)*s*0.052, ffy + Math.sin(a)*s*0.052, s*0.038, s*0.024, a, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.arc(fx, ffy, s*0.034, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'glasses': {
      if (behind) return;
      const gy = cy + s*0.01;
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = s*0.024;
      ctx.fillStyle = 'rgba(147,197,253,0.18)';
      ctx.beginPath(); ctx.arc(cx - s*0.095, gy, s*0.072, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + s*0.095, gy, s*0.072, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - s*0.023, gy); ctx.lineTo(cx + s*0.023, gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - s*0.167, gy - s*0.005); ctx.lineTo(cx - s*0.245, gy - s*0.018); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s*0.167, gy - s*0.005); ctx.lineTo(cx + s*0.245, gy - s*0.018); ctx.stroke();
      break;
    }
    case 'horns': {
      if (behind) return;
      ctx.fillStyle = '#dc2626'; ctx.strokeStyle = '#991b1b'; ctx.lineWidth = s*0.012;
      [[-0.17, -0.30], [0.17, -0.30]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx*s - s*0.034, fy + dy*s + s*0.07);
        ctx.lineTo(cx + dx*s, fy + dy*s - s*0.12);
        ctx.lineTo(cx + dx*s + s*0.034, fy + dy*s + s*0.07);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      break;
    }
    case 'crown': {
      if (behind) return;
      const kt = fy - s*0.40;
      ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#d97706'; ctx.lineWidth = s*0.014;
      ctx.beginPath();
      ctx.moveTo(cx - s*0.18, kt + s*0.09);
      ctx.lineTo(cx - s*0.18, kt + s*0.01);
      ctx.lineTo(cx - s*0.07, kt + s*0.07);
      ctx.lineTo(cx,           kt - s*0.04);
      ctx.lineTo(cx + s*0.07, kt + s*0.07);
      ctx.lineTo(cx + s*0.18, kt + s*0.01);
      ctx.lineTo(cx + s*0.18, kt + s*0.09);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ['#ef4444','#3b82f6','#22c55e'].forEach((gc, gi) => {
        ctx.fillStyle = gc;
        ctx.beginPath(); ctx.arc(cx - s*0.06 + gi*s*0.06, kt + s*0.05, s*0.018, 0, Math.PI*2); ctx.fill();
      });
      break;
    }
    case 'lightning': {
      if (behind) return;
      const lx = cx + s*0.21, ly = cy + s*0.02;
      ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = s*0.01;
      ctx.beginPath();
      ctx.moveTo(lx,          ly - s*0.075);
      ctx.lineTo(lx - s*0.038, ly);
      ctx.lineTo(lx + s*0.018, ly);
      ctx.lineTo(lx - s*0.028, ly + s*0.075);
      ctx.lineTo(lx + s*0.048, ly - s*0.008);
      ctx.lineTo(lx - s*0.008, ly - s*0.008);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────
function _star(ctx, cx, cy, ro, ri, pts, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (i * Math.PI) / pts - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + r*Math.cos(a), cy + r*Math.sin(a))
             : ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
}

function _heart(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(r, r);
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.bezierCurveTo(-1.2, -0.5, -1.5, 0.3, 0, 1);
  ctx.bezierCurveTo( 1.5, 0.3,  1.2, -0.5, 0, 0.5);
  ctx.closePath();
  ctx.restore();
  ctx.fill();
}

function _dim(hex, f) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}
