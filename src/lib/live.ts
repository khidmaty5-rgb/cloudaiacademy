import type { Course } from '@/types/models';

export function getLiveUrl(course: Course): string | null {
  const platform = course.livePlatform ?? 'none';
  if (platform === 'jitsi') {
    const base = course.liveJitsiRoom && course.liveJitsiRoom.trim().length > 0
      ? course.liveJitsiRoom
      : `CloudAIAcademy-${course.slug || course.id}`;
    return `https://meet.jit.si/${encodeURIComponent(base)}`;
  }
  if (platform === 'google-meet') {
    try {
      const url = new URL(course.liveMeetUrl?.trim() || '');
      return url.protocol === 'https:' && url.hostname === 'meet.google.com' &&
        !url.username && !url.password && !url.port && url.pathname !== '/'
        ? url.href : null;
    } catch { return null; }
  }
  return null;
}
