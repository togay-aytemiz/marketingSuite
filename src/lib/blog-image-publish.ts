import type { BlogInlineImagePlan } from './blog-image-slots';
import {
  convertBlogPublishMediaToWebp,
  type BlogImageDataUrlConverter,
} from './blog-media-webp';

export interface BlogImagesForPublishInput {
  trCoverImageDataUrl?: string;
  enCoverImageDataUrl?: string;
  inlineImages: BlogInlineImagePlan[];
}

export async function prepareBlogImagesForPublish(
  input: BlogImagesForPublishInput,
  convert: BlogImageDataUrlConverter
) {
  const prepared = await convertBlogPublishMediaToWebp(
    {
      coverImageDataUrl: input.trCoverImageDataUrl,
      coverImageDataUrlEN: input.enCoverImageDataUrl,
      inlineImages: input.inlineImages || [],
    },
    convert
  );

  return {
    trCoverImageDataUrl: prepared.coverImageDataUrl,
    enCoverImageDataUrl: prepared.coverImageDataUrlEN,
    inlineImages: prepared.inlineImages,
  };
}
