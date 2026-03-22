export interface SanitySiteRefreshStatus {
  attempted: boolean;
  succeeded: boolean;
  projectPath: string | null;
  message: string;
}

function buildLocalProjectPrefix(projectPath: string | null | undefined) {
  const normalized = String(projectPath || '').trim();
  return normalized ? `${normalized} altindaki ` : '';
}

export function buildSanityPublishMessage(siteRefresh?: SanitySiteRefreshStatus | null) {
  if (!siteRefresh?.attempted) {
    return "Sanity'e gonderildi.";
  }

  const projectPrefix = buildLocalProjectPrefix(siteRefresh.projectPath);
  if (siteRefresh.succeeded) {
    return `Sanity'e gonderildi. ${projectPrefix}local Qualy blog dosyalari yenilendi. Canli sitede gormek icin ayrica deploy etmen gerekir.`;
  }

  return `Sanity'e gonderildi. ${projectPrefix}local blog refresh basarisiz: ${siteRefresh.message}`;
}
