import type { AppRole } from '@/lib/route-access';
import { canRoleAccessPath } from '@/lib/route-access';

type Label = { en: string; ar: string };
export type WorkspaceLink = { href: string; label: Label; section: Label; roles: readonly AppRole[] };
const all: readonly AppRole[] = ['admin', 'editor', 'teacher', 'reviewer', 'student'];
const manage = { en: 'Academy management', ar: 'إدارة الأكاديمية' };
const learning = { en: 'Learning', ar: 'التعلّم' };
const publishing = { en: 'Research & publishing', ar: 'الأبحاث والنشر' };
const settings = { en: 'Administration', ar: 'الإعدادات الإدارية' };
const personal = { en: 'My account', ar: 'حسابي' };

export const workspaceLinks: readonly WorkspaceLink[] = [
  { href: '/admin/dashboard', label: { en: 'Overview', ar: 'نظرة عامة' }, section: manage, roles: ['admin'] },
  { href: '/admin/courses', label: { en: 'Courses', ar: 'الدورات' }, section: manage, roles: ['admin'] },
  { href: '/admin/users', label: { en: 'People', ar: 'المستخدمون' }, section: manage, roles: ['admin'] },
  { href: '/admin/waitlist', label: { en: 'Enrollment requests', ar: 'طلبات التسجيل' }, section: manage, roles: ['admin'] },
  { href: '/admin/certificates', label: { en: 'Certificates', ar: 'الشهادات' }, section: manage, roles: ['admin'] },
  { href: '/admin/analytics', label: { en: 'Analytics', ar: 'التحليلات' }, section: manage, roles: ['admin'] },
  { href: '/teacher/dashboard', label: { en: 'Teaching overview', ar: 'نظرة عامة على التدريس' }, section: learning, roles: ['teacher', 'admin'] },
  { href: '/teacher/courses', label: { en: 'My teaching courses', ar: 'دوراتي التعليمية' }, section: learning, roles: ['teacher', 'admin'] },
  { href: '/dashboard', label: { en: 'My learning', ar: 'تعلّمي' }, section: learning, roles: ['student', 'reviewer'] },
  { href: '/courses', label: { en: 'Explore courses', ar: 'استكشاف الدورات' }, section: learning, roles: all },
  { href: '/learning-path', label: { en: 'Learning path', ar: 'مسار التعلّم' }, section: learning, roles: ['student', 'reviewer'] },
  { href: '/certificates', label: { en: 'My certificates', ar: 'شهاداتي' }, section: learning, roles: ['student', 'reviewer'] },
  { href: '/admin/journal', label: { en: 'Editorial desk', ar: 'إدارة المجلة' }, section: publishing, roles: ['admin', 'editor'] },
  { href: '/reviewer', label: { en: 'Review queue', ar: 'الأبحاث للتحكيم' }, section: publishing, roles: ['admin', 'editor', 'reviewer'] },
  { href: '/journal/my-submissions', label: { en: 'My submissions', ar: 'مقالاتي المرسلة' }, section: publishing, roles: all },
  { href: '/journal/submit', label: { en: 'Submit an article', ar: 'إرسال مقال' }, section: publishing, roles: all },
  { href: '/journal', label: { en: 'Read the journal', ar: 'تصفّح المجلة' }, section: publishing, roles: all },
  { href: '/research', label: { en: 'Research lab', ar: 'مختبر الأبحاث' }, section: publishing, roles: all },
  { href: '/admin/announcements', label: { en: 'Announcements', ar: 'الإعلانات' }, section: settings, roles: ['admin'] },
  { href: '/admin/payment', label: { en: 'Payments', ar: 'المدفوعات' }, section: settings, roles: ['admin'] },
  { href: '/admin/access', label: { en: 'Access settings', ar: 'إعدادات الوصول' }, section: settings, roles: ['admin'] },
  { href: '/admin/landing', label: { en: 'Website settings', ar: 'إعدادات الموقع' }, section: settings, roles: ['admin'] },
  { href: '/admin/seed', label: { en: 'Data tools', ar: 'أدوات البيانات' }, section: settings, roles: ['admin'] },
  { href: '/print/qr', label: { en: 'Academy QR code', ar: 'رمز الأكاديمية' }, section: settings, roles: ['admin'] },
  { href: '/profile', label: { en: 'Profile', ar: 'الملف الشخصي' }, section: personal, roles: all },
  { href: '/dashboard/telegram', label: { en: 'Telegram', ar: 'تيليجرام' }, section: personal, roles: ['student', 'reviewer'] },
];

export function navigationForRole(role: AppRole) {
  return workspaceLinks.filter(link => link.roles.includes(role) && canRoleAccessPath(role, link.href));
}

export function activeWorkspaceLink(pathname: string, links: readonly WorkspaceLink[]) {
  return [...links].sort((a, b) => b.href.length - a.href.length)
    .find(link => pathname === link.href || pathname.startsWith(`${link.href}/`))
    ?? (pathname.startsWith('/admin/courses/') ? links.find(link => link.href === '/teacher/courses') : undefined);
}
