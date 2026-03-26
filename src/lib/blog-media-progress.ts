export type MediaPreviewKind = 'cover' | 'inline';
export type MediaPreviewStatus = 'loading' | 'ready' | 'empty';

export interface ResolveMediaPreviewStateInput {
  kind: MediaPreviewKind;
  loading: boolean;
  imageUrl: string | null | undefined;
}

export interface MediaPreviewState {
  status: MediaPreviewStatus;
  title: string | null;
  description: string | null;
}

export interface MediaGenerationSummary {
  pendingAssetCount: number;
  title: string;
  description: string;
}

const EMPTY_PREVIEW_COPY: Record<MediaPreviewKind, Pick<MediaPreviewState, 'title' | 'description'>> = {
  cover: {
    title: 'Cover not generated yet',
    description: 'Use the media prompt on the left to create a calm, publication-grade cover.',
  },
  inline: {
    title: 'Inline visual not generated',
    description: 'Keep this image realistic, restrained, and suitable for an editorial article.',
  },
};

const LOADING_PREVIEW_COPY: Record<MediaPreviewKind, Pick<MediaPreviewState, 'title' | 'description'>> = {
  cover: {
    title: 'Cover is generating',
    description: 'This runs automatically in the background. The preview will appear here as soon as it is ready.',
  },
  inline: {
    title: 'Inline visual is generating',
    description: 'This image is being prepared automatically. The preview will appear here as soon as it is ready.',
  },
};

export function resolveMediaPreviewState(input: ResolveMediaPreviewStateInput): MediaPreviewState {
  if (String(input.imageUrl || '').trim()) {
    return {
      status: 'ready',
      title: null,
      description: null,
    };
  }

  if (input.loading) {
    return {
      status: 'loading',
      ...LOADING_PREVIEW_COPY[input.kind],
    };
  }

  return {
    status: 'empty',
    ...EMPTY_PREVIEW_COPY[input.kind],
  };
}

export function buildMediaGenerationSummary(input: {
  coverLoading: boolean;
  inlineLoadingCount: number;
}): MediaGenerationSummary | null {
  const pendingAssetCount = (input.coverLoading ? 1 : 0) + Math.max(0, input.inlineLoadingCount);

  if (pendingAssetCount === 0) {
    return null;
  }

  return {
    pendingAssetCount,
    title: 'Visuals are generating automatically',
    description: `${pendingAssetCount} ${pendingAssetCount === 1 ? 'asset is' : 'assets are'} still being prepared in the background. You can keep editing while previews continue to fill in.`,
  };
}
