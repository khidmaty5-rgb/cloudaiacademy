'use client';
import LectureResources from '@/components/lecture-resources';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';
export default function ManageResourcesPage() {
  const { isAdmin, loading } = useCurrentRole(); const { lang } = useLang();
  if (loading) return <p role="status" className="p-6">{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</p>;
  if (!isAdmin) return <p className="p-6">{lang === 'ar' ? 'الوصول مرفوض' : 'Access denied'}</p>;
  return <LectureResources manage />;
}
