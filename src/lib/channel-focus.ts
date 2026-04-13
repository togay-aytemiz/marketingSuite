const CHANNEL_DEFINITIONS = [
  { label: 'WhatsApp', pattern: /\bwhats\s*app\b|\bwhatsapp\b/i },
  { label: 'Instagram', pattern: /\binstagram\b|\big\b/i },
  { label: 'Messenger', pattern: /\bmessenger\b/i },
  { label: 'Telegram', pattern: /\btelegram\b/i },
] as const;

export type KnownChannelLabel = (typeof CHANNEL_DEFINITIONS)[number]['label'];

const CHANNEL_ACCENT_HINTS: Record<KnownChannelLabel, string> = {
  WhatsApp: 'Allow one small WhatsApp green outline chat glyph, knockout mark, or cutout badge near the focal area, plus a faint mint-green tint behind that zone.',
  Instagram: 'Allow one small Instagram gradient outline camera glyph, gradient rim, or knockout/cutout badge near the focal area; do not use a filled app-tile, solid gradient square, or generic rounded gradient blob. Add only a faint rose-lilac-peach tint behind that zone.',
  Messenger: 'Allow one small Messenger blue outline chat glyph, knockout mark, or cutout badge near the focal area, plus a faint cool-blue tint behind that zone.',
  Telegram: 'Allow one small Telegram blue outline paper-plane glyph, knockout mark, or cutout badge near the focal area, plus a faint icy-sky tint behind that zone.',
};

function dedupeChannels(items: KnownChannelLabel[]) {
  return Array.from(new Set(items));
}

export function detectRequestedChannels(values: Array<string | null | undefined>): KnownChannelLabel[] {
  const detected: KnownChannelLabel[] = [];

  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      continue;
    }

    for (const definition of CHANNEL_DEFINITIONS) {
      if (definition.pattern.test(normalized)) {
        detected.push(definition.label);
      }
    }
  }

  return dedupeChannels(detected);
}

export function getRequestedChannelAccentHints(channels: KnownChannelLabel[]) {
  return dedupeChannels(channels).map((channel) => CHANNEL_ACCENT_HINTS[channel]);
}
