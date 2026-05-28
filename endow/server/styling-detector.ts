import type { StylingApproach } from './types.js';

export function detectStylingApproach(
  files: string[],
  dependencies: string[] = []
): StylingApproach {
  const hasTailwindConfig = files.some((f) => /tailwind\.config/.test(f));
  const hasTailwindDep = dependencies.includes('tailwindcss');
  if (hasTailwindConfig || hasTailwindDep) return 'tailwind';

  const hasCssModules = files.some((f) => /\.module\.(css|scss|sass|less)$/.test(f));
  if (hasCssModules) return 'css-modules';

  const hasStyledComponents =
    dependencies.includes('styled-components') ||
    dependencies.includes('@emotion/styled');
  if (hasStyledComponents) return 'styled-components';

  const hasSassFile = files.some((f) => /\.(scss|sass)$/.test(f));
  const hasSassDep = dependencies.includes('sass');
  if (hasSassFile || hasSassDep) return 'sass';

  const hasCssFile = files.some((f) => /\.css$/.test(f));
  if (hasCssFile) return 'plain-css';

  return 'unknown';
}

export function getGuidance(approach: StylingApproach): string {
  switch (approach) {
    case 'tailwind':
      return 'Tailwind CSS detected. Apply all changes using utility classes. Do not use inline styles.';
    case 'css-modules':
      return 'CSS Modules detected. Apply changes to the corresponding .module.css file.';
    case 'styled-components':
      return 'styled-components detected. Apply changes within the styled template literal.';
    case 'sass':
      return 'Sass detected. Apply changes to the appropriate .scss file using variables where possible.';
    case 'plain-css':
      return 'Plain CSS detected. Apply changes to the matching CSS file and selector.';
    case 'unknown':
      return 'Styling approach unknown. Use inline styles or the most appropriate file.';
  }
}
