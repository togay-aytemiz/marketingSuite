export interface IntegrationStatus {
  openai: {
    configured: boolean;
    missing: string[];
  };
  gemini: {
    configured: boolean;
    missing: string[];
  };
  sanity: {
    configured: boolean;
    missing: string[];
    dataset: string;
    projectId: string | null;
    apiVersion: string;
  };
  qualy: {
    configured: boolean;
    projectPath: string | null;
  };
}

export interface IntegrationEndpointCheck {
  key: string;
  label: string;
  endpoint: string;
  ok: boolean;
  status: number | null;
  message: string;
}

export interface StrategyContextSnapshot {
  available: boolean;
  promptText: string;
  sourcePath: string | null;
}

export interface VisualContextSnapshot {
  strategyAvailable: boolean;
  strategyPromptText: string;
  strategySourcePath: string | null;
  realityAvailable: boolean;
  realityPromptText: string;
  realitySourcePaths: string[];
}

export const defaultIntegrationStatus: IntegrationStatus = {
  openai: {
    configured: false,
    missing: ['OPENAI_API_KEY'],
  },
  gemini: {
    configured: false,
    missing: ['GEMINI_API_KEY'],
  },
  sanity: {
    configured: false,
    missing: ['SANITY_PROJECT_ID', 'SANITY_TOKEN'],
    dataset: 'production',
    projectId: null,
    apiVersion: '2026-03-01',
  },
  qualy: {
    configured: false,
    projectPath: null,
  },
};

function normalizeIntegrationStatus(raw: unknown): IntegrationStatus {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const openai = value.openai && typeof value.openai === 'object'
    ? (value.openai as Record<string, unknown>)
    : {};
  const gemini = value.gemini && typeof value.gemini === 'object'
    ? (value.gemini as Record<string, unknown>)
    : {};
  const sanity = value.sanity && typeof value.sanity === 'object'
    ? (value.sanity as Record<string, unknown>)
    : {};
  const qualy = value.qualy && typeof value.qualy === 'object'
    ? (value.qualy as Record<string, unknown>)
    : {};

  return {
    openai: {
      configured: typeof openai.configured === 'boolean' ? openai.configured : defaultIntegrationStatus.openai.configured,
      missing: Array.isArray(openai.missing)
        ? openai.missing.filter((item): item is string => typeof item === 'string')
        : defaultIntegrationStatus.openai.missing,
    },
    gemini: {
      configured: typeof gemini.configured === 'boolean' ? gemini.configured : defaultIntegrationStatus.gemini.configured,
      missing: Array.isArray(gemini.missing)
        ? gemini.missing.filter((item): item is string => typeof item === 'string')
        : defaultIntegrationStatus.gemini.missing,
    },
    sanity: {
      configured: typeof sanity.configured === 'boolean' ? sanity.configured : defaultIntegrationStatus.sanity.configured,
      missing: Array.isArray(sanity.missing)
        ? sanity.missing.filter((item): item is string => typeof item === 'string')
        : defaultIntegrationStatus.sanity.missing,
      dataset: typeof sanity.dataset === 'string' ? sanity.dataset : defaultIntegrationStatus.sanity.dataset,
      projectId:
        typeof sanity.projectId === 'string' || sanity.projectId === null
          ? (sanity.projectId as string | null)
          : defaultIntegrationStatus.sanity.projectId,
      apiVersion: typeof sanity.apiVersion === 'string' ? sanity.apiVersion : defaultIntegrationStatus.sanity.apiVersion,
    },
    qualy: {
      configured: typeof qualy.configured === 'boolean' ? qualy.configured : defaultIntegrationStatus.qualy.configured,
      projectPath:
        typeof qualy.projectPath === 'string' || qualy.projectPath === null
          ? (qualy.projectPath as string | null)
          : defaultIntegrationStatus.qualy.projectPath,
    },
  };
}

export async function fetchIntegrationStatus(): Promise<IntegrationStatus> {
  const response = await fetch('/api/integrations/status');
  if (!response.ok) {
    throw new Error(response.statusText || 'Failed to fetch integration status.');
  }

  const payload = await response.json();
  return normalizeIntegrationStatus(payload);
}

export async function fetchStrategyContext(): Promise<StrategyContextSnapshot> {
  const response = await fetch('/api/strategy/context', {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(response.statusText || 'Failed to fetch strategy context.');
  }

  const payload = await response.json();
  return {
    available: payload?.available === true,
    promptText: typeof payload?.promptText === 'string' ? payload.promptText : '',
    sourcePath: typeof payload?.sourcePath === 'string' ? payload.sourcePath : null,
  };
}

export async function fetchVisualContext(): Promise<VisualContextSnapshot> {
  const response = await fetch('/api/visual/context', {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(response.statusText || 'Failed to fetch visual context.');
  }

  const payload = await response.json();
  return {
    strategyAvailable: payload?.strategyAvailable === true,
    strategyPromptText: typeof payload?.strategyPromptText === 'string' ? payload.strategyPromptText : '',
    strategySourcePath: typeof payload?.strategySourcePath === 'string' ? payload.strategySourcePath : null,
    realityAvailable: payload?.realityAvailable === true,
    realityPromptText: typeof payload?.realityPromptText === 'string' ? payload.realityPromptText : '',
    realitySourcePaths: Array.isArray(payload?.realitySourcePaths)
      ? payload.realitySourcePaths.filter((item: unknown): item is string => typeof item === 'string')
      : [],
  };
}

async function parseEndpointError(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parse failures.
  }

  return response.statusText || 'Request failed.';
}

async function runEndpointCheck(key: string, label: string, endpoint: string): Promise<IntegrationEndpointCheck> {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        key,
        label,
        endpoint,
        ok: false,
        status: response.status,
        message: await parseEndpointError(response),
      };
    }

    return {
      key,
      label,
      endpoint,
      ok: true,
      status: response.status,
      message: 'OK',
    };
  } catch (error) {
    return {
      key,
      label,
      endpoint,
      ok: false,
      status: null,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function checkIntegrationEndpoints(): Promise<IntegrationEndpointCheck[]> {
  const checks = await Promise.all([
    runEndpointCheck('integration-status', 'Integration Status API', '/api/integrations/status'),
    runEndpointCheck('strategy-context', 'Strategy Context API', '/api/strategy/context'),
    runEndpointCheck('sanity-categories', 'Sanity Categories API', '/api/sanity/categories?language=tr'),
    runEndpointCheck('sanity-posts', 'Sanity Posts API', '/api/sanity/posts'),
  ]);

  return checks;
}
