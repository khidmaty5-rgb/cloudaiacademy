import config from '../../academy.config.json';

// Deployment identity is shared by server and client; never put secrets here.
export const academy = config;
export type AcademyFeature = keyof typeof academy.features;
export function featureForPath(path: string): AcademyFeature | null {
  const within = (prefix: string) => path === prefix || path.startsWith(prefix + '/');
  if (['/journal', '/reviewer', '/admin/journal', '/api/journal', '/api/reviewer'].some(within)) return 'journal';
  if (['/research', '/api/research'].some(within)) return 'research';
  if (['/live', '/api/live'].some(within)) return 'liveTeaching';
  if (['/certificates', '/admin/certificates', '/api/certificates'].some(within)) return 'certificates';
  if (within('/learning-path')) return 'learningPaths';
  if (within('/dashboard/telegram') || within('/api/telegram') || within('/api/n8n/telegram')) return 'telegram';
  // Webhooks must remain available to reconcile existing subscriptions/refunds.
  if (within('/api/billing/course-checkout') || within('/api/billing/checkout')) return 'payments';
  return null;
}
export function academyPathEnabled(path: string): boolean {
  const feature = featureForPath(path);
  return feature === null || academy.features[feature];
}
