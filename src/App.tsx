import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SocialPostSidebar } from './components/SocialPostSidebar';
import { VisualPreview } from './components/VisualPreview';
import { SocialPostPreview } from './components/SocialPostPreview';
import { BlogPreview } from './components/BlogPreview';
import { SettingsModal } from './components/SettingsModal';
import { IntegrationSettingsModal } from './components/SanitySettingsModal';
import { AppState } from './types';
import { buildPersistedAppState, hydrateAppState } from './lib/app-state';
import {
  extractColorPalette,
  generateMarketingCopy,
  generateFinalVisual,
  generateSocialPostVisual,
  planSocialPostPrompt,
  planVisualPrompt,
} from './services/gemini';
import {
  buildFallbackSocialPostLockup,
  SOCIAL_POST_IMAGE_SLOT_COUNT,
  resolveSocialPostAspectRatio,
  resolveSocialPostFocus,
  supportsSocialPostReferenceImage,
} from './lib/social-post-prompt';
import { fitGeneratedVisualToAspectRatio } from './lib/visual-aspect-ratio';
import { Settings, PenTool, Image as ImageIcon, Database, LayoutTemplate } from 'lucide-react';
import {
  checkIntegrationEndpoints,
  defaultIntegrationStatus,
  fetchIntegrationStatus,
  IntegrationEndpointCheck,
  IntegrationStatus,
} from './services/integrations';
import { syncSanityCategories } from './services/sanity';

export default function App() {
  return <MainApp />;
}

const STORAGE_KEY = 'marketing_suite_state';

function MainApp() {
  const [state, setState] = useState<AppState>(() => hydrateAppState(localStorage.getItem(STORAGE_KEY)));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedAppState(state)));
  }, [state]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState<boolean[]>([false, false, false, false]);
  const [socialPostGeneratingStatus, setSocialPostGeneratingStatus] = useState<boolean[]>([false, false, false, false]);
  const [isPlanningSocialPosts, setIsPlanningSocialPosts] = useState(false);
  const [isRenderingSocialPosts, setIsRenderingSocialPosts] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isIntegrationSettingsOpen, setIsIntegrationSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [triggerBlogGen, setTriggerBlogGen] = useState(0);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(defaultIntegrationStatus);
  const [isRefreshingIntegrationStatus, setIsRefreshingIntegrationStatus] = useState(false);
  const [integrationEndpointChecks, setIntegrationEndpointChecks] = useState<IntegrationEndpointCheck[]>([]);
  const [isSyncingCategories, setIsSyncingCategories] = useState(false);
  const [categorySyncStatus, setCategorySyncStatus] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const nextStatus = await fetchIntegrationStatus();
      setIntegrationStatus(nextStatus);
    } catch (error) {
      console.error('Failed to load integration status:', error);
    }
  };

  const refreshStatusWithChecks = async () => {
    setIsRefreshingIntegrationStatus(true);
    try {
      const nextStatus = await fetchIntegrationStatus();
      setIntegrationStatus(nextStatus);
      const checks = await checkIntegrationEndpoints();
      setIntegrationEndpointChecks(checks);
    } catch (error) {
      console.error('Failed to refresh integration status:', error);
      setIntegrationEndpointChecks([
        {
          key: 'refresh-failed',
          label: 'Status Refresh',
          endpoint: '/api/integrations/status',
          ok: false,
          status: null,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ]);
    } finally {
      setIsRefreshingIntegrationStatus(false);
    }
  };

  const handleSyncSanityCategories = async () => {
    setIsSyncingCategories(true);
    setCategorySyncStatus(null);
    try {
      const result = await syncSanityCategories();
      setCategorySyncStatus(
        `Category sync tamamlandı. Güncellenen: ${result.updated}, Yeni: ${result.created}, Kaldırılan: ${result.pruned}, Yeniden atanan post: ${result.reassignedPosts}, Toplam policy: ${result.totalPolicyCount}`
      );
      await refreshStatusWithChecks();
    } catch (error) {
      setCategorySyncStatus(error instanceof Error ? error.message : 'Category sync başarısız.');
    } finally {
      setIsSyncingCategories(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const createEmptySocialPostSlots = () =>
    Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => null);

  const hasSocialPostPlans = state.socialPostPromptPlans.some((value) => String(value || '').trim().length > 0);

  const handleGenerate = async () => {
    if (state.activeModule === 'blog') {
      setTriggerBlogGen(prev => prev + 1);
      return;
    }

    if (state.activeModule === 'socialPosts') {
      await handlePlanSocialPosts();
      return;
    }

    setIsGenerating(true);
    setGeneratingStatus([true, true, true, true]);
    setState(prev => ({ ...prev, finalVisuals: [null, null, null, null] }));
    
    let newHeadline = state.headline;
    let newSubheadline = state.subheadline;
    let newCta = state.cta;
    let newBrandColor = state.brandColor;

    // Auto-detect brand color if enabled
    if (integrationStatus.gemini.configured && state.autoBrandColor && state.images[0]) {
      try {
        const palette = await extractColorPalette(state.images[0]);
        if (palette && palette.length > 0) {
          newBrandColor = palette[0];
          setState(prev => ({ ...prev, brandColor: palette[0], colorPalette: palette }));
        }
      } catch (e) {
        console.error("Failed to auto-detect color", e);
      }
    }

    // If text is missing, generate it
    if (!state.headline || !state.subheadline || (state.includeCta && !state.cta)) {
      const copy = await generateMarketingCopy(
        state.productName,
        state.featureName,
        state.description,
        state.platform,
        state.campaignType,
        state.tone,
        state.language,
        state.includeCta
      );
      
      if (copy) {
        newHeadline = state.headline || copy.headline;
        newSubheadline = state.subheadline || copy.subheadline;
        newCta = state.includeCta ? (state.cta || copy.cta) : state.cta;
        
        setState(prev => ({
          ...prev,
          headline: newHeadline,
          subheadline: newSubheadline,
          cta: prev.includeCta ? newCta : prev.cta,
        }));
      }
    }

    const effectiveCta = state.includeCta ? newCta : '';

    // Generate final visuals sequentially
    for (let i = 0; i < 4; i++) {
      const plannedPrompt = await planVisualPrompt({
        productName: state.productName,
        featureName: state.featureName,
        description: state.description,
        headline: newHeadline,
        subheadline: newSubheadline,
        cta: effectiveCta,
        includeCta: state.includeCta,
        brandColor: newBrandColor,
        platform: state.platform,
        campaignType: state.campaignType,
        aspectRatio: state.aspectRatio,
        tone: state.tone,
        designStyle: state.designStyle,
        theme: state.theme,
        mode: state.mode,
        language: state.language,
        customInstruction: state.customInstruction,
        campaignFocus: state.campaignFocus,
        variationIndex: i,
        hasScreenshots: state.images.length > 0,
        hasReferenceImage: Boolean(state.referenceImage),
        isMagicEdit: false,
      });

      const visual = await generateFinalVisual(
        state.images,
        state.productName,
        state.featureName,
        state.description,
        newHeadline,
        newSubheadline,
        effectiveCta,
        state.includeCta,
        newBrandColor,
        state.platform,
        state.campaignType,
        state.aspectRatio,
        state.tone,
        state.designStyle,
        state.theme,
        state.mode,
        state.language,
        state.customInstruction,
        state.campaignFocus,
        i,
        undefined,
        undefined,
        state.referenceImage,
        plannedPrompt?.prompt
      );
      const fittedVisual = await fitGeneratedVisualToAspectRatio(visual, state.aspectRatio);
      
      setState(prev => {
        const newVisuals = [...prev.finalVisuals];
        newVisuals[i] = fittedVisual || visual;
        return { ...prev, finalVisuals: newVisuals };
      });
      
      setGeneratingStatus(prev => {
        const newStatus = [...prev];
        newStatus[i] = false;
        return newStatus;
      });
    }

    setIsGenerating(false);
  };

  const handlePlanSocialPosts = async () => {
    setIsPlanningSocialPosts(true);
    setSocialPostGeneratingStatus(Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => false));
    setState((prev) => ({
      ...prev,
      socialPostHeadlinePlans: createEmptySocialPostSlots(),
      socialPostSubheadlinePlans: createEmptySocialPostSlots(),
      socialPostPromptPlans: createEmptySocialPostSlots(),
      socialPostFinalVisuals: createEmptySocialPostSlots(),
    }));

    const focus = resolveSocialPostFocus(state.socialPostFocus);
    const socialPostReferenceImage = supportsSocialPostReferenceImage(state.socialPostCategory)
      ? state.socialPostReferenceImage
      : null;

    try {
      let sharedHeadline = '';
      let sharedSubheadline = '';

      for (let i = 0; i < SOCIAL_POST_IMAGE_SLOT_COUNT; i += 1) {
        const plannedPrompt = await planSocialPostPrompt({
          productName: state.productName,
          featureName: state.featureName,
          description: state.description,
          platform: state.socialPostPlatform,
          theme: state.socialPostTheme,
          category: state.socialPostCategory,
          language: state.socialPostLanguage,
          focus,
          blogContent: state.socialPostBlogContent,
          extraInstruction: '',
          variationIndex: i,
          hasReferenceImage: Boolean(socialPostReferenceImage),
        });
        const fallbackLockup = buildFallbackSocialPostLockup({
          category: state.socialPostCategory,
          language: state.socialPostLanguage,
          productName: state.productName,
          featureName: state.featureName,
        });
        sharedHeadline = sharedHeadline || plannedPrompt?.headline?.trim() || fallbackLockup.headline;
        sharedSubheadline = sharedSubheadline || plannedPrompt?.subheadline?.trim() || fallbackLockup.subheadline;
        const nextPrompt = plannedPrompt?.prompt || `Premium ${state.socialPostPlatform} social page post visual in the selected house style.`;

        setState((prev) => {
          const nextHeadlines = [...prev.socialPostHeadlinePlans];
          const nextSubheadlines = [...prev.socialPostSubheadlinePlans];
          const nextPlans = [...prev.socialPostPromptPlans];
          nextHeadlines[i] = sharedHeadline;
          nextSubheadlines[i] = sharedSubheadline;
          nextPlans[i] = nextPrompt;
          return {
            ...prev,
            socialPostHeadlinePlans: nextHeadlines,
            socialPostSubheadlinePlans: nextSubheadlines,
            socialPostPromptPlans: nextPlans,
          };
        });
      }
    } finally {
      setIsPlanningSocialPosts(false);
    }
  };

  const handleGenerateSocialPostVisuals = async () => {
    if (!hasSocialPostPlans) {
      return;
    }

    const aspectRatio = resolveSocialPostAspectRatio(state.socialPostPlatform);
    const focus = resolveSocialPostFocus(state.socialPostFocus);
    const socialPostReferenceImage = supportsSocialPostReferenceImage(state.socialPostCategory)
      ? state.socialPostReferenceImage
      : null;
    const fallbackLockup = buildFallbackSocialPostLockup({
      category: state.socialPostCategory,
      language: state.socialPostLanguage,
      productName: state.productName,
      featureName: state.featureName,
    });
    const sharedHeadline = state.socialPostHeadlinePlans.find((value) => String(value || '').trim().length > 0)?.trim() || fallbackLockup.headline;
    const sharedSubheadline = state.socialPostSubheadlinePlans.find((value) => String(value || '').trim().length > 0)?.trim() || fallbackLockup.subheadline;

    setIsRenderingSocialPosts(true);
    setSocialPostGeneratingStatus(Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => true));
    setState((prev) => ({
      ...prev,
      socialPostFinalVisuals: createEmptySocialPostSlots(),
    }));

    try {
      for (let i = 0; i < SOCIAL_POST_IMAGE_SLOT_COUNT; i += 1) {
        const plannedPrompt = state.socialPostPromptPlans[i]?.trim()
          || `Premium ${state.socialPostPlatform} social page post visual in the selected house style.`;
        const plannedHeadline = sharedHeadline;
        const plannedSubheadline = sharedSubheadline;

        const visual = await generateSocialPostVisual({
          productName: state.productName,
          featureName: state.featureName,
          description: state.description,
          platform: state.socialPostPlatform,
          aspectRatio,
          theme: state.socialPostTheme,
          language: state.socialPostLanguage,
          plannedPrompt,
          headline: plannedHeadline,
          subheadline: plannedSubheadline,
          variationIndex: i,
          category: state.socialPostCategory,
          focus,
          referenceImage: socialPostReferenceImage,
        });

        const fittedVisual = await fitGeneratedVisualToAspectRatio(visual, aspectRatio);

        setState((prev) => {
          const nextVisuals = [...prev.socialPostFinalVisuals];
          nextVisuals[i] = fittedVisual || visual;
          return {
            ...prev,
            socialPostFinalVisuals: nextVisuals,
          };
        });

        setSocialPostGeneratingStatus((prev) => {
          const nextStatus = [...prev];
          nextStatus[i] = false;
          return nextStatus;
        });
      }
    } finally {
      setIsRenderingSocialPosts(false);
    }
  };

  const handleRegenerate = async (index: number, comment: string) => {
    setGeneratingStatus(prev => {
      const newStatus = [...prev];
      newStatus[index] = true;
      return newStatus;
    });

    let newHeadline = state.headline;
    let newSubheadline = state.subheadline;
    let newCta = state.cta;
    let newBrandColor = state.brandColor;

    if (!newHeadline || !newSubheadline || (state.includeCta && !newCta)) {
      const copy = await generateMarketingCopy(
        state.productName, 
        state.featureName, 
        state.description,
        state.platform,
        state.campaignType,
        state.tone,
        state.language,
        state.includeCta
      );
      if (copy) {
        newHeadline = newHeadline || copy.headline;
        newSubheadline = newSubheadline || copy.subheadline;
        newCta = state.includeCta ? (newCta || copy.cta) : newCta;
      }
    }

    if (integrationStatus.gemini.configured && state.autoBrandColor && state.images.length > 0) {
      const palette = await extractColorPalette(state.images[0]);
      if (palette && palette.length > 0) {
        newBrandColor = palette[0];
        setState(prev => ({ ...prev, brandColor: palette[0], colorPalette: palette }));
      }
    }

    // Use original images directly
    const currentImagesToUse = state.images.filter(Boolean);
    const effectiveCta = state.includeCta ? newCta : '';

    const plannedPrompt = await planVisualPrompt({
      productName: state.productName,
      featureName: state.featureName,
      description: state.description,
      headline: newHeadline,
      subheadline: newSubheadline,
      cta: effectiveCta,
      includeCta: state.includeCta,
      brandColor: newBrandColor,
      platform: state.platform,
      campaignType: state.campaignType,
      aspectRatio: state.aspectRatio,
      tone: state.tone,
      designStyle: state.designStyle,
      theme: state.theme,
      mode: state.mode,
      language: state.language,
      customInstruction: state.customInstruction,
      campaignFocus: state.campaignFocus,
      variationIndex: index,
      hasScreenshots: currentImagesToUse.length > 0,
      hasReferenceImage: Boolean(state.referenceImage),
      isMagicEdit: true,
      userComment: comment,
    });

    const visual = await generateFinalVisual(
      currentImagesToUse,
      state.productName,
      state.featureName,
      state.description,
      newHeadline,
      newSubheadline,
      effectiveCta,
      state.includeCta,
      newBrandColor,
      state.platform,
      state.campaignType,
      state.aspectRatio,
      state.tone,
      state.designStyle,
      state.theme,
      state.mode,
      state.language,
      state.customInstruction,
      state.campaignFocus,
      index,
      state.finalVisuals[index] || undefined,
      comment,
      state.referenceImage,
      plannedPrompt?.prompt
    );
    const fittedVisual = await fitGeneratedVisualToAspectRatio(visual, state.aspectRatio);

    setState(prev => {
      const newVisuals = [...prev.finalVisuals];
      newVisuals[index] = fittedVisual || visual;
      return { ...prev, finalVisuals: newVisuals };
    });

    setGeneratingStatus(prev => {
      const newStatus = [...prev];
      newStatus[index] = false;
      return newStatus;
    });
  };

  const handleSocialPostRegenerate = async (index: number, comment: string) => {
    setSocialPostGeneratingStatus((prev) => {
      const nextStatus = [...prev];
      nextStatus[index] = true;
      return nextStatus;
    });

    const aspectRatio = resolveSocialPostAspectRatio(state.socialPostPlatform);
    const focus = resolveSocialPostFocus(
      state.socialPostFocus
    );
    const socialPostReferenceImage = supportsSocialPostReferenceImage(state.socialPostCategory)
      ? state.socialPostReferenceImage
      : null;
    const sharedHeadline = state.socialPostHeadlinePlans.find((value) => String(value || '').trim().length > 0)?.trim();
    const sharedSubheadline = state.socialPostSubheadlinePlans.find((value) => String(value || '').trim().length > 0)?.trim();
    const previousSocialPostVisual = state.socialPostFinalVisuals[index] || undefined;
    const magicEditPlan = await planSocialPostPrompt({
      productName: state.productName,
      featureName: state.featureName,
      description: state.description,
      platform: state.socialPostPlatform,
      theme: state.socialPostTheme,
      category: state.socialPostCategory,
      language: state.socialPostLanguage,
      focus,
      blogContent: state.socialPostBlogContent,
      extraInstruction: comment,
      variationIndex: index,
      hasReferenceImage: Boolean(socialPostReferenceImage),
    });
    const fallbackPlan = state.socialPostPromptPlans[index]
      ? {
          prompt: state.socialPostPromptPlans[index],
          headline: sharedHeadline || state.socialPostHeadlinePlans[index],
          subheadline: sharedSubheadline || state.socialPostSubheadlinePlans[index],
        }
      : null;
    const fallbackLockup = buildFallbackSocialPostLockup({
      category: state.socialPostCategory,
      language: state.socialPostLanguage,
      productName: state.productName,
      featureName: state.featureName,
    });
    const plannedPrompt = magicEditPlan?.prompt?.trim()
      || fallbackPlan?.prompt?.trim()
      || `Premium ${state.socialPostPlatform} social page post visual in the selected house style.`;
    const plannedHeadline = sharedHeadline || magicEditPlan?.headline?.trim() || fallbackPlan?.headline?.trim() || fallbackLockup.headline;
    const plannedSubheadline = sharedSubheadline || magicEditPlan?.subheadline?.trim() || fallbackPlan?.subheadline?.trim() || fallbackLockup.subheadline;

    setState((prev) => {
      const nextHeadlines = [...prev.socialPostHeadlinePlans];
      const nextSubheadlines = [...prev.socialPostSubheadlinePlans];
      const nextPlans = [...prev.socialPostPromptPlans];
      nextHeadlines.fill(plannedHeadline);
      nextSubheadlines.fill(plannedSubheadline);
      nextPlans[index] = plannedPrompt;
      return {
        ...prev,
        socialPostHeadlinePlans: nextHeadlines,
        socialPostSubheadlinePlans: nextSubheadlines,
        socialPostPromptPlans: nextPlans,
      };
    });

    const visual = await generateSocialPostVisual({
      productName: state.productName,
      featureName: state.featureName,
      description: state.description,
      platform: state.socialPostPlatform,
      aspectRatio,
      theme: state.socialPostTheme,
      language: state.socialPostLanguage,
      plannedPrompt,
      headline: plannedHeadline,
      subheadline: plannedSubheadline,
      variationIndex: index,
      category: state.socialPostCategory,
      focus,
      referenceImage: socialPostReferenceImage,
      previousImage: previousSocialPostVisual,
      userComment: comment,
    });
    const fittedVisual = await fitGeneratedVisualToAspectRatio(visual, aspectRatio);

    setState((prev) => {
      const nextVisuals = [...prev.socialPostFinalVisuals];
      nextVisuals[index] = fittedVisual || visual;
      return {
        ...prev,
        socialPostFinalVisuals: nextVisuals,
      };
    });

    setSocialPostGeneratingStatus((prev) => {
      const nextStatus = [...prev];
      nextStatus[index] = false;
      return nextStatus;
    });
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden font-sans">
      {state.activeModule === 'socialPosts' ? (
        <SocialPostSidebar
          state={state}
          setState={setState}
          onPlanCopy={handlePlanSocialPosts}
          onGenerateVisuals={handleGenerateSocialPostVisuals}
          isPlanningCopy={isPlanningSocialPosts}
          isGeneratingVisuals={isRenderingSocialPosts}
          hasPlannedCopy={hasSocialPostPlans}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          integrationStatus={integrationStatus}
        />
      ) : (
        <Sidebar 
          state={state} 
          setState={setState} 
          onGenerate={handleGenerate} 
          isGenerating={isGenerating} 
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          integrationStatus={integrationStatus}
        />
      )}
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Navigation */}
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setState(prev => ({ ...prev, activeModule: 'visuals' }))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                state.activeModule === 'visuals' 
                  ? 'bg-zinc-100 text-zinc-900' 
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
              >
                <ImageIcon className="w-4 h-4" />
                Visual Creator
              </button>
              <button
                onClick={() => setState(prev => ({ ...prev, activeModule: 'socialPosts' }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  state.activeModule === 'socialPosts' 
                    ? 'bg-zinc-100 text-zinc-900' 
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                <LayoutTemplate className="w-4 h-4" />
                Social Posts
              </button>
              <button
                onClick={() => setState(prev => ({ ...prev, activeModule: 'blog' }))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                state.activeModule === 'blog' 
                  ? 'bg-zinc-100 text-zinc-900' 
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              <PenTool className="w-4 h-4" />
              Blog Writer
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsIntegrationSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Database className="w-4 h-4" />
            Integrations
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Settings className="w-4 h-4" />
            Product Context
          </button>
        </div>
      </header>

      {(!integrationStatus.openai.configured || !integrationStatus.gemini.configured || !integrationStatus.sanity.configured || !integrationStatus.qualy.configured) && (
        <div className="px-6 py-3 border-b border-amber-200 bg-amber-50 text-sm text-amber-900 space-y-1">
          {!integrationStatus.openai.configured && (
            <p>Blog metin ve strateji akisi kapali. <code>OPENAI_API_KEY</code> ekleyince acilir.</p>
          )}
          {!integrationStatus.gemini.configured && (
            <p>Gorsel uretimi kapali. <code>GEMINI_API_KEY</code> ekledikten sonra acilir.</p>
          )}
          {!integrationStatus.sanity.configured && (
            <p>Sanity fetch ve publish kapali. <code>SANITY_PROJECT_ID</code> ve <code>SANITY_TOKEN</code> eksik.</p>
          )}
          {integrationStatus.sanity.configured && !integrationStatus.qualy.configured && (
            <p>Sanity publish acik, ama Qualy blog build path bulunamadi. Istersen <code>QUALY_LP_PATH</code> tanimlayarak otomatik blog refresh acabilirsin.</p>
          )}
        </div>
      )}

      <main className="flex-1 overflow-y-auto w-full">
        {state.activeModule === 'visuals' ? (
            <div className="p-6 lg:p-8 w-full h-full">
              {(isGenerating || state.finalVisuals.some(v => v !== null)) ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 w-full">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <VisualPreview 
                      key={i} 
                      state={state} 
                      variationIndex={i} 
                      isGenerating={generatingStatus[i]} 
                      onRegenerate={handleRegenerate}
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-full min-h-[500px] border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center bg-white shadow-sm">
                  <div className="text-center max-w-sm px-6">
                    <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                      <ImageIcon className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900 tracking-tight">No visuals generated</h3>
                    <p className="mt-2 text-sm text-zinc-500 leading-relaxed">Get started by setting your Product Context and clicking generate.</p>
                  </div>
                </div>
              )}
            </div>
          ) : state.activeModule === 'socialPosts' ? (
            <div className="p-6 lg:p-8 w-full h-full">
              {(isPlanningSocialPosts || isRenderingSocialPosts || hasSocialPostPlans || state.socialPostFinalVisuals.some((visual) => visual !== null)) ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 w-full">
                  {Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }).map((_, i) => (
                    <SocialPostPreview
                      key={i}
                      platform={state.socialPostPlatform}
                      category={state.socialPostCategory}
                      language={state.socialPostLanguage}
                      visual={state.socialPostFinalVisuals[i]}
                      variationIndex={i}
                      aspectRatio={resolveSocialPostAspectRatio(state.socialPostPlatform)}
                      isGenerating={socialPostGeneratingStatus[i]}
                      onRegenerate={handleSocialPostRegenerate}
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-full min-h-[500px] border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center bg-white shadow-sm">
                  <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                      <LayoutTemplate className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900 tracking-tight">No social posts generated</h3>
                    <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                      Plan the copy first, review or edit it in the sidebar, then generate the visuals with the current copy, focus, and Gemini-ready prompt.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <BlogPreview 
              state={state} 
              setState={setState} 
              isGenerating={isGenerating}
              setIsGenerating={setIsGenerating}
              triggerGenerate={triggerBlogGen}
              integrationStatus={integrationStatus}
            />
          )}
      </main>
    </div>

    <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        state={state} 
        setState={setState} 
        aiTextConfigured={integrationStatus.openai.configured}
      />

      <IntegrationSettingsModal 
        isOpen={isIntegrationSettingsOpen} 
        onClose={() => setIsIntegrationSettingsOpen(false)} 
        integrationStatus={integrationStatus}
        onRefreshStatus={refreshStatusWithChecks}
        isRefreshingStatus={isRefreshingIntegrationStatus}
        endpointChecks={integrationEndpointChecks}
        onSyncCategories={handleSyncSanityCategories}
        isSyncingCategories={isSyncingCategories}
        categorySyncStatus={categorySyncStatus}
      />
    </div>
  );
}
