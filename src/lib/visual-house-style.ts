export type VisualTheme = 'light' | 'dark' | 'mixed';

function normalizeHexColor(value: string) {
  const normalized = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : '#C7FF41';
}

export const VISUAL_HOUSE_STYLE = {
  id: 'quiet-signal',
  name: 'Quiet Signal',
  summary: 'Minimal editorial poster system built for one-glance comprehension and conversion.',
} as const;

export const VISUAL_CREATOR_DEFAULTS = {
  activePreset: 'instagram_feed',
  platform: 'Instagram',
  aspectRatio: '4:5',
  campaignType: 'Product promotion',
  tone: 'Professional',
  designStyle: 'Quiet Signal Editorial',
  theme: 'mixed',
  mode: 'Social Media Promo',
} as const;

export const VISUAL_CREATOR_PRESETS = [
  {
    id: 'linkedin',
    name: 'LinkedIn Feed',
    settings: {
      platform: 'LinkedIn',
      aspectRatio: '1:1',
      campaignType: 'Feature announcement',
      tone: 'Professional',
      designStyle: 'Quiet Signal Editorial',
      theme: 'mixed',
      mode: 'Social Media Promo',
    },
  },
  {
    id: 'instagram_feed',
    name: 'Instagram Feed',
    settings: {
      platform: 'Instagram',
      aspectRatio: '4:5',
      campaignType: 'Product promotion',
      tone: 'Professional',
      designStyle: 'Quiet Signal Editorial',
      theme: 'mixed',
      mode: 'Social Media Promo',
    },
  },
  {
    id: 'website_hero',
    name: 'Website Hero',
    settings: {
      platform: 'Website',
      aspectRatio: '16:9',
      campaignType: 'Landing page visual',
      tone: 'Premium',
      designStyle: 'Quiet Signal Editorial',
      theme: 'mixed',
      mode: 'Magazine Editorial',
    },
  },
] as const;

export function buildVisualHouseStyleBlock(brandColor: string) {
  const accentColor = normalizeHexColor(brandColor);

  return `
HOUSE STYLE: ${VISUAL_HOUSE_STYLE.name}
- Build every visual as a restrained editorial poster, not a collage, template dump, or sticker board.
- Communicate the core idea within 3 seconds. One message, one focal subject, one conversion path.
- Use one dominant subject only. Supporting elements must stay sparse and subordinate.
- Introduce one disciplined signal frame, beam, border, or crop tension so the composition feels unmistakably branded.
- Use a calm neutral base palette first, then exactly one accent color derived from the brand color: ${accentColor}.
- Favor asymmetrical composition, large negative space, sharp hierarchy, and a deliberate premium feel.
- Keep text minimal and decisive. Use headline and subheadline, plus at most one CTA when CTA is enabled. No extra labels, captions, badges, or paragraphs unless the campaign explicitly requires one.
- Avoid clutter, icon showers, busy gradients, floating junk, meme energy, cheap urgency tropes, and generic startup stock aesthetics.
`.trim();
}

const QUIET_SIGNAL_VARIATIONS = [
  'Variation direction: editorial poster. One oversized hero element, balanced negative space, and a stable lower text anchor.',
  'Variation direction: tight crop. Push one meaningful subject or UI fragment large into frame so the concept reads instantly.',
  'Variation direction: asymmetric signal board. Keep the layout structured but off-center, with one disciplined supporting motif.',
  'Variation direction: high-contrast stillness. Reduce the scene even further and let one sharp visual tension point carry the frame.',
];

export function getVisualHouseStyleVariationText(variationIndex: number) {
  return QUIET_SIGNAL_VARIATIONS[Math.abs(variationIndex) % QUIET_SIGNAL_VARIATIONS.length];
}

export function resolveVisualThemeForVariation(theme: VisualTheme, variationIndex: number): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return Math.abs(variationIndex) % 4 < 2 ? 'light' : 'dark';
}

export function buildVisualThemeBlock(theme: VisualTheme, variationIndex: number) {
  const resolvedTheme = resolveVisualThemeForVariation(theme, variationIndex);

  if (resolvedTheme === 'light') {
    return `
THEME DIRECTION:
- Requested Theme Mode: ${theme}
- Resolved Theme Variant: light
- Keep the overall frame light-dominant, airy, and bright.
- Use pale neutrals, soft paper tones, off-white surfaces, and a faint cool-blue, lilac, blush, or mint haze.
- Add a soft editorial tint field or gradient paper wash behind the hero area when the frame needs more life.
- Do not fall back to a flat plain white canvas.
- Do not drift into dark-mode backgrounds or night palettes.
`.trim();
  }

  return `
THEME DIRECTION:
- Requested Theme Mode: ${theme}
- Resolved Theme Variant: dark
- Keep the overall frame dark-dominant, grounded, and high-contrast.
- Use charcoal, graphite, ink, deep navy, or restrained night-studio treatment.
- Do not drift into bright white canvases or light-mode product framing.
`.trim();
}
