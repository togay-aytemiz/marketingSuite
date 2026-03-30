import React from 'react';
import { X, Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { IntegrationStatus, IntegrationEndpointCheck } from '../services/integrations';

interface IntegrationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  integrationStatus: IntegrationStatus;
  onRefreshStatus: () => Promise<void> | void;
  onSyncCategories: () => Promise<void> | void;
  isRefreshingStatus?: boolean;
  isSyncingCategories?: boolean;
  endpointChecks?: IntegrationEndpointCheck[];
  categorySyncStatus?: string | null;
}

export function IntegrationSettingsModal({
  isOpen,
  onClose,
  integrationStatus,
  onRefreshStatus,
  onSyncCategories,
  isRefreshingStatus = false,
  isSyncingCategories = false,
  endpointChecks = [],
  categorySyncStatus = null,
}: IntegrationSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-zinc-100">
        <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">Integrations</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors bg-zinc-50 hover:bg-zinc-100 p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="space-y-3 text-sm">
            <div className={`rounded-xl border px-4 py-3 ${integrationStatus.openai.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <p className="font-medium">OpenAI Text AI {integrationStatus.openai.configured ? 'ready' : 'not configured'}</p>
              {integrationStatus.openai.configured && (
                <p className="text-xs mt-1 leading-relaxed">Visual Creator copy ve prompt planning, blog metin ve karar akisi burada calisir.</p>
              )}
              {!integrationStatus.openai.configured && (
                <p className="text-xs mt-1 leading-relaxed">Visual Creator copy ve prompt planning ile blog metin/karar akislarini acmak icin <code>OPENAI_API_KEY</code> eklenmeli.</p>
              )}
            </div>

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
              {integrationStatus.gemini.configured && (
                <p className="text-xs mt-1 leading-relaxed">Visual Creator final image render ve blog image generate islemleri burada calisir.</p>
              )}
              {!integrationStatus.gemini.configured && (
                <p className="text-xs mt-1 leading-relaxed">Visual Creator final render ve blog image generate islemleri icin <code>GEMINI_API_KEY</code> eklemen yeterli.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest">Endpoint Health</h3>

            {endpointChecks.length === 0 && !isRefreshingStatus && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                Henüz endpoint check yapılmadı. <b>Refresh Status</b> ile kontrol edebilirsin.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {endpointChecks.map((check) => (
                <div
                  key={check.key}
                  className={`rounded-xl border px-4 py-3 ${
                    check.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="text-[11px] opacity-80 mt-0.5">{check.endpoint}</p>
                    </div>
                    {check.ok ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs mt-2 leading-relaxed">
                    {check.status ? `HTTP ${check.status}` : 'Network'} - {check.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-zinc-100 bg-white flex justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onRefreshStatus()}
              disabled={isRefreshingStatus}
              className="px-5 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isRefreshingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking endpoints...
                </>
              ) : (
                'Refresh Status'
              )}
            </button>
            <button
              onClick={() => void onSyncCategories()}
              disabled={!integrationStatus.sanity.configured || isSyncingCategories}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              title={!integrationStatus.sanity.configured ? 'Sanity yapılandırılmadan category sync çalışmaz.' : undefined}
            >
              {isSyncingCategories ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing categories...
                </>
              ) : (
                'Sync Categories'
              )}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
        {categorySyncStatus && (
          <div className="px-6 pb-4 text-xs text-zinc-600">
            {categorySyncStatus}
          </div>
        )}
      </div>
    </div>
  );
}
