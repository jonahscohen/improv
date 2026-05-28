export interface SnapTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuideLine {
  axis: 'x' | 'y';
  position: number;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  guides: GuideLine[];
}

const SNAP_THRESHOLD = 5;

export function computeSnap(
  dragging: { x: number; y: number; width: number; height: number },
  targets: SnapTarget[],
): SnapResult {
  const dLeft   = dragging.x;
  const dRight  = dragging.x + dragging.width;
  const dCenterX = dragging.x + dragging.width / 2;
  const dTop    = dragging.y;
  const dBottom = dragging.y + dragging.height;
  const dCenterY = dragging.y + dragging.height / 2;

  let bestDx = SNAP_THRESHOLD + 1;
  let bestDy = SNAP_THRESHOLD + 1;
  const guides: GuideLine[] = [];
  const xSnapLines: number[] = [];
  const ySnapLines: number[] = [];

  for (const t of targets) {
    const tLeft    = t.x;
    const tRight   = t.x + t.width;
    const tCenterX = t.x + t.width / 2;
    const tTop     = t.y;
    const tBottom  = t.y + t.height;
    const tCenterY = t.y + t.height / 2;

    // X-axis edge pairs: [dragging edge value, target edge value]
    const xPairs: Array<[number, number]> = [
      [dLeft,    tLeft],
      [dLeft,    tRight],
      [dRight,   tLeft],
      [dRight,   tRight],
      [dCenterX, tCenterX],
    ];

    for (const [dEdge, tEdge] of xPairs) {
      const dx = tEdge - dEdge;
      const absDx = Math.abs(dx);
      if (absDx < SNAP_THRESHOLD) {
        if (absDx < Math.abs(bestDx)) {
          bestDx = dx;
          xSnapLines.length = 0;
          xSnapLines.push(tEdge);
        } else if (absDx === Math.abs(bestDx)) {
          xSnapLines.push(tEdge);
        }
      }
    }

    // Y-axis edge pairs
    const yPairs: Array<[number, number]> = [
      [dTop,     tTop],
      [dTop,     tBottom],
      [dBottom,  tTop],
      [dBottom,  tBottom],
      [dCenterY, tCenterY],
    ];

    for (const [dEdge, tEdge] of yPairs) {
      const dy = tEdge - dEdge;
      const absDy = Math.abs(dy);
      if (absDy < SNAP_THRESHOLD) {
        if (absDy < Math.abs(bestDy)) {
          bestDy = dy;
          ySnapLines.length = 0;
          ySnapLines.push(tEdge);
        } else if (absDy === Math.abs(bestDy)) {
          ySnapLines.push(tEdge);
        }
      }
    }
  }

  const didSnapX = Math.abs(bestDx) <= SNAP_THRESHOLD;
  const didSnapY = Math.abs(bestDy) <= SNAP_THRESHOLD;

  const snappedX = didSnapX ? dragging.x + bestDx : dragging.x;
  const snappedY = didSnapY ? dragging.y + bestDy : dragging.y;

  if (didSnapX) {
    for (const pos of xSnapLines) {
      guides.push({ axis: 'x', position: pos });
    }
  }
  if (didSnapY) {
    for (const pos of ySnapLines) {
      guides.push({ axis: 'y', position: pos });
    }
  }

  return { snappedX, snappedY, guides };
}
