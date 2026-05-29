import type { Effect, EffectOpts } from '../../types';

/**
 * Swarm - a grid of spring-return dots that the pointer attracts (or repels)
 * with per-dot orbital jitter. Verbatim port of regent's SwarmTuner physics and
 * drawShape commands (lane-1 recon report). Canvas2D, no WebGL.
 *
 * Pointer is injected via onPointer (canvas-relative). When the pointer leaves,
 * call onPointer with NaN to deactivate, or it simply stops updating.
 */

type DotShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'sparkle' | 'cross';

interface Dot {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  orbitAngle: number;
  orbitSpeed: number;
}

interface SwarmParams {
  gridSpacing: number;
  dotRadius: number;
  dotShape: DotShape;
  attractRadius: number;
  attractStrength: number;
  repelMode: boolean;
  orbitRadius: number;
  orbitJitter: number;
  friction: number;
  returnStrength: number;
  idleColor: string;
  swarmColor: string;
  bgColor: string;
  idleAlpha: number;
  swarmAlpha: number;
  glowAlpha: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// drawShape - verbatim Canvas2D path commands (regent drawShape()).
function drawShape(ctx: CanvasRenderingContext2D, shape: DotShape, x: number, y: number, r: number): void {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.866, y + r * 0.5);
      ctx.lineTo(x - r * 0.866, y + r * 0.5);
      ctx.closePath();
      break;
    case 'sparkle': {
      // 4-point star
      const o = r * 0.4;
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + o, y - o);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x + o, y + o);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - o, y + o);
      ctx.lineTo(x - r, y);
      ctx.lineTo(x - o, y - o);
      ctx.closePath();
      break;
    }
    case 'cross': {
      const t = r * 0.4;
      ctx.rect(x - t, y - r, t * 2, r * 2);
      ctx.rect(x - r, y - t, r * 2, t * 2);
      break;
    }
    case 'circle':
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
  }
  ctx.fill();
}

export function createSwarmEffect(): Effect {
  let ctx: CanvasRenderingContext2D | null = null;
  let dead = false;
  let w = 1;
  let h = 1;
  let dots: Dot[] = [];
  let prevSpacing = 0;

  let mx = 0;
  let my = 0;
  let mouseActive = false;

  const p: SwarmParams = {
    gridSpacing: 18,
    dotRadius: 1,
    dotShape: 'circle',
    attractRadius: 220,
    attractStrength: 0.035,
    repelMode: false,
    orbitRadius: 30,
    orbitJitter: 0.6,
    friction: 0.92,
    returnStrength: 0.008,
    idleColor: '#ffffff',
    swarmColor: '#ffffff',
    bgColor: '#060608',
    idleAlpha: 0.08,
    swarmAlpha: 0.55,
    glowAlpha: 0.15,
  };

  function buildGrid(spacing: number): void {
    const next: Dot[] = [];
    const cols = Math.ceil(w / spacing) + 2;
    const rows = Math.ceil(h / spacing) + 2;
    const offsetX = (w - (cols - 1) * spacing) / 2;
    const offsetY = (h - (rows - 1) * spacing) / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const hx = offsetX + col * spacing;
        const hy = offsetY + row * spacing;
        next.push({
          homeX: hx,
          homeY: hy,
          x: hx,
          y: hy,
          vx: 0,
          vy: 0,
          orbitAngle: Math.random() * Math.PI * 2,
          orbitSpeed: 0.02 + Math.random() * 0.02,
        });
      }
    }
    dots = next;
    prevSpacing = spacing;
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | null;
      if (!ctx) {
        dead = true;
        return;
      }
      for (const k of Object.keys(p) as (keyof SwarmParams)[]) {
        if (k in opts.params) this.setParam(k, opts.params[k]);
      }
      if (dots.length === 0) buildGrid(p.gridSpacing);
    },

    frame() {
      if (dead || !ctx || !ctx.fillRect) return;
      if (prevSpacing !== p.gridSpacing) buildGrid(p.gridSpacing);

      ctx.fillStyle = p.bgColor;
      ctx.fillRect(0, 0, w, h);

      const idleRgb = hexToRgb(p.idleColor);
      const swarmRgb = hexToRgb(p.swarmColor);

      for (const dot of dots) {
        dot.orbitAngle += dot.orbitSpeed;
        let attracted = false;
        if (mouseActive) {
          const dx = mx - dot.homeX;
          const dy = my - dot.homeY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < p.attractRadius) {
            const force = 1 - dist / p.attractRadius;
            const eased = force * force * force;
            if (p.repelMode) {
              const homeDx = dot.homeX - mx;
              const homeDy = dot.homeY - my;
              const homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy) || 1;
              const nx = homeDx / homeDist;
              const ny = homeDy / homeDist;
              const targetX = mx + nx * p.attractRadius;
              const targetY = my + ny * p.attractRadius;
              dot.vx += (targetX - dot.x) * p.attractStrength * eased;
              dot.vy += (targetY - dot.y) * p.attractStrength * eased;
            } else {
              const orbitR = p.orbitRadius * (1 - eased * 0.5);
              const jitterX = Math.cos(dot.orbitAngle) * orbitR * p.orbitJitter;
              const jitterY = Math.sin(dot.orbitAngle) * orbitR * p.orbitJitter;
              dot.vx += (mx + jitterX - dot.x) * p.attractStrength * eased;
              dot.vy += (my + jitterY - dot.y) * p.attractStrength * eased;
            }
            attracted = true;
          }
        }
        if (!attracted) {
          dot.vx += (dot.homeX - dot.x) * p.returnStrength;
          dot.vy += (dot.homeY - dot.y) * p.returnStrength;
        } else {
          dot.vx += (dot.homeX - dot.x) * p.returnStrength * 0.15;
          dot.vy += (dot.homeY - dot.y) * p.returnStrength * 0.15;
        }
        dot.vx *= p.friction;
        dot.vy *= p.friction;
        dot.x += dot.vx;
        dot.y += dot.vy;

        const ddx = dot.x - dot.homeX;
        const ddy = dot.y - dot.homeY;
        const displacement = Math.sqrt(ddx * ddx + ddy * ddy);
        const t = Math.min(displacement / 60, 1);
        const alpha = p.idleAlpha + (p.swarmAlpha - p.idleAlpha) * t;
        const radius = p.dotRadius + t * 0.8;
        const r = Math.round(idleRgb[0] + (swarmRgb[0] - idleRgb[0]) * t);
        const g = Math.round(idleRgb[1] + (swarmRgb[1] - idleRgb[1]) * t);
        const b = Math.round(idleRgb[2] + (swarmRgb[2] - idleRgb[2]) * t);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        drawShape(ctx, p.dotShape, dot.x, dot.y, radius);
        if (t > 0.4) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.glowAlpha * (t - 0.4)})`;
          drawShape(ctx, p.dotShape, dot.x, dot.y, radius + 2);
        }
      }
    },

    resize(nw: number, nh: number) {
      w = Math.max(1, nw);
      h = Math.max(1, nh);
      buildGrid(p.gridSpacing);
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'gridSpacing':
          p.gridSpacing = Math.max(1, Number(value));
          break;
        case 'dotRadius':
          p.dotRadius = Number(value);
          break;
        case 'dotShape':
          p.dotShape = String(value) as DotShape;
          break;
        case 'attractRadius':
          p.attractRadius = Number(value);
          break;
        case 'attractStrength':
          p.attractStrength = Number(value);
          break;
        case 'repelMode':
          p.repelMode = Boolean(value);
          break;
        case 'orbitRadius':
          p.orbitRadius = Number(value);
          break;
        case 'orbitJitter':
          p.orbitJitter = Number(value);
          break;
        case 'friction':
          p.friction = Number(value);
          break;
        case 'returnStrength':
          p.returnStrength = Number(value);
          break;
        case 'idleColor':
          p.idleColor = String(value);
          break;
        case 'swarmColor':
          p.swarmColor = String(value);
          break;
        case 'bgColor':
          p.bgColor = String(value);
          break;
        case 'idleAlpha':
          p.idleAlpha = Number(value);
          break;
        case 'swarmAlpha':
          p.swarmAlpha = Number(value);
          break;
        case 'glowAlpha':
          p.glowAlpha = Number(value);
          break;
        default:
          break;
      }
    },

    onPointer(x: number, y: number) {
      if (Number.isNaN(x) || Number.isNaN(y)) {
        mouseActive = false;
        return;
      }
      mx = x;
      my = y;
      mouseActive = true;
    },

    dispose() {
      dots = [];
      ctx = null;
      dead = true;
    },
  };
}
