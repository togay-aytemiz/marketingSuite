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

export async function fetchIntegrationStatus(): Promise<IntegrationStatus> {
  const response = await fetch('/api/integrations/status');
  if (!response.ok) {
    throw new Error(response.statusText || 'Failed to fetch integration status.');
  }

  return (await response.json()) as IntegrationStatus;
}
