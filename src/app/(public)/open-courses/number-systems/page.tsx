import type { Metadata } from 'next';
import lesson from '@/content/number-systems.json';
import { OpenNumberSystems } from '@/components/open-number-systems';

export const metadata: Metadata = {
  title: 'Number Systems — الأنظمة العددية',
  description: 'Free 90-minute Arabic interactive course: binary, octal, decimal and hexadecimal. No registration required.',
};

export default function NumberSystemsPage() {
  return <OpenNumberSystems html={lesson.html} />;
}
