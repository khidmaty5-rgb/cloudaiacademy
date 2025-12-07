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
import LessonForm from './LessonForm';
import { Pencil, PlusCircle } from 'lucide-react';

type LessonManagerProps = {
  course: { id: string };
};

export default function LessonManager({ course }: LessonManagerProps) {
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-headline text-2xl font-bold">Manage Lessons</h2>
         <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2" /> Add Lesson
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{selectedLesson ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
                </DialogHeader>
                <LessonForm courseId={course.id} lesson={selectedLesson} onSuccess={onFormSuccess} />
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Lessons</CardTitle>
          <CardDescription>
            Add, edit, and reorder the lessons for this course.
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
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="font-medium">{index + 1}. {lesson.title}</div>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(lesson)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No lessons have been added to this course yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
