import dotenv from 'dotenv';

export interface IntegrationStatus {
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
}

let envLoaded = false;

export function loadLocalEnv() {
  if (envLoaded) {
    return;
  }

  dotenv.config({ path: '.env.local' });
  dotenv.config();
  envLoaded = true;
}

export function getGeminiApiKey(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env.GEMINI_API_KEY || env.API_KEY || null;
}

export function getSanityToken(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env.SANITY_TOKEN || env.SANITY_API_TOKEN || env.SANITY_API_KEY || null;
}

export function getIntegrationStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): IntegrationStatus {
  const geminiKey = getGeminiApiKey(env);
  const sanityProjectId = env.SANITY_PROJECT_ID || null;
  const sanityToken = getSanityToken(env);
  const sanityDataset = env.SANITY_DATASET || 'production';
  const sanityApiVersion = env.SANITY_API_VERSION || '2023-08-01';

  return {
    gemini: {
      configured: Boolean(geminiKey),
      missing: geminiKey ? [] : ['GEMINI_API_KEY'],
    },
    sanity: {
      configured: Boolean(sanityProjectId && sanityToken),
      missing: [
        ...(sanityProjectId ? [] : ['SANITY_PROJECT_ID']),
        ...(sanityToken ? [] : ['SANITY_TOKEN']),
      ],
      dataset: sanityDataset,
      projectId: sanityProjectId,
      apiVersion: sanityApiVersion,
    },
  };
}
