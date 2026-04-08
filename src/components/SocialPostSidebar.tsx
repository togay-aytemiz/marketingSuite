import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  LayoutTemplate,
  Linkedin,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
  Upload,
  X,
} from 'lucide-react';

import type { AppState } from '../types';
import type { IntegrationStatus } from '../services/integrations';
import {
  SOCIAL_POST_IMAGE_SLOT_COUNT,
  supportsSocialPostReferenceImage,
} from '../lib/social-post-prompt';

interface SocialPostSidebarProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onPlanCopy: () => void;
  onGenerateVisuals: () => void;
  isPlanningCopy: boolean;
  isGeneratingVisuals: boolean;
  hasPlannedCopy: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  integrationStatus: IntegrationStatus;
}

const PLATFORM_OPTIONS = [
  {
    value: 'Instagram',
    label: 'Instagram',
    icon: <Smartphone className="w-4 h-4" />,
    aspectRatio: '4:5',
  },
  {
    value: 'LinkedIn',
    label: 'LinkedIn',
    icon: <Linkedin className="w-4 h-4" />,
    aspectRatio: '1:1',
  },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'new_feature', label: 'Yeni özellik', description: 'Tek bir capability, glow ile vurgulanan yakın plan UI detayı.' },
  { value: 'product_overview', label: 'Genel ürün tanıtımı', description: 'Birden fazla modül ile all-in-one sistem hissi.' },
  { value: 'blog', label: 'Blog / Makale', description: 'Daha sakin, editorial, document/article card ağırlıklı kompozisyon.' },
] as const;

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'TR', label: 'Türkçe' },
  { value: 'EN', label: 'English' },
] as const;

export function SocialPostSidebar({
  state,
  setState,
  onPlanCopy,
  onGenerateVisuals,
  isPlanningCopy,
  isGeneratingVisuals,
  hasPlannedCopy,
  isSidebarOpen,
  setIsSidebarOpen,
  integrationStatus,
}: SocialPostSidebarProps) {
  const [expandedSections, setExpandedSections] = React.useState({
    setup: false,
    prompt: true,
    variations: false,
    output: false,
  });
  const openAiConfigured = integrationStatus.openai.configured;
  const geminiConfigured = integrationStatus.gemini.configured;
  const isBusy = isPlanningCopy || isGeneratingVisuals;
  const activePlatform = PLATFORM_OPTIONS.find((option) => option.value === state.socialPostPlatform) || PLATFORM_OPTIONS[0];
  const shouldShowReferenceImage = supportsSocialPostReferenceImage(state.socialPostCategory);
  const createEmptySocialPostSlots = () =>
    Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  React.useEffect(() => {
    if (!hasPlannedCopy) {
      return;
    }

    setExpandedSections((prev) => (
      prev.variations ? prev : { ...prev, variations: true }
    ));
  }, [hasPlannedCopy]);

  const applyBriefChange = (updates: Partial<AppState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
      socialPostHeadlinePlans: createEmptySocialPostSlots(),
      socialPostSubheadlinePlans: createEmptySocialPostSlots(),
      socialPostPromptPlans: createEmptySocialPostSlots(),
      socialPostFinalVisuals: createEmptySocialPostSlots(),
    }));
  };

  const updatePlannedCopy = (index: number, field: 'headline' | 'subheadline', value: string) => {
    setState((prev) => {
      const nextHeadlines = [...prev.socialPostHeadlinePlans];
      const nextSubheadlines = [...prev.socialPostSubheadlinePlans];
      const nextVisuals = [...prev.socialPostFinalVisuals];

      if (field === 'headline') {
        nextHeadlines.fill(value);
      } else {
        nextSubheadlines.fill(value);
      }

      nextVisuals.fill(null);

      return {
        ...prev,
        socialPostHeadlinePlans: nextHeadlines,
        socialPostSubheadlinePlans: nextSubheadlines,
        socialPostFinalVisuals: nextVisuals,
      };
    });
  };

  const handleReferenceImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = typeof reader.result === 'string' ? reader.result : '';
      if (!base64) {
        return;
      }

      applyBriefChange({
        socialPostReferenceImage: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    applyBriefChange({
      socialPostReferenceImage: null,
    });
  };

  if (!isSidebarOpen) {
    return (
      <div className="w-16 bg-white border-r border-zinc-200 h-screen flex flex-col items-center py-4 shrink-0 z-30">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors mb-4"
          title="Open sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 bg-zinc-900 rounded-md flex items-center justify-center">
          <span className="text-white text-sm font-bold">M</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-80 bg-white border-r border-zinc-200 h-screen flex flex-col shrink-0 z-30 transition-opacity duration-300 ${isBusy ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-200 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-900 tracking-tight">Marketing Suite</h1>
        </div>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
          title="Close sidebar"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection('setup')}
            className="flex items-center justify-between w-full text-left group"
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-900 group-hover:text-zinc-600 transition-colors">
              Setup
            </h2>
            {expandedSections.setup ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.setup && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map((option) => {
                    const isActive = state.socialPostPlatform === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyBriefChange({ socialPostPlatform: option.value })}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {option.icon}
                          {option.label}
                        </div>
                        <div className={`mt-2 text-[11px] ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          Aspect ratio: {option.aspectRatio}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_OPTIONS.map((option) => {
                    const isActive = state.socialPostTheme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyBriefChange({ socialPostTheme: option.value })}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                          isActive
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Kategori</label>
                <div className="space-y-2">
                  {CATEGORY_OPTIONS.map((option) => {
                    const isActive = state.socialPostCategory === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyBriefChange({
                          socialPostCategory: option.value,
                          socialPostReferenceImage: supportsSocialPostReferenceImage(option.value)
                            ? state.socialPostReferenceImage
                            : null,
                        })}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className={`mt-1 text-[11px] leading-5 ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {option.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Yazı Dili</label>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGE_OPTIONS.map((option) => {
                    const isActive = state.socialPostLanguage === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyBriefChange({ socialPostLanguage: option.value })}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                          isActive
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => toggleSection('prompt')}
            className="flex items-center justify-between w-full text-left group"
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-900 group-hover:text-zinc-600 transition-colors">
              Prompt & Variations
            </h2>
            {expandedSections.prompt ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.prompt && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Focus / Extra Direction</label>
              </div>
              <textarea
                value={state.socialPostFocus}
                onChange={(event) => applyBriefChange({ socialPostFocus: event.target.value })}
                className="h-28 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:ring-zinc-900"
                placeholder="Örn. AI automatically tagging conversations, floating tags around a central inbox card, clean premium SaaS feeling..."
              />
              {shouldShowReferenceImage ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Optional UI Source</label>
                  </div>
                  {state.socialPostReferenceImage ? (
                    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm">
                      <img
                        src={state.socialPostReferenceImage}
                        alt="Social post reference"
                        className="h-32 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeReferenceImage}
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-zinc-700 shadow-sm transition-colors hover:bg-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition-all hover:border-zinc-300 hover:bg-zinc-100">
                      <div className="flex flex-col items-center justify-center">
                        <Upload className="mb-1 h-4 w-4 text-zinc-400" />
                        <p className="text-xs font-medium text-zinc-600">Upload reference visual</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleReferenceImageUpload} />
                    </label>
                  )}
                </div>
              ) : null}
              {state.socialPostCategory === 'blog' ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Blog Metni</label>
                    <p className="text-[11px] leading-5 text-zinc-500">
                      Blog yazısını buraya yapıştır. Planner görsel odağını ve kompozisyonunu bu içerikten çıkaracak.
                    </p>
                  </div>
                  <textarea
                    value={state.socialPostBlogContent}
                    onChange={(event) => applyBriefChange({ socialPostBlogContent: event.target.value })}
                    className="h-44 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:ring-zinc-900"
                    placeholder="Blog yazısını veya uzun excerpt'i buraya yapıştır..."
                  />
                </div>
              ) : null}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                <button
                  type="button"
                  onClick={() => toggleSection('variations')}
                  className="flex items-center justify-between w-full text-left group"
                >
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-700 group-hover:text-zinc-600 transition-colors">
                      4 Ardışık Varyasyon
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                      Fark kullanıcı input’ından değil, planner’ın varyasyon stratejisinden gelecek.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      {activePlatform.aspectRatio}
                    </div>
                    {expandedSections.variations ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                  </div>
                </button>

                {expandedSections.variations && (
                  <div className="mt-3 space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-700">
                            Görsel {index + 1}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            Variation {index + 1}
                          </div>
                        </div>
                        {state.socialPostPromptPlans[index] || state.socialPostHeadlinePlans[index] || state.socialPostSubheadlinePlans[index] ? (
                          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                                  Shared Headline
                                </label>
                                <input
                                  type="text"
                                  value={state.socialPostHeadlinePlans[index] || ''}
                                  onChange={(event) => updatePlannedCopy(index, 'headline', event.target.value)}
                                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:ring-zinc-900"
                                  placeholder="OpenAI headline plan"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                                  Shared Subheadline
                                </label>
                                <textarea
                                  value={state.socialPostSubheadlinePlans[index] || ''}
                                  onChange={(event) => updatePlannedCopy(index, 'subheadline', event.target.value)}
                                  rows={3}
                                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:ring-zinc-900"
                                  placeholder="OpenAI subheadline plan"
                                />
                              </div>
                            </div>

                            {state.socialPostPromptPlans[index] ? (
                              <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                                  <LayoutTemplate className="w-3.5 h-3.5" />
                                  Planned Prompt
                                </div>
                                <p className="mt-2 text-[11px] leading-5 text-zinc-600 line-clamp-5">
                                  {state.socialPostPromptPlans[index]}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500">
                            Run Plan shared copy to generate editable lockup text and the Gemini planner prompt for this variation.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => toggleSection('output')}
            className="flex items-center justify-between w-full text-left group"
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-900 group-hover:text-zinc-600 transition-colors">
              Current Output
            </h2>
            {expandedSections.output ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.output && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-sm font-medium text-zinc-900">{activePlatform.label}</div>
              <div className="mt-1 text-xs leading-5 text-zinc-600">
                Theme: <span className="font-medium text-zinc-800">{state.socialPostTheme}</span>
                {' · '}
                Category: <span className="font-medium text-zinc-800">{CATEGORY_OPTIONS.find((option) => option.value === state.socialPostCategory)?.label}</span>
                {' · '}
                Language: <span className="font-medium text-zinc-800">{LANGUAGE_OPTIONS.find((option) => option.value === state.socialPostLanguage)?.label}</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="p-4 border-t border-zinc-100 bg-white">
        <div className="space-y-2">
          <button
            onClick={onPlanCopy}
            disabled={isBusy || !openAiConfigured}
            className="flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPlanningCopy ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Planning shared copy...
              </span>
            ) : (
              <span className="flex items-center">
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Plan shared copy
              </span>
            )}
          </button>

          <button
            onClick={onGenerateVisuals}
            disabled={isBusy || !geminiConfigured || !hasPlannedCopy}
            className="flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGeneratingVisuals ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating 4 visuals...
              </span>
            ) : (
              <span className="flex items-center">
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate 4 visuals
              </span>
            )}
          </button>

          <p className="px-1 text-[11px] leading-5 text-zinc-500">
            Review or edit the shared headline and subheadline first. Generate 4 visuals uses the same copy with different planned Gemini prompts.
          </p>
        </div>
      </div>
    </div>
  );
}
