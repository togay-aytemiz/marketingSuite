import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { Upload, Image as ImageIcon, X, Settings, Info, ChevronDown, ChevronRight, Wand2, LayoutTemplate, Monitor, Smartphone, Linkedin, Loader2, Sparkles, Link as LinkIcon, PanelLeftClose, PanelLeftOpen, PenTool } from 'lucide-react';
import { buildPrompt, generateCopyIdeas, extractColorPalette, generateTopicIdeas } from '../services/gemini';
import type { IntegrationStatus } from '../services/integrations';

const PRESETS = [
  {
    id: 'linkedin',
    name: 'LinkedIn Promo',
    icon: <Linkedin className="w-4 h-4" />,
    settings: { aspectRatio: '1:1', mode: 'Clean Screenshot Highlight', designStyle: 'Clean SaaS', tone: 'Professional', campaignType: 'Feature announcement' }
  },
  {
    id: 'ig_story',
    name: 'Instagram Story',
    icon: <Smartphone className="w-4 h-4" />,
    settings: { aspectRatio: '4:5', mode: 'Social Media Promo', designStyle: 'Gradient startup', tone: 'Playful', campaignType: 'Product promotion' }
  },
  {
    id: 'web_hero',
    name: 'Website Hero',
    icon: <Monitor className="w-4 h-4" />,
    settings: { aspectRatio: '16:9', mode: 'Device Mockup', designStyle: 'Apple-style minimal', tone: 'Premium', campaignType: 'Landing page visual' }
  }
];

interface SidebarProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onGenerate: () => void;
  isGenerating: boolean;
  onOpenSettings: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  integrationStatus: IntegrationStatus;
}

export function Sidebar({ state, setState, onGenerate, isGenerating, onOpenSettings, isSidebarOpen, setIsSidebarOpen, integrationStatus }: SidebarProps) {
  const [isPromptModalOpen, setPromptModalOpen] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copyIdeas, setCopyIdeas] = useState<{headlines: string[], subheadlines: string[], ctas: string[]} | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    presets: false,
    assets: true,
    copy: false,
    design: false,
    blogContent: true,
    blogPreferences: false
  });
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [topicIdeas, setTopicIdeas] = useState<{topic: string, keywords: string}[]>([]);
  const openAiConfigured = integrationStatus.openai.configured;
  const geminiConfigured = integrationStatus.gemini.configured;
  const sanityConfigured = integrationStatus.sanity.configured;

  useEffect(() => {
    if (isGenerating) {
      setTopicIdeas([]);
    }
  }, [isGenerating]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setState(prev => ({ ...prev, ...(preset.settings as Partial<AppState>), activePreset: preset.id }));
  };

  const isProductDetailsEmpty = !state.productName.trim() && !state.featureName.trim() && !state.description.trim();

  const handleGenerateCopy = async () => {
    if (isProductDetailsEmpty) return;
    setIsGeneratingCopy(true);
    const ideas = await generateCopyIdeas(
      state.productName,
      state.featureName,
      state.description,
      state.campaignType,
      state.tone,
      state.language
    );
    if (ideas) {
      setCopyIdeas(ideas);
    }
    setIsGeneratingCopy(false);
  };

  const applyCopyIdea = (type: 'headline' | 'subheadline' | 'cta', text: string) => {
    setState(prev => ({ ...prev, [type]: text }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setState((prev) => ({ ...prev, [name]: checked }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages: string[] = [];
      let loadedCount = 0;
      
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          newImages.push(base64);
          loadedCount++;
          if (loadedCount === files.length) {
            setState((prev) => ({ 
              ...prev, 
              images: [...prev.images, ...newImages]
            }));
            
            // Extract palette from the first uploaded image
            if (state.autoBrandColor && geminiConfigured && newImages[0]) {
              const palette = await extractColorPalette(newImages[0]);
              if (palette && palette.length > 0) {
                setState(prev => ({ ...prev, colorPalette: palette, brandColor: palette[0] }));
              }
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (indexToRemove: number) => {
    setState((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== indexToRemove)
    }));
  };

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setState((prev) => ({ 
          ...prev, 
          referenceImage: base64
        }));
        
        // Extract palette from reference image
        if (state.autoBrandColor && geminiConfigured) {
          const palette = await extractColorPalette(base64);
          if (palette && palette.length > 0) {
            setState(prev => ({ ...prev, colorPalette: palette, brandColor: palette[0] }));
          }
        }
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const removeReferenceImage = () => {
    setState((prev) => ({
      ...prev,
      referenceImage: null
    }));
  };

  const handleGenerateTopics = async () => {
    setIsGeneratingTopics(true);

    const newIdeas = await generateTopicIdeas(
      state.productName,
      state.featureName,
      state.targetAudience,
      state.description,
      state.language,
      topicIdeas.map((idea) => idea.topic),
      [],
      []
    );

    if (newIdeas) {
      setTopicIdeas(prev => [...prev, ...newIdeas]);
    }

    setIsGeneratingTopics(false);
  };

  const selectTopic = (topic: string, keywords: string) => {
    setState(prev => ({
      ...prev,
      blogTopic: topic,
      blogKeywords: keywords
    }));
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

  const SidebarHeader = () => (
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
  );

  if (state.activeModule === 'blog') {
    return (
      <div className={`w-80 bg-white border-r border-zinc-200 h-screen flex flex-col shrink-0 z-30 transition-opacity duration-300 ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
        <SidebarHeader />
        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          
          {/* Content Strategy */}
          <div className="space-y-3">
            <button 
              onClick={() => toggleSection('blogContent')}
              className="flex items-center justify-between w-full text-left group"
            >
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">Content Strategy</h3>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${expandedSections.blogContent ? 'rotate-180' : ''}`} />
            </button>
            
            {expandedSections.blogContent && (
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-medium text-zinc-500">Topic / Instruction</label>
                    <button
                      onClick={handleGenerateTopics}
                      disabled={isGeneratingTopics || !openAiConfigured || (!state.productName && !state.description)}
                      className="flex items-center text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={openAiConfigured ? 'AI will suggest 5 topics based on Product Context' : 'Add OPENAI_API_KEY in .env.local to enable brainstorming'}
                    >
                      {isGeneratingTopics ? (
                        <svg className="animate-spin mr-1 h-3 w-3 text-indigo-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1" />
                      )}
                      {isGeneratingTopics ? 'Analyzing...' : (topicIdeas.length > 0 ? 'Generate More Ideas' : 'Brainstorm Ideas')}
                    </button>
                  </div>
                  <textarea
                    name="blogTopic"
                    value={state.blogTopic}
                    onChange={handleChange}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors resize-none h-20"
                    placeholder="e.g. We just released a new feature, write a post about it. (Leave blank for AI suggestion)"
                  />
                  
                  {/* Topic Suggestions Dropdown */}
                  {topicIdeas.length > 0 && (
                    <div className="mt-2 border border-indigo-100 bg-indigo-50/30 rounded-lg overflow-hidden shadow-sm">
                      <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                        <span className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider">Suggested Topics</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {topicIdeas.map((idea, idx) => {
                          const isSelected = state.blogTopic === idea.topic;
                          return (
                            <button
                              key={idx}
                              onClick={() => selectTopic(idea.topic, idea.keywords)}
                              className={`w-full text-left px-3 py-2.5 border-b border-indigo-50 last:border-0 transition-colors group ${
                                isSelected ? 'bg-indigo-100/50' : 'hover:bg-indigo-50/80'
                              }`}
                            >
                              <div className={`text-xs font-medium mb-1 leading-snug ${
                                isSelected ? 'text-indigo-900' : 'text-zinc-900 group-hover:text-indigo-700'
                              }`}>
                                {idea.topic}
                              </div>
                              <div className={`text-[10px] line-clamp-1 ${
                                isSelected ? 'text-indigo-600' : 'text-zinc-500'
                              }`}>
                                Keywords: {idea.keywords}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500">Additional Keywords (Optional)</label>
                  <input
                    type="text"
                    name="blogKeywords"
                    value={state.blogKeywords}
                    onChange={handleChange}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors"
                    placeholder="AI will auto-extract from Product Context"
                  />
                </div>
                {!openAiConfigured && (
                  <p className="text-[10px] text-amber-600 leading-relaxed">Blog brainstorming ve writer generate islemleri icin <code>OPENAI_API_KEY</code> gerekli.</p>
                )}
              </div>
            )}
          </div>

          {/* Writing Preferences */}
          <div className="space-y-3">
            <button 
              onClick={() => toggleSection('blogPreferences')}
              className="flex items-center justify-between w-full text-left group"
            >
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">Writing Preferences</h3>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${expandedSections.blogPreferences ? 'rotate-180' : ''}`} />
            </button>
            
            {expandedSections.blogPreferences && (
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500">Tone of Voice</label>
                  <select
                    name="blogTone"
                    value={state.blogTone}
                    onChange={handleChange}
                    className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                  >
                    <option>Professional & Informative</option>
                    <option>Casual & Conversational</option>
                    <option>Authoritative & Thought Leadership</option>
                    <option>Fun & Engaging</option>
                    <option>Storytelling</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500">Target Length</label>
                  <select
                    name="blogLength"
                    value={state.blogLength}
                    onChange={handleChange}
                    className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                  >
                    <option>Short (500 words)</option>
                    <option>Medium (1000 words)</option>
                    <option>Long (1500+ words)</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500">Language</label>
                  <select
                    name="language"
                    value={state.language}
                    onChange={handleChange}
                    className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                  >
                    <option value="EN">English</option>
                    <option value="TR">Turkish</option>
                    <option value="BOTH">Both (TR & EN)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500">Image Style</label>
                  <select
                    name="blogImageStyle"
                    value={state.blogImageStyle}
                    onChange={handleChange}
                    className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                  >
                    <option value="OpenAI Style (Clean, abstract, vibrant gradients, tech-focused)">OpenAI Style (Abstract, Gradients)</option>
                    <option value="Minimalist (Lots of whitespace, simple geometry, muted colors)">Minimalist (Simple, Muted)</option>
                    <option value="3D Isometric (Playful, colorful, detailed 3D renders)">3D Isometric (Playful)</option>
                    <option value="Flat Illustration (Corporate memphis style, vector art)">Flat Illustration (Vector)</option>
                    <option value="Photorealistic (High quality photography, natural lighting)">Photorealistic</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                      <label className="block text-[11px] font-medium text-zinc-700">Auto-add Internal Links</label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="autoInternalLinks"
                        checked={state.autoInternalLinks}
                        onChange={(e) => setState(prev => ({ ...prev, autoInternalLinks: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                    {sanityConfigured
                      ? 'Manual "Add Internal Links" adiminda Sanity post havuzu kullanilabilir.'
                      : 'Sanity bagli degilse internal link havuzu bos kalir; publish ve post fetch icin once Sanity env degiskenlerini gir.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-100 bg-white flex gap-2">
          <button
            onClick={onGenerate}
            disabled={isGenerating || !openAiConfigured || (!state.productName && !state.blogTopic)}
            className="flex-1 flex items-center justify-center px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isGenerating ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              <span className="flex items-center">
                <PenTool className="w-4 h-4 mr-2" />
                Generate Blog Post
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-80 bg-white border-r border-zinc-200 h-screen flex flex-col shrink-0 z-30 transition-opacity duration-300 ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
      <SidebarHeader />
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* Presets */}
        <div className="space-y-3">
          <button 
            onClick={() => toggleSection('presets')}
            className="flex items-center justify-between w-full text-left group"
          >
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">1-Click Presets</h3>
            {expandedSections.presets ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>
          
          {expandedSections.presets && (
            <div className="grid grid-cols-1 gap-2 pt-1">
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                    state.activePreset === preset.id 
                      ? 'border-zinc-900 bg-zinc-50 text-zinc-900 shadow-sm' 
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${state.activePreset === preset.id ? 'bg-white shadow-sm' : 'bg-zinc-100'}`}>
                    {preset.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{preset.name}</p>
                    <p className="text-[10px] text-zinc-500">{preset.settings.aspectRatio} • {preset.settings.tone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visual Assets */}
        <div className="space-y-3">
          <button 
            onClick={() => toggleSection('assets')}
            className="flex items-center justify-between w-full text-left group"
          >
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">Visual Assets</h3>
            {expandedSections.assets ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>
          
          {expandedSections.assets && (
            <div className="space-y-5 pt-1">
              {/* Image Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-700">Screenshots</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {state.images.map((img, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-zinc-200 group aspect-video shadow-sm">
                      <img src={img} alt={`Uploaded ${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-zinc-700 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-zinc-200 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition-all">
                  <div className="flex flex-col items-center justify-center pt-3 pb-3">
                    <Upload className="w-4 h-4 text-zinc-400 mb-1" />
                    <p className="text-xs font-medium text-zinc-600">Upload screenshot(s)</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                </label>
              </div>

              {/* Reference Image Upload */}
              <div className="space-y-2 pt-3 border-t border-zinc-100">
                <label className="block text-xs font-medium text-zinc-700">Style Reference Image</label>
                <p className="text-[10px] text-zinc-500 leading-tight mb-2">Upload an image to guide the layout, typography, and overall aesthetic.</p>
                
                {state.referenceImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-zinc-200 group aspect-video shadow-sm">
                    <img src={state.referenceImage} alt="Style Reference" className="w-full h-full object-cover" />
                    <button
                      onClick={removeReferenceImage}
                      className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-zinc-700 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-zinc-200 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition-all">
                    <div className="flex flex-col items-center justify-center pt-3 pb-3">
                      <Upload className="w-4 h-4 text-zinc-400 mb-1" />
                      <p className="text-xs font-medium text-zinc-600">Upload reference image</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleReferenceImageUpload} />
                  </label>
                )}
              </div>
              {/* Color Palette */}
              {state.colorPalette.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-zinc-100">
                  <label className="block text-xs font-medium text-zinc-700">Extracted Palette</label>
                  <div className="flex gap-2">
                    {state.colorPalette.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => setState(prev => ({ ...prev, brandColor: color }))}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${state.brandColor === color ? 'border-zinc-900 scale-110' : 'border-transparent shadow-sm'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Marketing Copy */}
        <div className="space-y-3 pt-4 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => toggleSection('copy')}
              className="flex items-center gap-2 group"
            >
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">Marketing Copy</h3>
              {expandedSections.copy ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
            </button>
            <button
              onClick={handleGenerateCopy}
              disabled={isGeneratingCopy || isProductDetailsEmpty || !openAiConfigured}
              title={
                !openAiConfigured
                  ? 'Add OPENAI_API_KEY in .env.local to enable AI'
                  : isProductDetailsEmpty
                    ? 'Please enter Product Details in Settings first'
                    : 'Generate AI ideas'
              }
              className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingCopy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              AI Ideas
            </button>
          </div>
          
          {expandedSections.copy && (
            <div className="space-y-3 pt-1">
              {copyIdeas && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-semibold text-indigo-900 uppercase tracking-wider">AI Suggestions</h4>
                    <button onClick={() => setCopyIdeas(null)} className="text-indigo-400 hover:text-indigo-600"><X className="w-3 h-3" /></button>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] text-indigo-700 font-medium">Headlines</p>
                    <div className="flex flex-wrap gap-1">
                      {copyIdeas.headlines.map((h, i) => (
                        <button key={i} onClick={() => applyCopyIdea('headline', h)} className="text-[10px] bg-white border border-indigo-100 px-2 py-1 rounded text-left hover:border-indigo-300 hover:bg-indigo-50 transition-colors">{h}</button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] text-indigo-700 font-medium">Subheadlines</p>
                    <div className="flex flex-wrap gap-1">
                      {copyIdeas.subheadlines.map((s, i) => (
                        <button key={i} onClick={() => applyCopyIdea('subheadline', s)} className="text-[10px] bg-white border border-indigo-100 px-2 py-1 rounded text-left hover:border-indigo-300 hover:bg-indigo-50 transition-colors">{s}</button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] text-indigo-700 font-medium">CTAs</p>
                    <div className="flex flex-wrap gap-1">
                      {copyIdeas.ctas.map((c, i) => (
                        <button key={i} onClick={() => applyCopyIdea('cta', c)} className="text-[10px] bg-white border border-indigo-100 px-2 py-1 rounded text-left hover:border-indigo-300 hover:bg-indigo-50 transition-colors">{c}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Language</label>
                <select
                  name="language"
                  value={state.language}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option value="TR">Turkish (TR)</option>
                  <option value="EN">English (EN)</option>
                  <option value="BOTH">Both (TR & EN)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Headline (Optional)</label>
                <input
                  type="text"
                  name="headline"
                  value={state.headline}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors"
                  placeholder="Leave blank to auto-generate"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Subheadline (Optional)</label>
                <input
                  type="text"
                  name="subheadline"
                  value={state.subheadline}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors"
                  placeholder="Leave blank to auto-generate"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">CTA Text (Optional)</label>
                <input
                  type="text"
                  name="cta"
                  value={state.cta}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors"
                  placeholder="e.g. Try it for free"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Campaign Focus / Theme (Optional)</label>
                <input
                  type="text"
                  name="campaignFocus"
                  value={state.campaignFocus}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors"
                  placeholder="e.g. Focus on speed, Winter theme..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Custom Instructions (Optional)</label>
                <textarea
                  name="customInstruction"
                  value={state.customInstruction}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors resize-none"
                  placeholder="e.g. Add a subtle shadow..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Design Settings */}
        <div className="space-y-3 pt-4 border-t border-zinc-100">
          <button 
            onClick={() => toggleSection('design')}
            className="flex items-center justify-between w-full text-left group"
          >
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest group-hover:text-zinc-600 transition-colors">Design Settings</h3>
            {expandedSections.design ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>
          
          {expandedSections.design && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Platform</label>
                <select
                  name="platform"
                  value={state.platform}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option>LinkedIn</option>
                  <option>Instagram</option>
                  <option>X</option>
                  <option>Website</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Aspect Ratio</label>
                <select
                  name="aspectRatio"
                  value={state.aspectRatio}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option value="1:1">1:1 (Square)</option>
                  <option value="4:5">4:5 (Portrait)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Campaign Type</label>
                <select
                  name="campaignType"
                  value={state.campaignType}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option>Feature announcement</option>
                  <option>Product promotion</option>
                  <option>Update release</option>
                  <option>Tutorial</option>
                  <option>Landing page visual</option>
                  <option>Customer success story</option>
                  <option>Webinar / Event invite</option>
                  <option>Special offer / Discount</option>
                  <option>Behind the scenes / Teaser</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Tone</label>
                <select
                  name="tone"
                  value={state.tone}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option>Professional</option>
                  <option>Playful</option>
                  <option>Minimal</option>
                  <option>Premium</option>
                  <option>Urgent / Action-oriented</option>
                  <option>Empathetic / Human</option>
                  <option>Disruptive / Rebellious</option>
                  <option>Academic / Data-driven</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Mode</label>
                <select
                  name="mode"
                  value={state.mode}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option>Clean Screenshot Highlight</option>
                  <option>Device Mockup</option>
                  <option>Feature Spotlight</option>
                  <option>Social Media Promo</option>
                  <option>AI Generated Background</option>
                  <option>Isometric 3D</option>
                  <option>Bento Box Grid</option>
                  <option>Billboard / Out-of-Home</option>
                  <option>Magazine Editorial</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">Design Style</label>
                <select
                  name="designStyle"
                  value={state.designStyle}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 pr-8 border border-zinc-200 rounded-md shadow-sm focus:ring-zinc-900 focus:border-zinc-900 text-xs transition-colors appearance-none bg-white"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                >
                  <option>Clean SaaS</option>
                  <option>Gradient startup</option>
                  <option>Dark mode</option>
                  <option>Apple-style minimal</option>
                  <option>Neo-Brutalism</option>
                  <option>Glassmorphism</option>
                  <option>Cyberpunk / Sci-Fi</option>
                  <option>Organic / Earthy</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-zinc-100 bg-white flex gap-2">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !geminiConfigured}
          className="flex-1 flex items-center justify-center px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isGenerating ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            <span className="flex items-center">
              <ImageIcon className="w-4 h-4 mr-2" />
              Generate
            </span>
          )}
        </button>
        <button 
          onClick={() => setPromptModalOpen(true)}
          className="p-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 rounded-xl transition-colors shadow-sm flex items-center justify-center"
          title="View Prompt"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Dynamic Prompt Preview</h2>
                  <p className="text-sm text-zinc-500">This is the exact prompt that will be sent to the LLM.</p>
                </div>
              </div>
              <button 
                onClick={() => setPromptModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-zinc-50">
              <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-700 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                {buildPrompt(
                  state.images,
                  state.productName,
                  state.featureName,
                  state.description,
                  state.headline,
                  state.subheadline,
                  state.cta,
                  state.brandColor,
                  state.campaignType,
                  state.aspectRatio,
                  state.tone,
                  state.designStyle,
                  state.mode,
                  state.language,
                  state.customInstruction,
                  state.campaignFocus,
                  0, // variationIndex
                  undefined,
                  undefined,
                  state.referenceImage
                )}
              </pre>
            </div>
            <div className="p-6 border-t border-zinc-100 bg-white flex justify-end">
              <button
                onClick={() => setPromptModalOpen(false)}
                className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
