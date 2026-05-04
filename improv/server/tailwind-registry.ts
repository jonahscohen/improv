const spacingScale: Record<string, string> = {
  '0': '0px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '3.5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '11': '2.75rem',
  '12': '3rem',
  '14': '3.5rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
  '28': '7rem',
  '32': '8rem',
  '36': '9rem',
  '40': '10rem',
  '44': '11rem',
  '48': '12rem',
  '52': '13rem',
  '56': '14rem',
  '60': '15rem',
  '64': '16rem',
  '72': '18rem',
  '80': '20rem',
  '96': '24rem',
  'px': '1px',
  'auto': 'auto',
};

const radiusScale: Record<string, string> = {
  'none': '0px',
  'sm': '0.125rem',
  '': '0.25rem',
  'md': '0.375rem',
  'lg': '0.5rem',
  'xl': '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  'full': '9999px',
};

interface UtilityResolution {
  property: string;
  value: string;
}

const spacingPrefixMap: Record<string, string[]> = {
  'p': ['padding'],
  'px': ['padding-left', 'padding-right'],
  'py': ['padding-top', 'padding-bottom'],
  'pt': ['padding-top'],
  'pr': ['padding-right'],
  'pb': ['padding-bottom'],
  'pl': ['padding-left'],
  'm': ['margin'],
  'mx': ['margin-left', 'margin-right'],
  'my': ['margin-top', 'margin-bottom'],
  'mt': ['margin-top'],
  'mr': ['margin-right'],
  'mb': ['margin-bottom'],
  'ml': ['margin-left'],
  'gap': ['gap'],
};

export function resolveUtilityClass(className: string): UtilityResolution | null {
  // Handle border-radius: rounded or rounded-X
  if (className === 'rounded') {
    return { property: 'border-radius', value: radiusScale[''] };
  }
  if (className.startsWith('rounded-')) {
    const key = className.slice('rounded-'.length);
    const value = radiusScale[key];
    if (value !== undefined) {
      return { property: 'border-radius', value };
    }
    return null;
  }

  // Handle spacing utilities: prefix-value
  const dashIdx = className.indexOf('-');
  if (dashIdx === -1) return null;

  const prefix = className.slice(0, dashIdx);
  const scaleKey = className.slice(dashIdx + 1);

  const properties = spacingPrefixMap[prefix];
  if (!properties) return null;

  const value = spacingScale[scaleKey];
  if (value === undefined) return null;

  // Return the canonical single property (first in list for multi-property prefixes)
  return { property: properties[0], value };
}

export function findClassForValue(property: string, value: string): string | null {
  // Border radius
  if (property === 'border-radius') {
    for (const [key, val] of Object.entries(radiusScale)) {
      if (val === value) {
        return key === '' ? 'rounded' : `rounded-${key}`;
      }
    }
    return null;
  }

  // Spacing: find the canonical prefix for this CSS property
  const canonicalPrefix = findCanonicalPrefix(property);
  if (!canonicalPrefix) return null;

  for (const [key, val] of Object.entries(spacingScale)) {
    if (val === value) {
      return `${canonicalPrefix}-${key}`;
    }
  }

  return null;
}

function findCanonicalPrefix(property: string): string | null {
  const propertyToPrefixMap: Record<string, string> = {
    'padding': 'p',
    'padding-left': 'pl',
    'padding-right': 'pr',
    'padding-top': 'pt',
    'padding-bottom': 'pb',
    'margin': 'm',
    'margin-left': 'ml',
    'margin-right': 'mr',
    'margin-top': 'mt',
    'margin-bottom': 'mb',
    'gap': 'gap',
  };
  return propertyToPrefixMap[property] ?? null;
}

export function isTailwindClass(className: string): boolean {
  return resolveUtilityClass(className) !== null;
}
