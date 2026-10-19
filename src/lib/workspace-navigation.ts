import type { AppRole } from '@/lib/route-access';
import { canRoleAccessPath } from '@/lib/route-access';
import { hasCapability, type Capability } from '@/lib/capabilities';

type Label = { en: string; ar: string };
export type WorkspaceLink = { href: string; label: Label; section: Label; roles: readonly AppRole[] };
const all: readonly AppRole[] = ['admin', 'editor', 'teacher', 'reviewer', 'student'];
const manage = { en: 'Academy management', ar: 'إدارة الأكاديمية' };
const learning = { en: 'Learning', ar: 'التعلّم' };
const teaching = { en: 'Teaching & communications', ar: 'التدريس والتواصل' };
const publishing = { en: 'Research & publishing', ar: 'الأبحاث والنشر' };
const settings = { en: 'Administration', ar: 'الإعدادات الإدارية' };
const personal = { en: 'My account', ar: 'حسابي' };
const reviewing = { en: 'Peer review', ar: 'التحكيم العلمي' };
const editorial = { en: 'Editorial', ar: 'التحرير' };

// Explicit section priority: settings never displace a role's main work.
const sectionOrder: Record<AppRole, readonly string[]> = {
  admin: [manage.en, teaching.en, editorial.en, reviewing.en, learning.en, publishing.en, settings.en, personal.en],
  teacher: [teaching.en, learning.en, publishing.en, personal.en],
  editor: [editorial.en, reviewing.en, publishing.en, learning.en, personal.en],
  reviewer: [reviewing.en, learning.en, publishing.en, personal.en],
  student: [learning.en, publishing.en, personal.en],
};

const destinationCapabilities: Record<string, Capability> = {
  '/admin/dashboard': 'academy.overview',
  '/admin/courses': 'academy.manageCourses',
  '/admin/users': 'academy.manageUsers',
  '/admin/waitlist': 'academy.manageEnrollments',
  '/admin/certificates': 'academy.manageCertificates',
  '/admin/analytics': 'academy.viewAnalytics',
  '/admin/payment': 'academy.managePayments',
  '/teacher/dashboard': 'course.teach',
  '/teacher/courses': 'course.manageAssigned',
  '/teacher/telegram': 'communications.telegram',
  '/dashboard': 'learning.access',
  '/learning-path': 'learning.access',
  '/certificates': 'learning.certificates',
  '/admin/journal': 'journal.edit',
  '/reviewer': 'journal.review',
  '/journal/my-submissions': 'journal.submit',
  '/journal/submit': 'journal.submit',
  '/courses': 'academy.discover',
  '/journal': 'academy.discover',
  '/research': 'academy.discover',
  '/profile': 'account.profile',
  '/admin/academy': 'academy.manageSettings',
  '/admin/announcements': 'academy.manageSettings',
  '/admin/access': 'academy.manageSettings',
  '/admin/landing': 'academy.manageSettings',
  '/admin/seed': 'academy.manageSettings',
  '/print/qr': 'academy.manageSettings',
};

export const workspaceLinks: readonly WorkspaceLink[] = [
  { href: '/admin/academy', label: { en: 'Academy template', ar: 'قالب الأكاديمية' }, section: settings, roles: ['admin'] },
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
  { href: '/journal/my-submissions', label: { en: 'My article submissions', ar: 'مقالاتي المرسلة' }, section: publishing, roles: all },
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
  { href: '/teacher/telegram', label: { en: 'Telegram', ar: 'تيليجرام' }, section: teaching, roles: ['teacher', 'admin'] },
];

export function navigationForRole(role: AppRole) {
  const order = sectionOrder[role];
  return workspaceLinks
    .filter(link => {
      const capability = destinationCapabilities[link.href];
      return !!capability && hasCapability(role, capability) && canRoleAccessPath(role, link.href);
    })
    .map(link => ({ ...link, section: link.href.startsWith('/teacher/') ? teaching
      : link.href === '/admin/journal' ? editorial
      : link.href === '/reviewer' ? reviewing : link.section }))
    .sort((a, b) => order.indexOf(a.section.en) - order.indexOf(b.section.en));
}

export function activeWorkspaceLink(pathname: string, links: readonly WorkspaceLink[]) {
  return [...links].sort((a, b) => b.href.length - a.href.length)
    .find(link => pathname === link.href || pathname.startsWith(`${link.href}/`))
    ?? (pathname.startsWith('/admin/courses/') ? links.find(link => link.href === '/teacher/courses') : undefined);
}

export type WorkspaceId = 'administration' | 'teaching' | 'editorial' | 'reviewing' | 'learning';
export const workspaceLabels: Record<WorkspaceId, Label> = {
  administration: { en: 'Administration', ar: 'إدارة الأكاديمية' },
  teaching: { en: 'Teaching', ar: 'التدريس' },
  editorial: { en: 'Editorial', ar: 'التحرير' },
  reviewing: { en: 'Peer review', ar: 'التحكيم العلمي' },
  learning: { en: 'Learning', ar: 'التعلّم' },
};

export function workspaceForLink(link: WorkspaceLink): WorkspaceId | undefined {
  if (link.section.en === manage.en || link.section.en === settings.en) return 'administration';
  if (link.section.en === teaching.en) return 'teaching';
  if (link.section.en === editorial.en) return 'editorial';
  if (link.section.en === reviewing.en) return 'reviewing';
  if (link.section.en === learning.en) return 'learning';
  // Research/publishing and account tools are shared across workspaces.
  return undefined;
}

export function availableWorkspaces(links: readonly WorkspaceLink[]): WorkspaceId[] {
  return [...new Set(links.map(workspaceForLink).filter((id): id is WorkspaceId => !!id))];
}

export function contextualNavigation(links: readonly WorkspaceLink[], workspace: WorkspaceId) {
  return links.filter(link => !workspaceForLink(link) || workspaceForLink(link) === workspace);
}
