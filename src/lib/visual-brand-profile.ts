export interface VisualBrandReferenceAssetCandidate {
  kind: 'logo' | 'icon';
  fileName: string;
  relativePath: string;
}

export type VisualBrandThemeMode = 'light' | 'dark';

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

export function getThemeMatchedVisualBrandReferenceAssetCandidate(
  theme: VisualBrandThemeMode,
  kind: VisualBrandReferenceAssetCandidate['kind'] = 'logo'
) {
  const preferredTone = theme === 'dark' ? 'white' : 'black';

  return getVisualBrandReferenceAssetCandidates()
    .filter((asset) => asset.kind === kind)
    .sort((left, right) => {
      const leftFile = left.fileName.toLowerCase();
      const rightFile = right.fileName.toLowerCase();
      const leftScore =
        (leftFile.includes(preferredTone) ? 100 : 0)
        + (left.relativePath.startsWith('./Logo/') ? 10 : 0)
        + (leftFile.endsWith('.png') ? 5 : 0);
      const rightScore =
        (rightFile.includes(preferredTone) ? 100 : 0)
        + (right.relativePath.startsWith('./Logo/') ? 10 : 0)
        + (rightFile.endsWith('.png') ? 5 : 0);

      return rightScore - leftScore;
    })[0] || null;
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
