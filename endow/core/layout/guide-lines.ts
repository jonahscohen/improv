const GUIDE_COLOR        = '#f59e0b';
const GUIDE_OPACITY      = '0.6';
const LABEL_BG           = '#1a1a2e';
const LABEL_COLOR        = '#f59e0b';

interface GuideSpec {
  axis:       'x' | 'y';
  position:   number;
  distance?:  number;
  isCenter?:  boolean;
}

export class GuideLineRenderer {
  private container: HTMLElement;
  private lines: Array<HTMLDivElement | HTMLSpanElement> = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show(guides: GuideSpec[]): void {
    this.hide();

    for (const guide of guides) {
      const line = document.createElement('div');

      Object.assign(line.style, {
        position:      'absolute',
        pointerEvents: 'none',
        zIndex:        '9999',
        opacity:       GUIDE_OPACITY,
      });

      if (guide.isCenter) {
        // Dashed line for center alignment guides
        line.style.borderStyle = 'dashed';
        line.style.borderColor = GUIDE_COLOR;
        line.style.background  = 'transparent';
      } else {
        line.style.background = GUIDE_COLOR;
      }

      if (guide.axis === 'x') {
        // Vertical line at x position - extends full viewport height
        Object.assign(line.style, {
          left:   `${guide.position}px`,
          top:    '0',
          width:  guide.isCenter ? '0' : '1px',
          height: '100vh',
        });
        if (guide.isCenter) {
          line.style.borderLeftWidth = '1px';
          line.style.borderLeftStyle = 'dashed';
          line.style.borderLeftColor = GUIDE_COLOR;
        }
      } else {
        // Horizontal line at y position - extends full viewport width
        Object.assign(line.style, {
          top:    `${guide.position}px`,
          left:   '0',
          width:  '100vw',
          height: guide.isCenter ? '0' : '1px',
        });
        if (guide.isCenter) {
          line.style.borderTopWidth = '1px';
          line.style.borderTopStyle = 'dashed';
          line.style.borderTopColor = GUIDE_COLOR;
        }
      }

      this.container.appendChild(line);
      this.lines.push(line);

      // Distance label pill
      if (guide.distance !== undefined && guide.distance > 0) {
        const pill = this.buildDistanceLabel(guide);
        this.container.appendChild(pill);
        this.lines.push(pill);
      }
    }
  }

  private buildDistanceLabel(guide: GuideSpec): HTMLDivElement {
    const pill = document.createElement('div');
    pill.textContent = `${Math.round(guide.distance ?? 0)}px`;

    Object.assign(pill.style, {
      position:        'absolute',
      background:      LABEL_BG,
      color:           LABEL_COLOR,
      fontSize:        '10px',
      fontWeight:      '600',
      fontFamily:      'system-ui, -apple-system, monospace',
      padding:         '2px 6px',
      borderRadius:    '4px',
      pointerEvents:   'none',
      zIndex:          '10000',
      whiteSpace:      'nowrap',
      border:          `1px solid rgba(245,158,11,0.3)`,
      lineHeight:      '1.4',
      letterSpacing:   '0.02em',
    });

    // Position label near the snap point
    if (guide.axis === 'x') {
      pill.style.left = `${guide.position + 4}px`;
      pill.style.top  = '8px';
    } else {
      pill.style.top  = `${guide.position + 4}px`;
      pill.style.left = '8px';
    }

    return pill;
  }

  hide(): void {
    for (const el of this.lines) {
      el.remove();
    }
    this.lines = [];
  }

  destroy(): void {
    this.hide();
  }
}
