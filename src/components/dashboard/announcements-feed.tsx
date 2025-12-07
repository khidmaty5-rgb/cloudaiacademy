'use client';

import { useMemo } from 'react';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone } from 'lucide-react';

export default function AnnouncementsFeed() {
  const firestore = getFirestore();

  const announcementsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'announcements'), orderBy('createdAt', 'desc'), limit(5));
  }, [firestore]);

  const { data: announcements, isLoading } = useCollection(announcementsQuery);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <Megaphone className="text-accent" />
          Latest Announcements
        </CardTitle>
      </CardHeader>
      <CardContent>
        {announcements && announcements.length > 0 ? (
          <ul className="space-y-4">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-start">
                    <h4 className="font-semibold">{announcement.title}</h4>
                    {announcement.createdAt && (
                    <Badge variant="secondary" className="text-xs">
                        {formatDistanceToNow(announcement.createdAt.toDate(), { addSuffix: true })}
                    </Badge>
                    )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{announcement.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-muted-foreground py-4">No announcements yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
    