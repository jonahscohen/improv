// Fontshare Reference Implementation
// Provides font candidates, pairing rules, OpenType features using embedded fontshare catalog

import { FontshareReference, FontCandidate } from './reference-systems';
import { Register } from './project-context';
import { ReferenceDataService } from './reference-data';

export class FontshareReferenceImpl implements FontshareReference {
  private dataService: ReferenceDataService;

  constructor() {
    this.dataService = new ReferenceDataService();
  }

  async getFontCandidates(typography: string, register: Register): Promise<FontCandidate[]> {
    const candidates: FontCandidate[] = [];
    const fontNames = this.dataService.getFontNames();

    for (const fontName of fontNames) {
      const font = this.dataService.getFont(fontName);
      if (!font) continue;

      const candidate: FontCandidate = {
        name: font.name,
        family: font.name,
        weights: font.weights.map((w) => parseInt(w, 10)),
        category: (font.personality[0] || 'sans-serif') as
          | 'sans-serif'
          | 'serif'
          | 'display'
          | 'monospace',
        pairingStrategy: font.pairing || 'neutral',
        opentypeFeatures: ['kern', 'liga', 'dlig', 'ss01', 'tabular-nums'],
        webFontUrl: `https://fonts.googleapis.com/css2?family=${font.name.replace(/\s+/g, '+')}`,
        fallback: 'system-ui, sans-serif',
      };

      candidates.push(candidate);
    }

    return candidates.slice(0, 5);
  }

  async getPairingRules(brandPersonality: string): Promise<string[]> {
    const rules = [
      'Pair serif heading with sans-serif body for classic + modern blend',
      'Stick to 1-2 font families maximum to avoid visual noise',
      'Ensure 1.25+ size ratio between heading and body for clear hierarchy',
      'Use geometric sans-serif for clean, minimal brands',
      'Use text serif for editorial, elegant, or premium personality',
      'Match font personality to brand personality (playful, professional, editorial)',
      'Verify OpenType features support (kern, liga, dlig) for semantic typography',
      'Test font metrics: line-height ≥ 1.5, descent -0.2, ascent 0.8 for readability',
    ];

    if (brandPersonality.includes('professional') || brandPersonality.includes('minimal')) {
      return rules.slice(0, 3);
    } else if (brandPersonality.includes('playful') || brandPersonality.includes('friendly')) {
      return [
        'Playful brands pair rounded sans-serif with geometric display font',
        'Use variable fonts for personality and personality range',
        ...rules.slice(4, 6),
      ];
    }

    return rules.slice(0, 5);
  }

  async getOpenTypeFeatures(fontName: string): Promise<string[]> {
    const font = this.dataService.getFont(fontName);
    if (!font) return [];

    const defaultFeatures = ['kern', 'liga', 'dlig', 'ss01', 'tabular-nums', 'zero', 'smcp'];

    if (fontName.toLowerCase().includes('mono') || font.personality.includes('monospace')) {
      return ['kern', 'zero', 'tabular-nums'];
    }

    if (fontName.toLowerCase().includes('display')) {
      return ['kern', 'liga', 'dlig', 'ss01', 'ss02'];
    }

    return defaultFeatures;
  }

  async validateFontMetrics(fontName: string): Promise<{
    lineHeight: number;
    descent: number;
    ascent: number;
  }> {
    // Typical values for web fonts; in production would inspect actual font metrics
    return {
      lineHeight: 1.5,
      descent: -0.2,
      ascent: 0.8,
    };
  }
}

export function createFontshareReference(): FontshareReference {
  return new FontshareReferenceImpl();
}
