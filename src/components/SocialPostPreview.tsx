import React, { useState } from 'react';
import { Download, Loader2, Wand2 } from 'lucide-react';

import { cn } from '../lib/utils';
import {
  type SocialPostCategory,
  type SocialPostLanguage,
  getSocialPostPreviewMeta,
} from '../lib/social-post-prompt';

interface SocialPostPreviewProps {
  platform: 'Instagram' | 'LinkedIn';
  category: SocialPostCategory;
  language: SocialPostLanguage;
  visual: string | null;
  variationIndex: number;
  aspectRatio: '1:1' | '4:5';
  isGenerating?: boolean;
  onRegenerate?: (index: number, comment: string) => void | Promise<void>;
}

export const SocialPostPreview: React.FC<SocialPostPreviewProps> = ({
  platform,
  category,
  language,
  visual,
  variationIndex,
  aspectRatio,
  isGenerating,
  onRegenerate,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [comment, setComment] = useState('');
  const previewMeta = getSocialPostPreviewMeta({
    category,
    language,
    platform,
    variationIndex,
  });

  const aspectRatioClass = {
    '1:1': 'aspect-square',
    '4:5': 'aspect-[4/5]',
  }[aspectRatio];

  const handleDownload = async () => {
    if (!visual) {
      return;
    }

    try {
      setIsDownloading(true);
      const link = document.createElement('a');
      link.download = `${platform.toLowerCase()}-post-${variationIndex + 1}.png`;
      link.href = visual;
      link.click();
    } catch (error) {
      console.error('Failed to download social post visual', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRegenerate = () => {
    if (!onRegenerate) {
      return;
    }

    onRegenerate(variationIndex, comment);
    setComment('');
  };

  return (
    <div className="flex flex-col items-center w-full mx-auto gap-3">
      <div className="flex w-full items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{previewMeta.badge}</p>
          <h3 className="mt-1 text-sm font-semibold text-zinc-900 tracking-wide">{previewMeta.title}</h3>
          <p className="mt-1 text-[11px] text-zinc-500">{previewMeta.subtitle}</p>
        </div>
      </div>

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm flex items-center justify-center transition-all duration-300',
          aspectRatioClass
        )}
      >
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center text-zinc-500">
            <Loader2 className="mb-3 h-6 w-6 animate-spin text-zinc-400" />
            <p className="text-xs font-medium uppercase tracking-wider">Generating social post...</p>
          </div>
        ) : visual ? (
          <img src={visual} alt={`Social post ${variationIndex + 1}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-400">
            <p className="text-xs uppercase tracking-wider">Pending generation</p>
          </div>
        )}
      </div>

      {visual && !isGenerating ? (
        <div className="w-full flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
          <input
            type="text"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What should change in this variation?"
            className="flex-1 border-none bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:ring-0"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleRegenerate();
              }
            }}
          />
          <button
            onClick={handleRegenerate}
            disabled={!comment.trim() || isGenerating}
            className="flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Magic Edit
          </button>
          <div className="mx-1 h-6 w-px bg-zinc-200" />
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : null}
    </div>
  );
};
