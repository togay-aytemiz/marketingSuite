import React, { useState } from 'react';
import { AppState } from '../types';
import { cn } from '../lib/utils';
import { Download, Loader2, Wand2 } from 'lucide-react';

interface VisualPreviewProps {
  state: AppState;
  variationIndex: number;
  isGenerating?: boolean;
  onRegenerate?: (index: number, comment: string) => void | Promise<void>;
}

export const VisualPreview: React.FC<VisualPreviewProps> = ({ state, variationIndex, isGenerating, onRegenerate }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [comment, setComment] = useState('');
  const finalVisual = state.finalVisuals[variationIndex];

  const handleDownload = async () => {
    if (!finalVisual) return;
    try {
      setIsDownloading(true);
      const link = document.createElement('a');
      link.download = `saas-visual-${state.productName || 'export'}-${variationIndex + 1}.png`;
      link.href = finalVisual;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Determine aspect ratio classes
  const aspectRatioClass = {
    '1:1': 'aspect-square',
    '4:5': 'aspect-[4/5]',
    '16:9': 'aspect-video',
  }[state.aspectRatio];

  const handleRegenerateClick = () => {
    if (onRegenerate) {
      onRegenerate(variationIndex, comment);
      setComment('');
    }
  };

  return (
    <div className="flex flex-col items-center w-full mx-auto gap-3">
      <div className="flex justify-between w-full items-center px-1">
        <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-widest">
          Variation {variationIndex + 1}
          {variationIndex === 3 && <span className="ml-3 text-[10px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full uppercase tracking-wider">Creative</span>}
        </h3>
      </div>

      {/* The Visual Container */}
      <div
        className={cn(
          "relative w-full overflow-hidden shadow-sm rounded-2xl bg-zinc-50 flex items-center justify-center transition-all duration-300 border border-zinc-200",
          aspectRatioClass
        )}
      >
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mb-3 text-zinc-400" />
            <p className="text-xs font-medium uppercase tracking-wider">Generating visual...</p>
          </div>
        ) : finalVisual ? (
          <img src={finalVisual} alt={`Variation ${variationIndex + 1}`} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-400">
            <p className="text-xs uppercase tracking-wider">Pending generation</p>
          </div>
        )}
      </div>

      {/* Action Bar */}
      {finalVisual && !isGenerating && (
        <div className="w-full flex items-center gap-2 bg-white border border-zinc-200 rounded-xl p-2 shadow-sm">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What to change? (e.g. make background blue)"
            className="flex-1 px-3 py-2 text-sm bg-transparent border-none focus:ring-0 text-zinc-900 placeholder-zinc-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRegenerateClick();
              }
            }}
          />
          <button
            onClick={handleRegenerateClick}
            disabled={isGenerating || !comment.trim()}
            className="flex items-center px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Apply magic edit"
          >
            <Wand2 className="w-3.5 h-3.5 mr-1.5" />
            Magic Edit
          </button>
          <div className="w-px h-6 bg-zinc-200 mx-1"></div>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center px-3 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors"
          >
            {isDownloading ? (
              <Loader2 className="animate-spin h-3.5 w-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
