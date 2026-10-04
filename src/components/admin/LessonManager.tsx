'use client';

import { useState } from 'react';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, orderBy } from 'firebase/firestore';
import type { Lesson } from '@/lib/lessons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useEditorCopy } from './editor-copy';
import LessonForm from './LessonForm';
import { Pencil, PlusCircle } from 'lucide-react';

type LessonManagerProps = {
  course: { id: string };
};

export default function LessonManager({ course }: LessonManagerProps) {
  const { t } = useEditorCopy();
  const firestore = getFirestore();
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const lessonsQuery = useMemoFirebase(() => {
    if (!course) return null;
    return query(
      collection(firestore, 'courses', course.id, 'lessons'),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, course]);

  const { data: lessons, isLoading } = useCollection<Lesson>(lessonsQuery);

  const handleEdit = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setOpenDialog(true);
  };
  
  const handleAddNew = () => {
    setSelectedLesson(null);
    setOpenDialog(true);
  }

  const onFormSuccess = () => {
    setOpenDialog(false);
    setSelectedLesson(null);
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h2 className="font-headline text-2xl font-bold">{t("Manage Lessons")}</h2>
         <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                <PlusCircle className="size-4" /> {t("Add Lesson")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{selectedLesson ? t('Edit Lesson') : t('Add New Lesson')}</DialogTitle>
                </DialogHeader>
                <LessonForm key={selectedLesson?.id ?? "new"} courseId={course.id} lesson={selectedLesson} onSuccess={onFormSuccess} />
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Course Lessons")}</CardTitle>
          <CardDescription>
            {t("Add and edit the lessons for this course.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
          ) : lessons && lessons.length > 0 ? (
            <ul className="space-y-3">
              {lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <div
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="min-w-0 break-words font-medium" dir="auto">{index + 1}. {lesson.title}</div>
                    <Button variant="ghost" size="icon" className="shrink-0" aria-label={`${t("Edit Lesson")}: ${lesson.title}`} onClick={() => handleEdit(lesson)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              {t("No lessons have been added to this course yet.")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
