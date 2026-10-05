"use client";

import type { Course } from "@/types/models";
import { getLiveUrl } from "@/lib/live";
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';

export type LiveSessionButtonProps = {
  course?: Course;
  courseId?: string; // fallback legacy prop to compute default Jitsi room if course is absent
  label?: string;
};

export default function LiveSessionButton({ course, courseId, label }: LiveSessionButtonProps) {
  const { isAdmin, isTeacher, loading } = useCurrentRole();
  const { lang } = useLang();
  const ar = lang === 'ar';
  const url = course ? getLiveUrl(course) : courseId
    ? `https://meet.jit.si/${encodeURIComponent(`CloudAIAcademy-${courseId}`)}` : null;
  if (!url) {
    if (!loading && isAdmin && course?.slug) {
      return <Link className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium" href={`/admin/courses/edit/${encodeURIComponent(course.slug)}#live-session-settings`}>
        {ar ? 'إعداد الفصل المباشر' : 'Set up live classroom'}
      </Link>;
    }
    return <p className="text-sm text-muted-foreground" role="status">
      {ar ? 'الفصل المباشر غير مُعدّ بعد.' : 'Live classroom is not configured yet.'}
      {!loading && isTeacher && (ar ? ' اطلب من المشرف إعداد رابط الاجتماع.' : ' Ask an administrator to configure the meeting link.')}
    </p>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
    >
      {label ?? (ar ? 'الانضمام إلى الحصة المباشرة' : 'Join Live Session')}
    </a>
  );
}
