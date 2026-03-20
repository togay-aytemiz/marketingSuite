export interface SanityPost {
  _id: string;
  title: string;
  slug: { current: string };
  excerpt?: string;
  language?: string;
  translationKey?: string;
  bodyMarkdown?: string;
  publishedAt?: string;
  updatedAt?: string;
  category?: {
    _id?: string;
    title?: string;
    slug?: { current: string };
  };
}

export interface SanityCategory {
  _id: string;
  title: string;
  description?: string;
  slug: { current: string };
}

export interface PublishData {
  title: string;
  content: string;
  description?: string;
  slug?: string;
  coverAltText?: string;
  coverImageDataUrl?: string;
  coverImagePrompt?: string;
  inlineImages?: Array<{
    prompt: string;
    dataUrl?: string;
  }>;
}

export interface PublishToSanityResponse {
  success: boolean;
  translationKey: string;
  ids?: string[];
  siteRefresh?: {
    attempted: boolean;
    succeeded: boolean;
    projectPath: string | null;
    message: string;
  };
}

async function readApiError(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parse failures and fall back to status text.
  }

  return response.statusText || 'Request failed.';
}

export const fetchSanityCategories = async (language: 'tr' | 'en' = 'tr'): Promise<SanityCategory[]> => {
  try {
    const response = await fetch(`/api/sanity/categories?language=${language}`);
    if (!response.ok) throw new Error(await readApiError(response));
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching Sanity categories:', error);
    return [];
  }
};

export const fetchSanityPosts = async (): Promise<SanityPost[]> => {
  try {
    const response = await fetch('/api/sanity/posts');
    if (!response.ok) throw new Error(await readApiError(response));
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching Sanity posts:', error);
    return [];
  }
};

export const publishToSanity = async (
  data: {
    translationKey?: string;
    categoryId?: string | null;
    tr: PublishData;
    en?: PublishData;
  }
): Promise<PublishToSanityResponse | null> => {
  try {
    const payload: Record<string, unknown> = {
      translationKey: data.translationKey,
      categoryId: data.categoryId || null,
      tr: {
        title: data.tr.title,
        slug: data.tr.slug || data.tr.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        description: data.tr.description || '',
        content: data.tr.content,
        coverAltText: data.tr.coverAltText || '',
        coverImageDataUrl: data.tr.coverImageDataUrl || '',
        coverImagePrompt: data.tr.coverImagePrompt || '',
        inlineImages: Array.isArray(data.tr.inlineImages) ? data.tr.inlineImages : [],
      },
    };

    if (data.en) {
      payload.en = {
        title: data.en.title,
        slug: data.en.slug || data.en.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        description: data.en.description || '',
        content: data.en.content,
        coverAltText: data.en.coverAltText || '',
        coverImageDataUrl: data.en.coverImageDataUrl || '',
        coverImagePrompt: data.en.coverImagePrompt || '',
        inlineImages: Array.isArray(data.en.inlineImages) ? data.en.inlineImages : [],
      };
    }

    const response = await fetch('/api/sanity/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    return (await response.json()) as PublishToSanityResponse;
  } catch (error) {
    console.error('Error publishing to Sanity:', error);
    return null;
  }
};
