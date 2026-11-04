import { SubmissionStatus } from '@/components/student-inbox';
export const metadata = { title: 'Private submission receipt', robots: { index: false, follow: false } };
export default function Page() { return <SubmissionStatus />; }
