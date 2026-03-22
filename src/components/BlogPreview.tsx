import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { Settings, PenTool, Loader2, Copy, Check, BarChart3, AlertCircle, Image as ImageIcon, Sparkles, Wand2, Send, Download, RefreshCw, Link as LinkIcon, UploadCloud, Share2, Twitter, Linkedin, Database } from 'lucide-react';
import { generateBlogPost, analyzeSeoForBlog, generateBlogImage, editBlogPost, addInternalLinks, generateSocialPosts } from '../services/gemini';
import { fetchSanityCategories, fetchSanityPosts, publishToSanity } from '../services/sanity';
import type { IntegrationStatus } from '../services/integrations';
import Markdown from 'react-markdown';
import {
  extractBlogImageSlotIds,
  getBlogInlineImageKey,
  normalizeBlogImageSlotId,
  type BlogInlineImagePlan,
} from '../lib/blog-image-slots';
import {
  buildArticlePreviewMarkdown,
  buildInlineImagePlacementSummaries,
  cleanDraftMarkdownArtifacts,
  migrateLegacyImagePromptsToSlots,
  normalizeEditorialMarkdown,
} from '../lib/blog-draft-media';
import { finalizeCoverImagePromptText, finalizeInlineImagePromptText } from '../lib/editorial-cover-style';
import { buildPublishReadiness, extractMarkdownLinkCount } from '../lib/blog-publish-readiness';
import { ensureFinalCallToAction } from '../lib/blog-call-to-action';
import { resolveDraftCategory } from '../lib/blog-category-resolution';
import { buildSanityPublishMessage } from '../lib/blog-publish-feedback';

interface BlogPreviewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  triggerGenerate: number;
  integrationStatus: IntegrationStatus;
}

const MEDIA_POLICY_BADGES = ['No text', 'No logo', 'No UI', 'Minimal editorial'];

function shouldCompactGeneratedPrompt(prompt: string | null | undefined) {
  const normalized = String(prompt || '').trim();
  if (!normalized) {
    return true;
  }

  return (
    normalized.length > 180 ||
    /premium editorial b2b cover about|publication-grade editorial photograph showing|clean editorial explainer card about|dark graphite to deep navy|default to professional editorial photography/i.test(normalized)
  );
}

function normalizeCoverPromptForState(prompt: string | null | undefined) {
  const normalized = String(prompt || '').trim();
  if (!normalized) {
    return '';
  }

  return shouldCompactGeneratedPrompt(normalized)
    ? finalizeCoverImagePromptText(normalized)
    : normalized;
}

function normalizeInlinePromptForState(prompt: string | null | undefined) {
  const normalized = String(prompt || '').trim();
  if (!normalized) {
    return '';
  }

  return shouldCompactGeneratedPrompt(normalized)
    ? finalizeInlineImagePromptText(normalized)
    : normalized;
}

function collectInlineImageReferences(contents: Array<string | null | undefined>) {
  const slotIds = new Set<string>();

  for (const content of contents) {
    for (const slotId of extractBlogImageSlotIds(content)) {
      slotIds.add(slotId);
    }
  }

  return {
    slotIds,
  };
}

function pruneUnusedInlineImages(content: string | null | undefined, inlineImages: BlogInlineImagePlan[]) {
  return pruneUnusedInlineImagesForDraft([content], inlineImages);
}

function pruneUnusedInlineImagesForDraft(
  contents: Array<string | null | undefined>,
  inlineImages: BlogInlineImagePlan[]
) {
  const { slotIds } = collectInlineImageReferences(contents);

  return inlineImages.filter((image) => {
    const slotId = normalizeBlogImageSlotId(image.slotId);
    return Boolean(slotId && slotIds.has(slotId));
  });
}

function ensureInlineImagePlansForDraft(
  contents: Array<string | null | undefined>,
  inlineImages: BlogInlineImagePlan[]
) {
  const { slotIds } = collectInlineImageReferences(contents);
  const nextImages = pruneUnusedInlineImagesForDraft(contents, inlineImages);
  const existingKeys = new Set(nextImages.map((image) => getBlogInlineImageKey(image)).filter(Boolean));

  for (const slotId of slotIds) {
    if (existingKeys.has(slotId)) {
      continue;
    }

    nextImages.push({
      slotId,
      prompt: finalizeInlineImagePromptText(`Professional editorial image for ${slotId}`),
      altText: 'Blog image',
    });
    existingKeys.add(slotId);
  }

  return nextImages.map((image) => ({
    ...image,
    prompt: normalizeInlinePromptForState(image.prompt) || finalizeInlineImagePromptText(`Professional editorial image for ${image.slotId}`),
  }));
}

function normalizeDraftBundle(
  blogContent: string | null | undefined,
  blogContentEN: string | null | undefined,
  inlineImages: BlogInlineImagePlan[]
) {
  let nextInlineImages = inlineImages.map((image) => ({
    ...image,
    prompt: normalizeInlinePromptForState(image.prompt) || image.prompt,
  }));

  let normalizedTR = blogContent || null;
  if (normalizedTR) {
    const migrated = migrateLegacyImagePromptsToSlots(normalizedTR, nextInlineImages);
    normalizedTR = migrated.content;
    nextInlineImages = migrated.inlineImages;
  }

  let normalizedEN = blogContentEN || null;
  if (normalizedEN) {
    const migrated = migrateLegacyImagePromptsToSlots(normalizedEN, nextInlineImages);
    normalizedEN = migrated.content;
    nextInlineImages = migrated.inlineImages;
  }

  return {
    blogContent: normalizedTR ? cleanDraftMarkdownArtifacts(normalizeEditorialMarkdown(normalizedTR)) : null,
    blogContentEN: normalizedEN ? cleanDraftMarkdownArtifacts(normalizeEditorialMarkdown(normalizedEN)) : null,
    blogInlineImages: ensureInlineImagePlansForDraft([normalizedTR, normalizedEN], nextInlineImages),
  };
}

export const BlogPreview: React.FC<BlogPreviewProps> = ({ state, setState, isGenerating, setIsGenerating, triggerGenerate, integrationStatus }) => {
  const [isAnalyzingSeo, setIsAnalyzingSeo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blogImages, setBlogImages] = useState<Record<string, { loading: boolean, url: string | null }>>({});
  const [editInstruction, setEditInstruction] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  const [socialPosts, setSocialPosts] = useState<{ twitter: string; linkedin: string } | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [knownSanityCategories, setKnownSanityCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [knownRecentPosts, setKnownRecentPosts] = useState<Array<{
    title: string;
    excerpt?: string;
    category?: string;
    categoryId?: string;
    language?: string;
    publishedAt?: string;
  }>>([]);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [viewLanguage, setViewLanguage] = useState<'TR' | 'EN'>('TR');
  const [workflowStage, setWorkflowStage] = useState<'draft' | 'media' | 'publish'>('draft');
  const [sanityMessage, setSanityMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const openAiConfigured = integrationStatus.openai.configured;
  const geminiConfigured = integrationStatus.gemini.configured;
  const sanityConfigured = integrationStatus.sanity.configured;

  const updateInlineImage = (imageKey: string, patch: Partial<BlogInlineImagePlan>) => {
    setState((prev) => ({
      ...prev,
      blogInlineImages: prev.blogInlineImages.map((image) => {
        if (getBlogInlineImageKey(image) !== imageKey) {
          return image;
        }

        return {
          ...image,
          ...patch,
          prompt: typeof patch.prompt === 'string' ? patch.prompt : image.prompt,
        };
      }),
    }));
  };

  const resolveDraftCategoryWithFallback = (
    rawCategoryId: string | null | undefined,
    explicitCategory?: AppState['blogCategory'] | null,
    categories: Array<{ id: string; name: string }> = knownSanityCategories,
    recentPosts: Array<{ title: string; excerpt?: string; category?: string; categoryId?: string; publishedAt?: string }> = knownRecentPosts
  ) => {
    if (explicitCategory?.id && explicitCategory?.name) {
      return explicitCategory;
    }

    return (
      resolveDraftCategory({
        rawCategoryId: rawCategoryId || explicitCategory?.id || state.blogCategory?.id || null,
        sanityCategories: categories,
        recentPosts,
      }) ||
      explicitCategory ||
      state.blogCategory ||
      null
    );
  };

  const autoApplyInternalLinks = async (
    content: string | null | undefined,
    language: 'TR' | 'EN',
    sanityPosts: Array<{
      title: string;
      slug: string;
      excerpt?: string;
      category?: string;
      language?: string;
      publishedAt?: string;
    }>
  ) => {
    if (!content || !state.autoInternalLinks || !sanityConfigured || sanityPosts.length === 0) {
      return content || null;
    }

    const normalizedLanguage = language === 'EN' ? 'en' : 'tr';
    const languageFilteredPosts = sanityPosts.filter((post) => {
      const postLanguage = String(post.language || '').toLowerCase();
      return !postLanguage || postLanguage === normalizedLanguage;
    });

    const linkedContent = await addInternalLinks(
      content,
      languageFilteredPosts,
      language,
      state.productName,
      state.featureName
    );
    return linkedContent || content;
  };

  useEffect(() => {
    if (triggerGenerate > 0) {
      handleGenerate();
    }
  }, [triggerGenerate]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateEditorialContext() {
      if (!sanityConfigured || knownSanityCategories.length > 0) {
        return;
      }

      const preferredLanguage = state.language === 'EN' ? 'en' : 'tr';
      const [categories, posts] = await Promise.all([
        fetchSanityCategories(preferredLanguage),
        fetchSanityPosts(),
      ]);

      if (cancelled) {
        return;
      }

      setKnownSanityCategories(categories.map((category) => ({ id: category._id, name: category.title })));
      setKnownRecentPosts(posts.map((post) => ({
        title: post.title,
        excerpt: post.excerpt,
        category: post.category?.title,
        categoryId: post.category?._id,
        language: post.language,
        publishedAt: post.publishedAt || post.updatedAt,
      })));
    }

    void hydrateEditorialContext();

    return () => {
      cancelled = true;
    };
  }, [sanityConfigured, state.language, knownSanityCategories.length]);

  useEffect(() => {
    if (!state.blogContent && !state.blogContentEN && state.blogInlineImages.length === 0) {
      return;
    }

    const normalizedDraft = normalizeDraftBundle(
      state.blogContent,
      state.blogContentEN,
      state.blogInlineImages
    );
    const nextTrContent = normalizedDraft.blogContent
      ? ensureFinalCallToAction(normalizedDraft.blogContent, 'TR', state.productName, state.featureName)
      : normalizedDraft.blogContent;
    const nextEnContent = normalizedDraft.blogContentEN
      ? ensureFinalCallToAction(normalizedDraft.blogContentEN, 'EN', state.productName, state.featureName)
      : normalizedDraft.blogContentEN;
    const imagesChanged = JSON.stringify(normalizedDraft.blogInlineImages) !== JSON.stringify(state.blogInlineImages);

    if (
      nextTrContent === state.blogContent &&
      nextEnContent === state.blogContentEN &&
      !imagesChanged
    ) {
      return;
    }

    setState((prev) => ({
      ...prev,
      blogContent: nextTrContent,
      blogContentEN: nextEnContent,
      blogInlineImages: normalizedDraft.blogInlineImages,
    }));
  }, [state.blogContent, state.blogContentEN, state.blogInlineImages, state.productName, state.featureName, setState]);

  useEffect(() => {
    if (!sanityConfigured || (!state.blogContent && !state.blogContentEN)) {
      return;
    }

    const resolvedCategory = resolveDraftCategoryWithFallback(
      state.blogCategory?.id || null,
      state.blogCategory,
      knownSanityCategories,
      knownRecentPosts
    );

    if (!resolvedCategory) {
      return;
    }

    if (
      state.blogCategory?.id === resolvedCategory.id &&
      state.blogCategory?.name === resolvedCategory.name &&
      state.blogCategory?.resolvedBy === resolvedCategory.resolvedBy &&
      state.blogCategory?.confidence === resolvedCategory.confidence &&
      state.blogCategory?.fallbackReason === resolvedCategory.fallbackReason
    ) {
      return;
    }

    setState((prev) => ({
      ...prev,
      blogCategory: resolvedCategory,
    }));
  }, [
    sanityConfigured,
    knownSanityCategories,
    knownRecentPosts,
    state.blogCategory,
    state.blogContent,
    state.blogContentEN,
    setState,
  ]);

  const handleGenerateCover = async () => {
    const prompt = viewLanguage === 'EN' ? state.blogCoverPromptEN : state.blogCoverPrompt;
    if (!prompt) return;
    setIsGeneratingCover(true);
    const promptSeed = normalizeCoverPromptForState(prompt);
    const finalizedPrompt = finalizeCoverImagePromptText(promptSeed);
    const url = await generateBlogImage(finalizedPrompt, true);
    if (url) {
      setState(prev => ({
        ...prev,
        ...(viewLanguage === 'EN'
          ? { blogCoverUrlEN: url, blogCoverPromptEN: promptSeed || finalizedPrompt }
          : { blogCoverUrl: url, blogCoverPrompt: promptSeed || finalizedPrompt })
      }));
    }
    setIsGeneratingCover(false);
  };

  const handleGenerateImage = async (image: BlogInlineImagePlan) => {
    const key = getBlogInlineImageKey(image);
    if (!key) return;
    setBlogImages(prev => ({ ...prev, [key]: { loading: true, url: null } }));
    const promptSeed = normalizeInlinePromptForState(image.prompt);
    const finalizedPrompt = finalizeInlineImagePromptText(promptSeed);
    const imageUrl = await generateBlogImage(finalizedPrompt);
    if (imageUrl) {
      setState((prev) => {
        const exists = prev.blogInlineImages.some((existing) => getBlogInlineImageKey(existing) === key);
        if (exists) {
          return {
            ...prev,
            blogInlineImages: prev.blogInlineImages.map((existing) =>
              getBlogInlineImageKey(existing) === key
                ? { ...existing, prompt: promptSeed || finalizedPrompt, dataUrl: imageUrl }
                : existing
            ),
          };
        }

        return {
          ...prev,
          blogInlineImages: [
            ...prev.blogInlineImages,
            {
              ...image,
              slotId: normalizeBlogImageSlotId(image.slotId) || image.slotId,
              prompt: promptSeed || finalizedPrompt,
              dataUrl: imageUrl,
            },
          ],
        };
      });
    }
    setBlogImages(prev => ({ ...prev, [key]: { loading: false, url: imageUrl } }));
  };

  const generateInlineImagesSequentially = async (images: BlogInlineImagePlan[]) => {
    for (const image of images) {
      const key = getBlogInlineImageKey(image);
      if (!key) {
        continue;
      }
      let shouldGenerate = true;
      setBlogImages((prev) => {
        const existingUrl = prev[key]?.url || image.dataUrl;
        if (existingUrl) {
          shouldGenerate = false;
          return prev;
        }

        return {
          ...prev,
          [key]: {
            loading: true,
            url: null,
          },
        };
      });

      if (!shouldGenerate) {
        continue;
      }

      const promptSeed = normalizeInlinePromptForState(image.prompt);
      const finalizedPrompt = finalizeInlineImagePromptText(promptSeed);
      const imageUrl = await generateBlogImage(finalizedPrompt);
      if (imageUrl) {
        setState((prev) => ({
          ...prev,
          blogInlineImages: prev.blogInlineImages.map((existing) =>
            getBlogInlineImageKey(existing) === key
              ? { ...existing, prompt: promptSeed || finalizedPrompt, dataUrl: imageUrl }
              : existing
          ),
        }));
      }
      setBlogImages((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          url: imageUrl || prev[key]?.url || null,
        },
      }));
    }
  };

  const autoGenerateBlogImages = async (response: {
    coverImagePrompt?: string;
    coverImagePromptEN?: string;
    inlineImages?: BlogInlineImagePlan[];
  }) => {
    const generatedCoverTR = response.coverImagePrompt
      ? await generateBlogImage(response.coverImagePrompt, true)
      : null;

    let generatedCoverEN: string | null = null;
    if (response.coverImagePromptEN) {
      if (
        response.coverImagePrompt &&
        response.coverImagePromptEN.trim() === response.coverImagePrompt.trim() &&
        generatedCoverTR
      ) {
        generatedCoverEN = generatedCoverTR;
      } else {
        generatedCoverEN = await generateBlogImage(response.coverImagePromptEN, true);
      }
    }

    setState((prev) => ({
      ...prev,
      blogCoverUrl: generatedCoverTR || prev.blogCoverUrl,
      blogCoverUrlEN: generatedCoverEN || prev.blogCoverUrlEN || generatedCoverTR || prev.blogCoverUrl,
    }));

    await generateInlineImagesSequentially(response.inlineImages || []);
  };

  const handleGenerate = async () => {
    if (!openAiConfigured) {
      setSanityMessage({ type: 'error', text: 'AI kapali. OPENAI_API_KEY ekledikten sonra blog uretebilirsin.' });
      return;
    }

    setIsGenerating(true);
    setBlogImages({});
    setState(prev => ({
      ...prev,
      blogContent: null,
      blogContentEN: null,
      seoAnalysis: null,
      seoAnalysisEN: null,
      blogInlineImages: [],
    }));

    let sanityPostsForPrompt: Array<{
      title: string;
      slug: string;
      excerpt?: string;
      category?: string;
      categoryId?: string;
      language?: string;
      publishedAt?: string;
    }> = [];
    let sanityCategoriesForPrompt: Array<{ id: string; name: string }> = [];
    if (sanityConfigured) {
      const preferredLanguage = state.language === 'EN' ? 'en' : 'tr';
      const [posts, categories] = await Promise.all([
        fetchSanityPosts(),
        fetchSanityCategories(preferredLanguage),
      ]);

      sanityPostsForPrompt = posts.map((post) => ({
        title: post.title,
        slug: post.slug.current,
        excerpt: post.excerpt,
        category: post.category?.title,
        categoryId: post.category?._id,
        language: post.language,
        publishedAt: post.publishedAt || post.updatedAt,
      }));
      sanityCategoriesForPrompt = categories.map((category) => ({
        id: category._id,
        name: category.title,
      }));
      setKnownRecentPosts(sanityPostsForPrompt);
      setKnownSanityCategories(sanityCategoriesForPrompt);
    }

    const response = await generateBlogPost(
      state.productName,
      state.featureName,
      state.targetAudience,
      state.description,
      state.blogTopic,
      state.blogKeywords,
      state.blogTone,
      state.blogLength,
      state.language,
      state.blogImageStyle,
      sanityPostsForPrompt,
      sanityCategoriesForPrompt
    );
    
    if (response) {
      const isEnglishOnly = state.language === 'EN';
      const primaryLanguage = isEnglishOnly ? 'EN' : 'TR';
      setViewLanguage(state.language === 'EN' ? 'EN' : 'TR');
      const linkedPrimaryContent = await autoApplyInternalLinks(response.content, primaryLanguage, sanityPostsForPrompt);
      const linkedContentEN = !isEnglishOnly && response.contentEN
        ? await autoApplyInternalLinks(response.contentEN, 'EN', sanityPostsForPrompt)
        : null;
      const primaryContentWithCta = ensureFinalCallToAction(
        linkedPrimaryContent || response.content,
        primaryLanguage,
        state.productName,
        state.featureName
      );
      const secondaryContentWithCta = linkedContentEN
        ? ensureFinalCallToAction(linkedContentEN, 'EN', state.productName, state.featureName)
        : null;
      const normalizedDraft = normalizeDraftBundle(
        isEnglishOnly ? null : primaryContentWithCta,
        isEnglishOnly ? primaryContentWithCta : secondaryContentWithCta,
        response.inlineImages || []
      );
      const resolvedCategory = resolveDraftCategoryWithFallback(
        response.categoryId || response.category?.id || null,
        response.category || null,
        sanityCategoriesForPrompt,
        sanityPostsForPrompt
      );

      setState(prev => ({ 
        ...prev, 
        blogContent: isEnglishOnly ? null : normalizedDraft.blogContent,
        blogTitle: isEnglishOnly ? null : response.title,
        blogDescription: isEnglishOnly ? null : response.description,
        blogSlug: isEnglishOnly ? null : response.slug,
        blogCoverPrompt: isEnglishOnly ? null : normalizeCoverPromptForState(finalizeCoverImagePromptText(response.coverImagePrompt)),
        blogCoverAltText: isEnglishOnly ? null : response.coverAltText,
        blogCoverUrl: isEnglishOnly ? prev.blogCoverUrl : null,
        blogContentEN: isEnglishOnly ? normalizedDraft.blogContentEN : normalizedDraft.blogContentEN,
        blogTitleEN: isEnglishOnly ? response.title : response.titleEN || null,
        blogDescriptionEN: isEnglishOnly ? response.description : response.descriptionEN || null,
        blogSlugEN: isEnglishOnly ? response.slug : response.slugEN || null,
        blogCoverPromptEN: isEnglishOnly
          ? normalizeCoverPromptForState(finalizeCoverImagePromptText(response.coverImagePrompt))
          : response.coverImagePromptEN ? normalizeCoverPromptForState(finalizeCoverImagePromptText(response.coverImagePromptEN)) : null,
        blogCoverAltTextEN: isEnglishOnly ? response.coverAltText : response.coverAltTextEN || null,
        blogCoverUrlEN: null,
        blogInlineImages: normalizedDraft.blogInlineImages,
        blogCategory: resolvedCategory
      }));
      setWorkflowStage('draft');
      setSocialPosts(null);
      
      // Run SEO Analysis
      setIsAnalyzingSeo(true);
      if (!isEnglishOnly) {
        const analysis = await analyzeSeoForBlog(
          response.title,
          response.description,
          buildArticlePreviewMarkdown(normalizedDraft.blogContent || response.content),
          state.blogKeywords
        );
        if (analysis) {
          setState(prev => ({ ...prev, seoAnalysis: analysis }));
        }
      }

      if (isEnglishOnly || linkedContentEN || response.contentEN) {
        const analysisEN = await analyzeSeoForBlog(
          isEnglishOnly ? response.title : response.titleEN || '',
          isEnglishOnly ? response.description : response.descriptionEN || '',
          buildArticlePreviewMarkdown(normalizedDraft.blogContentEN || response.contentEN || response.content || ''),
          state.blogKeywords
        );
        if (analysisEN) {
          setState(prev => ({ ...prev, seoAnalysisEN: analysisEN }));
        }
      }
      setIsAnalyzingSeo(false);

      if (state.autoInternalLinks && sanityConfigured && sanityPostsForPrompt.length > 0) {
        setSanityMessage({ type: 'success', text: 'Ic linkler otomatik olarak eklendi.' });
        setTimeout(() => setSanityMessage(null), 3000);
      }

      if (geminiConfigured) {
        void autoGenerateBlogImages({
          coverImagePrompt: isEnglishOnly ? undefined : response.coverImagePrompt,
          coverImagePromptEN: isEnglishOnly ? response.coverImagePrompt : response.coverImagePromptEN || undefined,
          inlineImages: normalizedDraft.blogInlineImages,
        });
      }
    }
    setIsGenerating(false);
  };

  const handleCopy = () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (currentContent) {
      navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (currentContent) {
      const blob = new Blob([currentContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = viewLanguage === 'EN' ? state.blogTitleEN : state.blogTitle;
      const topic = state.blogTopic || 'blog-post';
      const fileName = title ? title.replace(/[^a-z0-9]/gi, '-').toLowerCase() : topic.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      a.download = `${fileName}-${viewLanguage.toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleGenerateSocial = async () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!currentContent || !openAiConfigured) return;
    setIsGeneratingSocial(true);
    const posts = await generateSocialPosts(buildArticlePreviewMarkdown(currentContent), viewLanguage);
    if (posts) {
      setSocialPosts(posts);
    }
    setIsGeneratingSocial(false);
  };

  const handleEdit = async () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!editInstruction.trim() || !currentContent || !openAiConfigured) return;
    setIsEditing(true);

    const updatedContent = await editBlogPost(
      currentContent,
      editInstruction,
      state.productName,
      state.featureName,
      state.targetAudience,
      state.description,
      viewLanguage, // Pass the specific language being edited
      undefined
    );

    if (updatedContent) {
      const normalizedDraft = normalizeDraftBundle(
        viewLanguage === 'EN' ? state.blogContent : updatedContent,
        viewLanguage === 'EN' ? updatedContent : state.blogContentEN,
        state.blogInlineImages
      );
      const nextTrContent =
        viewLanguage === 'EN'
          ? normalizedDraft.blogContent
          : ensureFinalCallToAction(normalizedDraft.blogContent, 'TR', state.productName, state.featureName);
      const nextEnContent =
        viewLanguage === 'EN'
          ? ensureFinalCallToAction(normalizedDraft.blogContentEN, 'EN', state.productName, state.featureName)
          : normalizedDraft.blogContentEN;
      setState(prev => ({
        ...prev,
        blogContent:
          viewLanguage === 'EN' && state.language === 'EN'
            ? prev.blogContent
            : nextTrContent,
        blogContentEN: nextEnContent,
        blogInlineImages: normalizedDraft.blogInlineImages,
        blogCategory: prev.blogCategory || resolveDraftCategoryWithFallback(null),
      }));
      setEditInstruction('');
      
      // Re-run SEO Analysis
      setIsAnalyzingSeo(true);
      const analysis = await analyzeSeoForBlog(
        viewLanguage === 'EN' ? state.blogTitleEN || '' : state.blogTitle || '',
        viewLanguage === 'EN' ? state.blogDescriptionEN || '' : state.blogDescription || '',
        buildArticlePreviewMarkdown(viewLanguage === 'EN' ? normalizedDraft.blogContentEN : normalizedDraft.blogContent), 
        state.blogKeywords
      );
      if (analysis) {
        setState(prev => ({
          ...prev,
          ...(viewLanguage === 'EN' ? { seoAnalysisEN: analysis } : { seoAnalysis: analysis })
        }));
      }
      setIsAnalyzingSeo(false);
    }
    setIsEditing(false);
  };

  const handlePublishToSanity = async () => {
    const hasTurkishDraft = Boolean(state.blogContent);
    const hasEnglishDraft = Boolean(state.blogContentEN);
    if (!hasTurkishDraft && !hasEnglishDraft) return;
    if (!sanityConfigured) {
      setSanityMessage({ type: 'error', text: 'Sanity bagli degil. .env.local icine SANITY_PROJECT_ID ve SANITY_TOKEN ekle.' });
      return;
    }

    setIsPublishing(true);
    setSanityMessage(null);
    
    // Extract title from H1 or use topic
    const titleMatch = state.blogContent?.match(/^#\s+(.*)/m);
    const title = state.blogTitle || (titleMatch ? titleMatch[1] : state.blogTitleEN || state.blogTopic || 'Untitled Blog Post');

    const translationKeySeed =
      state.blogSlug ||
      state.blogSlugEN ||
      title ||
      state.blogTopic ||
      `writer-${Date.now()}`;
    const translationKey = translationKeySeed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const inlineImages = state.blogInlineImages.map((image) => ({
      ...image,
      dataUrl: blogImages[getBlogInlineImageKey(image)]?.url || image.dataUrl || undefined,
    }));

    const trData = state.blogContent ? {
      title,
      content: ensureFinalCallToAction(state.blogContent, 'TR', state.productName, state.featureName),
      description: state.blogDescription || '',
      slug: state.blogSlug || undefined,
      coverAltText: state.blogCoverAltText || undefined,
      coverImageDataUrl: state.blogCoverUrl || undefined,
      coverImagePrompt: state.blogCoverPrompt || undefined,
      inlineImages,
    } : undefined;

    let enData = undefined;
    if (state.blogContentEN) {
      const titleMatchEN = state.blogContentEN.match(/^#\s+(.*)/m);
      const titleEN = state.blogTitleEN || (titleMatchEN ? titleMatchEN[1] : state.blogTopic || 'Untitled Blog Post');
      enData = {
        title: titleEN,
        content: ensureFinalCallToAction(state.blogContentEN, 'EN', state.productName, state.featureName),
        description: state.blogDescriptionEN || '',
        slug: state.blogSlugEN || undefined,
        coverAltText: state.blogCoverAltTextEN || undefined,
        coverImageDataUrl: state.blogCoverUrlEN || state.blogCoverUrl || undefined,
        coverImagePrompt: state.blogCoverPromptEN || state.blogCoverPrompt || undefined,
        inlineImages,
      };
    }

    try {
      const result = await publishToSanity({
        translationKey,
        categoryId: effectiveCategory?.id ? String(effectiveCategory.id) : null,
        tr: trData,
        en: enData,
      });
      
      if (result.success) {
        setSanityMessage({ type: 'success', text: buildSanityPublishMessage(result.siteRefresh) });
      } else {
        setSanityMessage({ type: 'error', text: 'Sanity publish basarisiz.' });
      }
    } catch (error) {
      setSanityMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Sanity publish basarisiz.',
      });
    } finally {
      setIsPublishing(false);
      setTimeout(() => setSanityMessage(null), 4000);
    }
  };

  const handleAddInternalLinks = async () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!currentContent) return;
    if (!sanityConfigured) {
      setSanityMessage({ type: 'error', text: 'Sanity bagli degil. Internal link eklemek icin once Sanity ayarlarini tamamla.' });
      return;
    }

    setIsLinking(true);
    setSanityMessage(null);

    const posts = await fetchSanityPosts();
    
    if (posts.length === 0) {
      setSanityMessage({ type: 'error', text: 'No posts found in Sanity to link to.' });
      setIsLinking(false);
      setTimeout(() => setSanityMessage(null), 3000);
      return;
    }

    const updatedContent = await addInternalLinks(
      currentContent,
      posts.map((p) => ({
        title: p.title,
        slug: p.slug.current,
        excerpt: p.excerpt,
        category: p.category?.title,
        language: p.language,
        publishedAt: p.publishedAt || p.updatedAt,
      })).filter((post) => {
        const postLanguage = String(post.language || '').toLowerCase();
        const targetLanguage = viewLanguage === 'EN' ? 'en' : 'tr';
        return !postLanguage || postLanguage === targetLanguage;
      }),
      viewLanguage,
      state.productName,
      state.featureName
    );
    
    if (updatedContent) {
      const normalizedDraft = normalizeDraftBundle(
        viewLanguage === 'EN' ? state.blogContent : updatedContent,
        viewLanguage === 'EN' ? updatedContent : state.blogContentEN,
        state.blogInlineImages
      );
      const nextTrContent =
        viewLanguage === 'EN'
          ? normalizedDraft.blogContent
          : ensureFinalCallToAction(normalizedDraft.blogContent, 'TR', state.productName, state.featureName);
      const nextEnContent =
        viewLanguage === 'EN'
          ? ensureFinalCallToAction(normalizedDraft.blogContentEN, 'EN', state.productName, state.featureName)
          : normalizedDraft.blogContentEN;
      setState(prev => ({
        ...prev,
        blogContent:
          viewLanguage === 'EN' && state.language === 'EN'
            ? prev.blogContent
            : nextTrContent,
        blogContentEN: nextEnContent,
        blogInlineImages: normalizedDraft.blogInlineImages,
        blogCategory: prev.blogCategory || resolveDraftCategoryWithFallback(null),
      }));
      setSanityMessage({ type: 'success', text: 'Internal links added successfully!' });
      
      // Re-run SEO Analysis
      setIsAnalyzingSeo(true);
      const analysis = await analyzeSeoForBlog(
        viewLanguage === 'EN' ? state.blogTitleEN || '' : state.blogTitle || '',
        viewLanguage === 'EN' ? state.blogDescriptionEN || '' : state.blogDescription || '',
        buildArticlePreviewMarkdown(viewLanguage === 'EN' ? normalizedDraft.blogContentEN : normalizedDraft.blogContent), 
        state.blogKeywords
      );
      if (analysis) {
        setState(prev => ({
          ...prev,
          ...(viewLanguage === 'EN' ? { seoAnalysisEN: analysis } : { seoAnalysis: analysis })
        }));
      }
      setIsAnalyzingSeo(false);
    } else {
      setSanityMessage({ type: 'error', text: 'Failed to add internal links.' });
    }
    
    setIsLinking(false);
    setTimeout(() => setSanityMessage(null), 3000);
  };

  const renderArticleContent = () => {
    const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
    if (!currentContent) return null;
    let previewMarkdown = buildArticlePreviewMarkdown(currentContent);
    const currentHeadline = String(currentTitle || '').trim();
    if (currentHeadline) {
      const escapedHeadline = currentHeadline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      previewMarkdown = previewMarkdown.replace(
        new RegExp(`^#{1,3}\\s+${escapedHeadline}\\s*\\n+`, 'i'),
        ''
      );
    }
    return (
      <Markdown
        components={{
          img: () => null,
          pre: ({ children }) => <>{children}</>,
          code: ({ children }) => {
            const text = String(children).replace(/\n$/, '');
            const isBlock = text.includes('\n');

            return isBlock ? (
              <span className="block whitespace-pre-wrap break-words font-inherit text-inherit">{text}</span>
            ) : (
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.95em] text-zinc-700">{text}</code>
            );
          },
        }}
      >
        {previewMarkdown}
      </Markdown>
    );
  };

  const currentContent = viewLanguage === 'EN' ? state.blogContentEN : state.blogContent;
  const inlinePlacements = buildInlineImagePlacementSummaries(currentContent).map((placement) => ({
    ...placement,
    image:
      state.blogInlineImages.find((item) => normalizeBlogImageSlotId(item.slotId) === placement.slotId) || null,
  }));
  const currentTitle = viewLanguage === 'EN' ? state.blogTitleEN : state.blogTitle;
  const currentDescription = viewLanguage === 'EN' ? state.blogDescriptionEN : state.blogDescription;
  const currentSlug = viewLanguage === 'EN' ? state.blogSlugEN : state.blogSlug;
  const currentCoverPrompt = viewLanguage === 'EN' ? state.blogCoverPromptEN : state.blogCoverPrompt;
  const currentCoverAltText = viewLanguage === 'EN' ? state.blogCoverAltTextEN : state.blogCoverAltText;
  const currentCoverUrl = viewLanguage === 'EN' ? state.blogCoverUrlEN : state.blogCoverUrl;
  const effectiveCategory = state.blogCategory || resolveDraftCategoryWithFallback(null);
  const readyInlineImageCount = state.blogInlineImages.filter((image) => {
    const key = getBlogInlineImageKey(image);
    return Boolean((key ? blogImages[key]?.url : null) || image.dataUrl);
  }).length;
  const publishReadiness = buildPublishReadiness({
    language: state.language as 'TR' | 'EN' | 'BOTH',
    title: state.blogTitle,
    titleEN: state.blogTitleEN,
    description: state.blogDescription,
    descriptionEN: state.blogDescriptionEN,
    content: state.blogContent,
    contentEN: state.blogContentEN,
    category: effectiveCategory,
    coverReady: Boolean(state.blogCoverUrl),
    coverReadyEN: Boolean(state.blogCoverUrlEN || state.blogCoverUrl),
    inlineImageCount: state.blogInlineImages.length,
    inlineReadyCount: readyInlineImageCount,
    autoInternalLinks: state.autoInternalLinks,
    sanityConfigured,
  });
  const currentInternalLinkCount = extractMarkdownLinkCount(currentContent) || 0;
  const hasAnyDraftContent = Boolean(state.blogContent || state.blogContentEN);

  const advanceWorkflowStage = () => {
    if (workflowStage === 'draft') {
      setWorkflowStage('media');
      return;
    }

    if (workflowStage === 'media') {
      setWorkflowStage('publish');
      return;
    }

    void handlePublishToSanity();
  };

  const primaryStageActionLabel = workflowStage === 'draft'
    ? 'Continue to Media'
    : workflowStage === 'media'
      ? 'Continue to Publish Review'
      : isPublishing
        ? 'Publishing...'
        : 'Publish to Sanity';

  const primaryStageActionDisabled = workflowStage === 'publish'
    ? isPublishing || !sanityConfigured || !publishReadiness.canPublish
    : !hasAnyDraftContent;
  const currentSeoAnalysis = viewLanguage === 'EN' ? state.seoAnalysisEN : state.seoAnalysis;
  const contentSurfaceWidth = workflowStage === 'draft' ? 'max-w-[1180px]' : workflowStage === 'media' ? 'max-w-[1280px]' : 'max-w-[1240px]';
  const workflowStages = [
    { id: 'draft' as const, label: 'Article', description: 'Read the article as a finished publication draft.' },
    { id: 'media' as const, label: 'Media', description: 'Manage cover and inline visuals outside the article body.' },
    { id: 'publish' as const, label: 'Publish', description: 'Review metadata and send the final package to Sanity.' },
  ];
  const currentStageMeta = workflowStages.find((stage) => stage.id === workflowStage) || workflowStages[0];
  const categoryConfidenceTone =
    effectiveCategory?.confidence === 'high'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : effectiveCategory?.confidence === 'medium'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-zinc-600 bg-zinc-50 border-zinc-200';
  const categoryResolutionLabel = effectiveCategory?.resolvedBy
    ? effectiveCategory.resolvedBy.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Auto';
  const stageSecondaryDescription = workflowStage === 'draft'
    ? 'The article pane stays text-only. Cover and inline visuals are intentionally kept out of this reading experience.'
    : workflowStage === 'media'
      ? 'Every image is managed in its own card and mapped to Sanity slots only during publish.'
      : 'Use this stage to confirm metadata, category confidence, and publish blockers before sending to Sanity.';

  return (
      <div className="h-full flex flex-col bg-zinc-50">
      <div className={`flex-1 overflow-y-auto p-6 lg:p-8 ${!hasAnyDraftContent && !isGenerating ? 'flex items-center justify-center' : ''}`}>
        <div className={`mx-auto w-full ${hasAnyDraftContent ? contentSurfaceWidth : 'max-w-3xl'}`}>
          {!hasAnyDraftContent && !isGenerating ? (
            <div className="w-full h-full min-h-[500px] border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center bg-white shadow-sm">
              <div className="text-center max-w-sm px-6">
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                  <PenTool className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900 tracking-tight">No blog post generated</h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">Set a topic if you want, or leave it blank and generate a publish-ready draft.</p>
                {!openAiConfigured && (
                  <p className="text-xs text-amber-600 mt-3">Blog metin uretimi kapali. Lokal .env dosyana <code>OPENAI_API_KEY</code> ekle.</p>
                )}
                {openAiConfigured && !geminiConfigured && (
                  <p className="text-xs text-amber-600 mt-3">Metin uretimi acik. Gorseller icin <code>GEMINI_API_KEY</code> gerekli.</p>
                )}
              </div>
            </div>
          ) : isGenerating ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-sm font-medium text-zinc-900">Writing your blog post...</p>
              <p className="text-xs text-zinc-500 mt-1">This might take a few seconds.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="min-w-0">
                <div className="bg-white rounded-[28px] shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="px-6 lg:px-8 py-6 border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          Publish-Ready Draft
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
                          {currentTitle || state.blogTopic || 'Untitled Draft'}
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">
                          {currentStageMeta.description} {stageSecondaryDescription}
                        </p>
                        {sanityMessage && (
                          <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                            sanityMessage.type === 'success'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-red-200 bg-red-50 text-red-700'
                          }`}>
                            <AlertCircle className="h-3.5 w-3.5" />
                            {sanityMessage.text}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                        {state.language === 'BOTH' && (
                          <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100/70 p-1">
                            <button
                              onClick={() => setViewLanguage('TR')}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                viewLanguage === 'TR' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                              }`}
                            >
                              TR
                            </button>
                            <button
                              onClick={() => setViewLanguage('EN')}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                viewLanguage === 'EN' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                              }`}
                            >
                              EN
                            </button>
                          </div>
                        )}

                        {workflowStage === 'draft' && (
                          <button
                            onClick={handleAddInternalLinks}
                            disabled={isLinking || !sanityConfigured}
                            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                          >
                            {isLinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
                            {isLinking ? 'Linking...' : 'Add Internal Links'}
                          </button>
                        )}

                        <button
                          onClick={handleDownload}
                          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                          title="Download Markdown"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </button>
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      {workflowStages.map((stage, index) => {
                        const active = workflowStage === stage.id;
                        const completed = workflowStages.findIndex((item) => item.id === workflowStage) > index;

                        return (
                          <button
                            key={stage.id}
                            onClick={() => setWorkflowStage(stage.id)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                              active
                                ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                            }`}
                          >
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                              active
                                ? 'bg-white/10 text-white'
                                : completed
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-zinc-50 text-zinc-500 border border-zinc-200'
                            }`}>
                              {completed ? <Check className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            {stage.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                          Stage: {currentStageMeta.label}
                        </span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                          Internal links: {currentInternalLinkCount}
                        </span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                          Inline visuals: {state.blogInlineImages.length}
                        </span>
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${categoryConfidenceTone}`}>
                          Category: {effectiveCategory?.name || 'Auto-selecting'}
                        </span>
                      </div>

                      <button
                        onClick={advanceWorkflowStage}
                        disabled={primaryStageActionDisabled}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {workflowStage === 'publish' && isPublishing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4" />
                        )}
                        {primaryStageActionLabel}
                      </button>
                    </div>
                  </div>

                  {workflowStage === 'draft' && (
                    <>
                      <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-3 lg:px-8">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600">
                            Meta description: {(currentDescription || 'Pending').slice(0, 84)}
                          </span>
                          <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${categoryConfidenceTone}`}>
                            {effectiveCategory?.name || (sanityConfigured ? 'Kategori otomatik seciliyor' : 'Sanity devre disi')}
                          </span>
                          {effectiveCategory?.fallbackReason && (
                            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500">
                              {categoryResolutionLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="border-b border-zinc-100 px-6 py-10 lg:px-12">
                        <div className="blog-article-shell">
                          <div className="blog-article-prose">
                            {renderArticleContent()}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-indigo-100 bg-indigo-50/60 px-6 py-4 lg:px-8">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shrink-0">
                            <Wand2 className="h-4 w-4" />
                          </div>
                          <input
                            type="text"
                            value={editInstruction}
                            onChange={(e) => setEditInstruction(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                            placeholder="Ask AI to edit... e.g. make the intro sharper, add pricing context, simplify the CTA"
                            className="flex-1 rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm text-indigo-950 shadow-sm placeholder:text-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            disabled={isEditing || !openAiConfigured}
                          />
                          <button
                            onClick={handleEdit}
                            disabled={isEditing || !editInstruction.trim() || !openAiConfigured}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isEditing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Editing...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Apply Edit
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {workflowStage === 'media' && (
                    <div className="space-y-6 border-b border-zinc-100 bg-white px-6 py-6 lg:px-8">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                              <ImageIcon className="h-4 w-4 text-indigo-500" />
                              Media Workspace
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-zinc-600">
                              Cover and inline visuals live in a separate editorial workflow. They do not render inside the article preview; they are only mapped at publish time.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {MEDIA_POLICY_BADGES.map((badge) => (
                              <span key={badge} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 border border-zinc-200">
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-zinc-200 overflow-hidden">
                        <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-zinc-900">Cover Image</h4>
                            <p className="mt-1 text-xs leading-6 text-zinc-500">
                              This image stays outside the article body and defines the visual family of the post.
                            </p>
                          </div>
                          <button
                            onClick={handleGenerateCover}
                            disabled={isGeneratingCover || !geminiConfigured || !currentCoverPrompt}
                            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
                          >
                            {isGeneratingCover ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                                {currentCoverUrl ? 'Regenerate Cover' : 'Generate Cover'}
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                          <div className="space-y-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-zinc-500">Prompt seed</label>
                              <textarea
                                value={normalizeCoverPromptForState(currentCoverPrompt)}
                                onChange={(e) => setState((prev) => ({
                                  ...prev,
                                  ...(viewLanguage === 'EN'
                                    ? { blogCoverPromptEN: e.target.value }
                                    : { blogCoverPrompt: e.target.value }),
                                }))}
                                onBlur={(e) => setState((prev) => ({
                                  ...prev,
                                  ...(viewLanguage === 'EN'
                                    ? { blogCoverPromptEN: normalizeCoverPromptForState(finalizeCoverImagePromptText(e.target.value)) }
                                    : { blogCoverPrompt: normalizeCoverPromptForState(finalizeCoverImagePromptText(e.target.value)) }),
                                }))}
                                className="h-24 w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
                              />
                              <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                                Kısa bir konsept yaz. Stil kuralları generate sırasında backend tarafında eklenir.
                              </p>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-zinc-500">Alt text</label>
                              <input
                                type="text"
                                value={currentCoverAltText || ''}
                                onChange={(e) => setState((prev) => ({
                                  ...prev,
                                  ...(viewLanguage === 'EN'
                                    ? { blogCoverAltTextEN: e.target.value }
                                    : { blogCoverAltText: e.target.value }),
                                }))}
                                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="min-h-[260px] overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-50">
                            {currentCoverUrl ? (
                              <img src={currentCoverUrl} alt={currentCoverAltText || 'Cover'} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                                <div className="mb-3 inline-flex rounded-full border border-zinc-100 bg-white p-3 text-zinc-400 shadow-sm">
                                  <ImageIcon className="h-6 w-6" />
                                </div>
                                <p className="text-sm font-medium text-zinc-700">Cover not generated yet</p>
                                <p className="mt-1 text-xs leading-6 text-zinc-500">
                                  Use the media prompt on the left to create a calm, publication-grade cover.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-zinc-200 overflow-hidden">
                        <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-4">
                          <h4 className="text-sm font-semibold text-zinc-900">Inline Images</h4>
                          <p className="mt-1 text-xs leading-6 text-zinc-500">
                            Each visual is handled in its own card with its exact placement context. Nothing below is rendered into the article preview directly.
                          </p>
                        </div>

                        <div className="space-y-4 p-5">
                          {state.blogInlineImages.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-500">
                              This draft does not currently require inline visuals.
                            </div>
                          ) : (
                            state.blogInlineImages.map((image, imageIndex) => {
                              const imageKey = getBlogInlineImageKey(image);
                              const imageState = imageKey ? blogImages[imageKey] : null;
                              const placement = inlinePlacements.find((item) => item.slotId === normalizeBlogImageSlotId(image.slotId));
                              const previewUrl = image.dataUrl || imageState?.url || null;

                              return (
                                <div key={imageKey || imageIndex} className="overflow-hidden rounded-2xl border border-zinc-200">
                                  <div className="flex flex-col gap-3 border-b border-zinc-100 bg-white px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                      <h5 className="text-sm font-semibold text-zinc-900">
                                        {image.slotId ? `Inline Image ${image.slotId}` : `Inline Image ${imageIndex + 1}`}
                                      </h5>
                                      <p className="mt-1 text-xs leading-6 text-zinc-500">
                                        {placement
                                          ? `Placement: ${placement.heading} · ${placement.context}`
                                          : 'Placement context is not available yet.'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleGenerateImage(image)}
                                      disabled={imageState?.loading || !geminiConfigured}
                                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
                                    >
                                      {imageState?.loading ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                                          {previewUrl ? 'Regenerate' : 'Generate'}
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                                    <div className="space-y-3">
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-zinc-500">Prompt seed</label>
                                        <textarea
                                          value={normalizeInlinePromptForState(image.prompt)}
                                          onChange={(e) => updateInlineImage(imageKey, { prompt: e.target.value })}
                                          onBlur={(e) => updateInlineImage(imageKey, { prompt: normalizeInlinePromptForState(finalizeInlineImagePromptText(e.target.value)) })}
                                          className="h-24 w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                        <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                                          Kısa kalmalı. Örnek: <code>Editorial photo: revenue team reviewing live pipeline data</code>
                                        </p>
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-zinc-500">Alt text</label>
                                        <input
                                          type="text"
                                          value={image.altText || ''}
                                          onChange={(e) => updateInlineImage(imageKey, { altText: e.target.value })}
                                          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                      </div>
                                    </div>

                                    <div className="min-h-[240px] overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-50">
                                      {previewUrl ? (
                                        <img src={previewUrl} alt={image.altText || 'Blog image'} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                                          <div className="mb-3 inline-flex rounded-full border border-zinc-100 bg-white p-3 text-zinc-400 shadow-sm">
                                            <ImageIcon className="h-6 w-6" />
                                          </div>
                                          <p className="text-sm font-medium text-zinc-700">Inline visual not generated</p>
                                          <p className="mt-1 text-xs leading-6 text-zinc-500">
                                            Keep this image realistic, restrained, and suitable for an editorial article.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {workflowStage === 'publish' && (
                    <div className="space-y-6 border-b border-zinc-100 bg-white px-6 py-6 lg:px-8">
                      <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-5">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-indigo-500" />
                          <h3 className="text-sm font-semibold text-zinc-900">Publish Metadata</h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                          Finalize the fields that will be sent to Sanity. The article body stays separate; this stage focuses on metadata and packaging.
                        </p>

                        <div className="mt-5 grid gap-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-500">Title</label>
                            <input
                              type="text"
                              value={currentTitle || ''}
                              onChange={(e) => setState((prev) => ({
                                ...prev,
                                ...(viewLanguage === 'EN' ? { blogTitleEN: e.target.value } : { blogTitle: e.target.value }),
                              }))}
                              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
                            />
                            <div className="mt-1 text-right text-[11px] text-zinc-400">{(currentTitle || '').length} / 70</div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-500">Description</label>
                            <textarea
                              value={currentDescription || ''}
                              maxLength={160}
                              onChange={(e) => setState((prev) => ({
                                ...prev,
                                ...(viewLanguage === 'EN' ? { blogDescriptionEN: e.target.value } : { blogDescription: e.target.value }),
                              }))}
                              className="h-24 w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
                            />
                            <div className="mt-1 text-right text-[11px] text-zinc-400">{(currentDescription || '').length} / 160</div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-zinc-500">Slug</label>
                              <input
                                type="text"
                                value={currentSlug || ''}
                                onChange={(e) => setState((prev) => ({
                                  ...prev,
                                  ...(viewLanguage === 'EN' ? { blogSlugEN: e.target.value } : { blogSlug: e.target.value }),
                                }))}
                                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-mono text-sm text-zinc-700 focus:border-indigo-500 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-zinc-500">Category</label>
                              <div className="flex h-[50px] items-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-700">
                                {effectiveCategory?.name || (sanityConfigured ? 'Kategori otomatik seciliyor' : 'Sanity disabled')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-zinc-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-zinc-900">Final Article Preview</h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                          Review the publish package one last time. Visuals remain separate and will be attached only in the Sanity payload.
                        </p>
                        <div className="mt-6 blog-article-shell">
                          <div className="blog-article-prose">
                            {renderArticleContent()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="grid gap-4 lg:grid-cols-2">
                {workflowStage === 'publish' && (
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Publish Readiness</p>
                      <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-950">Checklist</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold tracking-tight text-zinc-950">{publishReadiness.items.length - publishReadiness.blockingCount}</p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Passing</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {publishReadiness.items.map((item) => (
                      <div key={item.key} className="rounded-2xl border border-zinc-200 bg-zinc-50/50 px-3 py-3">
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${
                            item.tone === 'success'
                              ? 'bg-emerald-100 text-emerald-600'
                              : item.tone === 'blocked'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-600'
                          }`}>
                            {item.tone === 'success' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-zinc-900">{item.label}</p>
                              {item.blocking && !item.ok && (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-600">
                                  Blocker
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-6 text-zinc-500">{item.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-600" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">SEO Analysis</p>
                      <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-950">Current language</h3>
                    </div>
                  </div>

                  <div className="mt-4">
                    {isAnalyzingSeo ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Loader2 className="mb-3 h-6 w-6 animate-spin text-indigo-500" />
                        <p className="text-xs font-medium text-zinc-900">Analyzing SEO strength...</p>
                      </div>
                    ) : currentSeoAnalysis ? (
                      <div className="space-y-5">
                        <div className="text-center">
                          <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-full border-4 border-indigo-100">
                            <span className="text-2xl font-bold text-indigo-600">{currentSeoAnalysis.score}</span>
                            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                              <circle
                                cx="50"
                                cy="50"
                                r="46"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                                className="text-indigo-500"
                                strokeDasharray={`${currentSeoAnalysis.score * 2.89} 289`}
                              />
                            </svg>
                          </div>
                          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">SEO score</p>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Keyword Density</h4>
                          <div className="mt-3 space-y-2">
                            {currentSeoAnalysis.keywords.map((keyword, index) => (
                              <div key={`${keyword.word}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate text-zinc-600">{keyword.word}</span>
                                <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  {keyword.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {currentSeoAnalysis.suggestions.length > 0 && (
                          <div className="border-t border-zinc-100 pt-4">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Suggestions</h4>
                            <ul className="mt-3 space-y-2">
                              {currentSeoAnalysis.suggestions.map((suggestion, index) => (
                                <li key={index} className="flex items-start gap-2 text-xs leading-6 text-zinc-600">
                                  <span className="mt-2 h-1 w-1 rounded-full bg-zinc-300" />
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-xs leading-6 text-zinc-500">
                        Analysis failed or is not available for the current language yet.
                      </div>
                    )}
                  </div>
                </div>

                {workflowStage === 'publish' && (
                  <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-indigo-600" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Social Promo</p>
                          <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-950">Launch snippets</h3>
                        </div>
                      </div>
                      {!socialPosts && (
                        <button
                          onClick={handleGenerateSocial}
                          disabled={isGeneratingSocial || !openAiConfigured}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {isGeneratingSocial ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Generate
                        </button>
                      )}
                    </div>

                    <div className="mt-4">
                      {isGeneratingSocial ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <Loader2 className="mb-2 h-5 w-5 animate-spin text-indigo-500" />
                          <p className="text-xs text-zinc-500">Writing social posts...</p>
                        </div>
                      ) : socialPosts ? (
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-zinc-900">
                              <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                              <span className="text-xs font-semibold">Twitter (X)</span>
                            </div>
                            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-zinc-700">
                              {socialPosts.twitter}
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(socialPosts.twitter)}
                              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-zinc-900">
                              <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                              <span className="text-xs font-semibold">LinkedIn</span>
                            </div>
                            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-zinc-700">
                              {socialPosts.linkedin}
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(socialPosts.linkedin)}
                              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-xs leading-6 text-zinc-500">
                          Generate concise launch snippets after the draft is ready for publication.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
