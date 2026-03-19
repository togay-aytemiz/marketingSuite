import React, { useState } from 'react';
import { AppState } from '../types';
import { X, Sparkles } from 'lucide-react';
import { enhanceProductDetails } from '../services/gemini';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  geminiConfigured: boolean;
}

export function SettingsModal({ isOpen, onClose, state, setState, geminiConfigured }: SettingsModalProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setState((prev) => ({ ...prev, [name]: checked }));
  };

  const handleEnhance = async () => {
    setIsEnhancing(true);
    const enhancedDescription = await enhanceProductDetails(state.productName, state.featureName, state.targetAudience, state.description);
    if (enhancedDescription) {
      setState(prev => ({
        ...prev,
        description: enhancedDescription
      }));
    }
    setIsEnhancing(false);
  };

  const canEnhance = geminiConfigured && state.description.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-zinc-100">
        <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Product Context</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors bg-zinc-50 hover:bg-zinc-100 p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Product Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-500">Product Name</label>
              <input
                type="text"
                name="productName"
                value={state.productName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-colors"
                placeholder="e.g. Acme SaaS"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-500">Feature Name (Optional)</label>
              <input
                type="text"
                name="featureName"
                value={state.featureName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-colors"
                placeholder="e.g. AI Analytics"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-500">Target Audience (Optional)</label>
              <input
                type="text"
                name="targetAudience"
                value={state.targetAudience}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-colors"
                placeholder="e.g. Marketing Managers, Developers, etc."
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-zinc-500">Description</label>
                <button
                  onClick={handleEnhance}
                  disabled={!canEnhance || isEnhancing}
                  className="flex items-center text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={geminiConfigured ? 'Use AI to rewrite and improve this description' : 'Add GEMINI_API_KEY in .env.local to enable AI'}
                >
                  {isEnhancing ? (
                    <svg className="animate-spin mr-1 h-3 w-3 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
                </button>
              </div>
              <textarea
                name="description"
                value={state.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm resize-none transition-colors"
                placeholder="Briefly describe what this feature or product does. The more detail you provide, the better the AI will understand your context."
              />
              {!geminiConfigured && (
                <p className="text-[11px] text-amber-600">AI enhancement kapali. Lokal .env dosyana <code>GEMINI_API_KEY</code> ekledikten sonra aktif olur.</p>
              )}
            </div>
          </div>

          {/* Brand Settings */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest">Brand Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-500">Brand Color</label>
                <div className="flex items-center">
                  <input
                    id="autoBrandColor"
                    name="autoBrandColor"
                    type="checkbox"
                    checked={state.autoBrandColor}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-zinc-900 focus:ring-zinc-900 border-zinc-300 rounded transition-colors"
                  />
                  <label htmlFor="autoBrandColor" className="ml-2 block text-xs text-zinc-500">
                    AI Auto-detect
                  </label>
                </div>
              </div>
              
              {!state.autoBrandColor && (
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    name="brandColor"
                    value={state.brandColor}
                    onChange={handleChange}
                    className="h-9 w-9 rounded-lg cursor-pointer border-0 p-0 shrink-0"
                  />
                  <input
                    type="text"
                    name="brandColor"
                    value={state.brandColor}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm uppercase transition-colors"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-zinc-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
