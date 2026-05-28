export interface PrimitiveType {
  name: string;
  category: 'layout' | 'content' | 'controls' | 'elements' | 'blocks';
  defaultWidth: number;
  defaultHeight: number;
}

export const PRIMITIVES: PrimitiveType[] = [
  // Layout (11)
  { name: 'navigation',  category: 'layout',   defaultWidth: 800, defaultHeight: 60  },
  { name: 'header',      category: 'layout',   defaultWidth: 800, defaultHeight: 80  },
  { name: 'hero',        category: 'layout',   defaultWidth: 800, defaultHeight: 400 },
  { name: 'section',     category: 'layout',   defaultWidth: 800, defaultHeight: 300 },
  { name: 'sidebar',     category: 'layout',   defaultWidth: 240, defaultHeight: 500 },
  { name: 'footer',      category: 'layout',   defaultWidth: 800, defaultHeight: 120 },
  { name: 'modal',       category: 'layout',   defaultWidth: 480, defaultHeight: 320 },
  { name: 'banner',      category: 'layout',   defaultWidth: 800, defaultHeight: 60  },
  { name: 'drawer',      category: 'layout',   defaultWidth: 320, defaultHeight: 500 },
  { name: 'popover',     category: 'layout',   defaultWidth: 240, defaultHeight: 180 },
  { name: 'divider',     category: 'layout',   defaultWidth: 800, defaultHeight: 2   },

  // Content (17)
  { name: 'card',        category: 'content',  defaultWidth: 320, defaultHeight: 240 },
  { name: 'text',        category: 'content',  defaultWidth: 400, defaultHeight: 80  },
  { name: 'image',       category: 'content',  defaultWidth: 320, defaultHeight: 200 },
  { name: 'video',       category: 'content',  defaultWidth: 480, defaultHeight: 270 },
  { name: 'table',       category: 'content',  defaultWidth: 600, defaultHeight: 300 },
  { name: 'grid',        category: 'content',  defaultWidth: 800, defaultHeight: 400 },
  { name: 'list',        category: 'content',  defaultWidth: 320, defaultHeight: 200 },
  { name: 'chart',       category: 'content',  defaultWidth: 400, defaultHeight: 300 },
  { name: 'codeBlock',   category: 'content',  defaultWidth: 500, defaultHeight: 200 },
  { name: 'map',         category: 'content',  defaultWidth: 400, defaultHeight: 300 },
  { name: 'timeline',    category: 'content',  defaultWidth: 600, defaultHeight: 400 },
  { name: 'calendar',    category: 'content',  defaultWidth: 360, defaultHeight: 320 },
  { name: 'accordion',   category: 'content',  defaultWidth: 400, defaultHeight: 200 },
  { name: 'carousel',    category: 'content',  defaultWidth: 600, defaultHeight: 300 },
  { name: 'logo',        category: 'content',  defaultWidth: 120, defaultHeight: 40  },
  { name: 'faq',         category: 'content',  defaultWidth: 600, defaultHeight: 300 },
  { name: 'gallery',     category: 'content',  defaultWidth: 800, defaultHeight: 400 },

  // Controls (14)
  { name: 'button',      category: 'controls', defaultWidth: 120, defaultHeight: 40  },
  { name: 'input',       category: 'controls', defaultWidth: 240, defaultHeight: 40  },
  { name: 'search',      category: 'controls', defaultWidth: 300, defaultHeight: 40  },
  { name: 'form',        category: 'controls', defaultWidth: 400, defaultHeight: 300 },
  { name: 'tabs',        category: 'controls', defaultWidth: 500, defaultHeight: 40  },
  { name: 'dropdown',    category: 'controls', defaultWidth: 200, defaultHeight: 40  },
  { name: 'toggle',      category: 'controls', defaultWidth: 48,  defaultHeight: 24  },
  { name: 'stepper',     category: 'controls', defaultWidth: 120, defaultHeight: 40  },
  { name: 'rating',      category: 'controls', defaultWidth: 160, defaultHeight: 32  },
  { name: 'fileUpload',  category: 'controls', defaultWidth: 300, defaultHeight: 120 },
  { name: 'checkbox',    category: 'controls', defaultWidth: 20,  defaultHeight: 20  },
  { name: 'radio',       category: 'controls', defaultWidth: 20,  defaultHeight: 20  },
  { name: 'slider',      category: 'controls', defaultWidth: 200, defaultHeight: 24  },
  { name: 'datePicker',  category: 'controls', defaultWidth: 280, defaultHeight: 320 },

  // Elements (15)
  { name: 'avatar',       category: 'elements', defaultWidth: 40,  defaultHeight: 40  },
  { name: 'badge',        category: 'elements', defaultWidth: 60,  defaultHeight: 24  },
  { name: 'tag',          category: 'elements', defaultWidth: 80,  defaultHeight: 28  },
  { name: 'breadcrumb',   category: 'elements', defaultWidth: 300, defaultHeight: 24  },
  { name: 'pagination',   category: 'elements', defaultWidth: 300, defaultHeight: 40  },
  { name: 'progress',     category: 'elements', defaultWidth: 200, defaultHeight: 8   },
  { name: 'alert',        category: 'elements', defaultWidth: 400, defaultHeight: 60  },
  { name: 'toast',        category: 'elements', defaultWidth: 320, defaultHeight: 60  },
  { name: 'notification', category: 'elements', defaultWidth: 320, defaultHeight: 80  },
  { name: 'tooltip',      category: 'elements', defaultWidth: 200, defaultHeight: 40  },
  { name: 'stat',         category: 'elements', defaultWidth: 160, defaultHeight: 80  },
  { name: 'skeleton',     category: 'elements', defaultWidth: 200, defaultHeight: 20  },
  { name: 'chip',         category: 'elements', defaultWidth: 80,  defaultHeight: 28  },
  { name: 'icon',         category: 'elements', defaultWidth: 24,  defaultHeight: 24  },
  { name: 'spinner',      category: 'elements', defaultWidth: 24,  defaultHeight: 24  },

  // Blocks (9)
  { name: 'pricing',      category: 'blocks',   defaultWidth: 320, defaultHeight: 400 },
  { name: 'testimonial',  category: 'blocks',   defaultWidth: 400, defaultHeight: 200 },
  { name: 'cta',          category: 'blocks',   defaultWidth: 800, defaultHeight: 200 },
  { name: 'productCard',  category: 'blocks',   defaultWidth: 280, defaultHeight: 360 },
  { name: 'profile',      category: 'blocks',   defaultWidth: 320, defaultHeight: 200 },
  { name: 'feature',      category: 'blocks',   defaultWidth: 280, defaultHeight: 200 },
  { name: 'team',         category: 'blocks',   defaultWidth: 240, defaultHeight: 280 },
  { name: 'login',        category: 'blocks',   defaultWidth: 400, defaultHeight: 400 },
  { name: 'contact',      category: 'blocks',   defaultWidth: 500, defaultHeight: 400 },
];

export function getPrimitivesByCategory(
  cat: PrimitiveType['category'],
): PrimitiveType[] {
  return PRIMITIVES.filter((p) => p.category === cat);
}

export function getPrimitive(name: string): PrimitiveType | undefined {
  return PRIMITIVES.find((p) => p.name === name);
}
