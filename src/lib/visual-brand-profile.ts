export interface VisualBrandReferenceAssetCandidate {
  kind: 'logo' | 'icon';
  fileName: string;
  relativePath: string;
}

export const QUALY_VISUAL_BRAND_PROFILE = {
  id: 'qualy',
  name: 'Qualy',
  referenceAssetCandidates: [
    {
      kind: 'logo',
      fileName: 'logo-black.png',
      relativePath: './Logo/logo-black.png',
    },
    {
      kind: 'logo',
      fileName: 'logo-white.png',
      relativePath: './Logo/logo-white.png',
    },
    {
      kind: 'icon',
      fileName: 'icon-black.png',
      relativePath: './Logo/icon-black.png',
    },
    {
      kind: 'icon',
      fileName: 'icon-white.png',
      relativePath: './Logo/icon-white.png',
    },
    {
      kind: 'logo',
      fileName: 'logo-black.png',
      relativePath: '../Qualy-lp/public/logo-black.png',
    },
    {
      kind: 'icon',
      fileName: 'icon-black.png',
      relativePath: '../Qualy-lp/public/icon-black.png',
    },
    {
      kind: 'logo',
      fileName: 'logo-black.png',
      relativePath: '../leadqualifier/public/logo-black.png',
    },
    {
      kind: 'icon',
      fileName: 'icon-black.png',
      relativePath: '../leadqualifier/public/icon-black.png',
    },
    {
      kind: 'logo',
      fileName: 'logo-black.svg',
      relativePath: '../Qualy-lp/public/logo-black.svg',
    },
    {
      kind: 'icon',
      fileName: 'icon-black.svg',
      relativePath: '../Qualy-lp/public/icon-black.svg',
    },
    {
      kind: 'logo',
      fileName: 'logo-black.svg',
      relativePath: '../leadqualifier/public/logo-black.svg',
    },
    {
      kind: 'icon',
      fileName: 'icon-black.svg',
      relativePath: '../leadqualifier/public/icon-black.svg',
    },
  ],
} as const;

export function resolveVisualBrandName(productName?: string) {
  const normalized = String(productName || '').trim();
  return normalized || QUALY_VISUAL_BRAND_PROFILE.name;
}

export function getVisualBrandReferenceAssetCandidates(): VisualBrandReferenceAssetCandidate[] {
  return QUALY_VISUAL_BRAND_PROFILE.referenceAssetCandidates.map((asset) => ({ ...asset }));
}

export function buildVisualBrandBlock(productName?: string) {
  const brandName = resolveVisualBrandName(productName);

  return `
BRAND SYSTEM: ${brandName}
- This visual belongs to ${brandName}. Keep the brand presence crisp, premium, and restrained.
- If a brand mark appears, use one small signature placement only: the ${brandName} wordmark or icon.
- When both dark and light logo variants exist, choose the black or white version with the strongest contrast against the local background.
- Prefer one clean wordmark or icon anchor, never repeated stickers, wallpaper logos, or oversized brand stamps.
- Do not distort, redraw, or invent alternate logo forms.
`.trim();
}
