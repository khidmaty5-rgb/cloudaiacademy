'use client';

import { useLang } from '@/components/i18n/lang';
import { ar } from 'date-fns/locale';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone } from 'lucide-react';

export default function AnnouncementsFeed() {
  const { lang } = useLang();
  const firestore = getFirestore();

  const announcementsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'announcements'), orderBy('createdAt', 'desc'), limit(5));
  }, [firestore]);

  const { data: announcements, isLoading, error } = useCollection(announcementsQuery);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
        {lang === 'ar' ? 'تعذّر تحميل الإعلانات. حاول مجددًا لاحقًا.' : 'Could not load announcements. Please try again later.'}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-headline">
          <Megaphone className="text-accent" />
          {lang === 'ar' ? 'آخر الإعلانات' : 'Latest announcements'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {announcements && announcements.length > 0 ? (
          <ul className="space-y-4">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex flex-wrap gap-2 justify-between items-start">
                    <h4 className="font-semibold">{announcement.title}</h4>
                    {announcement.createdAt && (
                    <Badge variant="secondary" className="text-xs">
                        {formatDistanceToNow(announcement.createdAt.toDate(), { addSuffix: true, locale: lang === 'ar' ? ar : undefined })}
                    </Badge>
                    )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{announcement.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد إعلانات جديدة.' : 'No new announcements.'}</p>
        )}
      </CardContent>
    </Card>
  );
}
    
