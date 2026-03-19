import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { VisualPreview } from './components/VisualPreview';
import { BlogPreview } from './components/BlogPreview';
import { SettingsModal } from './components/SettingsModal';
import { SanitySettingsModal } from './components/SanitySettingsModal';
import { AppState, defaultState } from './types';
import { extractColorPalette, generateMarketingCopy, generateFinalVisual } from './services/gemini';
import { Settings, PenTool, Image as ImageIcon, Database } from 'lucide-react';
import { defaultIntegrationStatus, fetchIntegrationStatus, IntegrationStatus } from './services/integrations';

export default function App() {
  return <MainApp />;
}

const STORAGE_KEY = 'marketing_suite_state';

function MainApp() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultState, 
          ...parsed, 
          images: [], 
          finalVisuals: [null, null, null, null], 
          blogContent: null, 
          seoAnalysis: null,
          referenceImage: null
        };
      } catch (e) {
        return defaultState;
      }
    }
    return defaultState;
  });

  useEffect(() => {
    const stateToSave = {
      productName: state.productName,
      featureName: state.featureName,
      targetAudience: state.targetAudience,
      description: state.description,
      brandColor: state.brandColor,
      autoBrandColor: state.autoBrandColor,
      autoInternalLinks: state.autoInternalLinks,
      language: state.language,
      tone: state.tone,
      blogTone: state.blogTone,
      blogLength: state.blogLength,
      blogKeywords: state.blogKeywords,
      blogTopic: state.blogTopic,
      activeModule: state.activeModule,
      aspectRatio: state.aspectRatio,
      mode: state.mode,
      designStyle: state.designStyle,
      campaignType: state.campaignType,
      headline: state.headline,
      subheadline: state.subheadline,
      cta: state.cta,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState<boolean[]>([false, false, false, false]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSanitySettingsOpen, setIsSanitySettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [triggerBlogGen, setTriggerBlogGen] = useState(0);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(defaultIntegrationStatus);

  const loadStatus = async () => {
    try {
      const nextStatus = await fetchIntegrationStatus();
      setIntegrationStatus(nextStatus);
    } catch (error) {
      console.error('Failed to load integration status:', error);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleGenerate = async () => {
    if (state.activeModule === 'blog') {
      setTriggerBlogGen(prev => prev + 1);
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
    if (!state.headline || !state.subheadline || !state.cta) {
      const copy = await generateMarketingCopy(
        state.productName,
        state.featureName,
        state.description,
        state.campaignType,
        state.tone,
        state.language
      );
      
      if (copy) {
        newHeadline = state.headline || copy.headline;
        newSubheadline = state.subheadline || copy.subheadline;
        newCta = state.cta || copy.cta;
        
        setState(prev => ({
          ...prev,
          headline: newHeadline,
          subheadline: newSubheadline,
          cta: newCta,
        }));
      }
    }

    // Generate final visuals sequentially
    for (let i = 0; i < 4; i++) {
      const visual = await generateFinalVisual(
        state.images,
        state.productName,
        state.featureName,
        state.description,
        newHeadline,
        newSubheadline,
        newCta,
        newBrandColor,
        state.campaignType,
        state.aspectRatio,
        state.tone,
        state.designStyle,
        state.mode,
        state.language,
        state.customInstruction,
        state.campaignFocus,
        i,
        undefined,
        undefined,
        state.referenceImage
      );
      
      setState(prev => {
        const newVisuals = [...prev.finalVisuals];
        newVisuals[i] = visual;
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

    if (!newHeadline || !newSubheadline || !newCta) {
      const copy = await generateMarketingCopy(
        state.productName, 
        state.featureName, 
        state.description,
        state.campaignType,
        state.tone,
        state.language
      );
      if (copy) {
        newHeadline = newHeadline || copy.headline;
        newSubheadline = newSubheadline || copy.subheadline;
        newCta = newCta || copy.cta;
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

    const visual = await generateFinalVisual(
      currentImagesToUse,
      state.productName,
      state.featureName,
      state.description,
      newHeadline,
      newSubheadline,
      newCta,
      newBrandColor,
      state.campaignType,
      state.aspectRatio,
      state.tone,
      state.designStyle,
      state.mode,
      state.language,
      state.customInstruction,
      state.campaignFocus,
      index,
      state.finalVisuals[index] || undefined,
      comment,
      state.referenceImage
    );

    setState(prev => {
      const newVisuals = [...prev.finalVisuals];
      newVisuals[index] = visual;
      return { ...prev, finalVisuals: newVisuals };
    });

    setGeneratingStatus(prev => {
      const newStatus = [...prev];
      newStatus[index] = false;
      return newStatus;
    });
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden font-sans">
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
            onClick={() => setIsSanitySettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Database className="w-4 h-4" />
            Sanity
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

      {(!integrationStatus.gemini.configured || !integrationStatus.sanity.configured || !integrationStatus.qualy.configured) && (
        <div className="px-6 py-3 border-b border-amber-200 bg-amber-50 text-sm text-amber-900 space-y-1">
          {!integrationStatus.gemini.configured && (
            <p>AI ozellikleri pasif. <code>GEMINI_API_KEY</code> ekledikten sonra generate islemleri acilir.</p>
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
        geminiConfigured={integrationStatus.gemini.configured}
      />

      <SanitySettingsModal 
        isOpen={isSanitySettingsOpen} 
        onClose={() => setIsSanitySettingsOpen(false)} 
        integrationStatus={integrationStatus}
        onRefreshStatus={loadStatus}
      />
    </div>
  );
}
