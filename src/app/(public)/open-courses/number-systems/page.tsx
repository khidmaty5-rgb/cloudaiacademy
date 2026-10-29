import type { Metadata } from 'next';
import PublicOpenCourse from '@/components/open-course-player';

export const metadata: Metadata = {
  title: 'Number Systems — الأنظمة العددية',
  description: 'Free 90-minute Arabic interactive course: binary, octal, decimal and hexadecimal. No registration required.',
};

export default function NumberSystemsPage() {
  return <PublicOpenCourse id="number-systems" />;
}
