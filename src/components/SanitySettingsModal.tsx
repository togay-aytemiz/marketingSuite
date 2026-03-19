import React from 'react';
import { X, Database, Info } from 'lucide-react';
import type { IntegrationStatus } from '../services/integrations';

interface SanitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  integrationStatus: IntegrationStatus;
  onRefreshStatus: () => Promise<void> | void;
}

export function SanitySettingsModal({ isOpen, onClose, integrationStatus, onRefreshStatus }: SanitySettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-zinc-100">
        <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Sanity Integration</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors bg-zinc-50 hover:bg-zinc-100 p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="bg-indigo-50 text-indigo-800 p-4 rounded-xl flex gap-3 items-start">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Backend Configuration Required</p>
              <p className="text-xs opacity-90 leading-relaxed">
                Sanity credentials and optional Qualy blog refresh are now handled by the local backend.
                Missing vars can be added to <code>.env.local</code> before restarting the app.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className={`rounded-xl border px-4 py-3 ${integrationStatus.sanity.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <p className="font-medium">Sanity {integrationStatus.sanity.configured ? 'connected' : 'not configured'}</p>
              <p className="text-xs mt-1 leading-relaxed">
                Dataset: <code>{integrationStatus.sanity.dataset}</code>
                {integrationStatus.sanity.projectId ? <> | Project: <code>{integrationStatus.sanity.projectId}</code></> : null}
              </p>
              {!integrationStatus.sanity.configured && (
                <p className="text-xs mt-2">Eksik degiskenler: <code>{integrationStatus.sanity.missing.join(', ')}</code></p>
              )}
            </div>

            <div className={`rounded-xl border px-4 py-3 ${integrationStatus.qualy.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>
              <p className="font-medium">Qualy blog refresh {integrationStatus.qualy.configured ? 'available' : 'not configured'}</p>
              <p className="text-xs mt-1 leading-relaxed">
                {integrationStatus.qualy.projectPath
                  ? <>Path: <code>{integrationStatus.qualy.projectPath}</code></>
                  : 'Otomatik blog:generate icin QUALY_LP_PATH tanimlanabilir.'}
              </p>
            </div>

            <div className={`rounded-xl border px-4 py-3 ${integrationStatus.gemini.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>
              <p className="font-medium">Gemini AI {integrationStatus.gemini.configured ? 'ready' : 'not configured'}</p>
              {!integrationStatus.gemini.configured && (
                <p className="text-xs mt-1 leading-relaxed">AI generate islemleri icin <code>GEMINI_API_KEY</code> eklemen yeterli.</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-zinc-100 bg-white flex justify-between">
          <button
            onClick={() => void onRefreshStatus()}
            className="px-5 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Refresh Status
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
