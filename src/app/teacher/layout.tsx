'use client';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { Card } from '@/components/ui/card';
import { useCurrentRole } from '@/hooks/useCurrentRole';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const { isTeacher, isAdmin, loading } = useCurrentRole();

  const showTabs = (
    <div className="flex flex-wrap gap-2 mb-6">
      <Link href="/teacher/dashboard" className={`px-3 py-2 rounded ${pathname === '/teacher/dashboard' ? 'bg-accent text-accent-foreground' : 'bg-muted hover:bg-muted/80'}`}>Teaching</Link>
      <Link href="/teacher/courses" className={`px-3 py-2 rounded ${pathname === '/teacher/courses' ? 'bg-accent text-accent-foreground' : 'bg-muted hover:bg-muted/80'}`}>My Courses</Link>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          {showTabs}
          {loading ? (
            <Card className="h-40" />
          ) : (!isTeacher && !isAdmin) ? (
            <div className="text-center py-16 text-muted-foreground">Access denied.</div>
          ) : (
            <>
              {isAdmin && !isTeacher && (
                <div className="mb-4 text-sm text-muted-foreground">You are viewing the teacher area as an admin.</div>
              )}
              {children}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
