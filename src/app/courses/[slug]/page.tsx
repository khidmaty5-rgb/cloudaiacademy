'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { enrollInCourse } from '@/lib/enrollment';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Clock, Signal, CheckCircle } from 'lucide-react';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { Lesson } from '@/lib/lessons';
import { Skeleton } from '@/components/ui/skeleton';

export default function CourseDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const courseDocRef = useMemoFirebase(() => {
      if (!slug) return null;
      return doc(firestore, 'courses', slug);
  }, [firestore, slug]);

  const { data: course, isLoading: isCourseLoading } = useDoc(courseDocRef);

  const lessonsQuery = useMemoFirebase(() => {
    if (!course) return null;
    return query(collection(firestore, 'courses', course.id, 'lessons'), orderBy('createdAt', 'asc'));
  }, [firestore, course]);
  const { data: lessons } = useCollection<Lesson>(lessonsQuery);
  const firstLessonId = lessons && lessons.length > 0 ? lessons[0].id : null;

  const enrollmentDocRef = useMemoFirebase(() => {
    if (!user || !course) return null;
    return doc(firestore, 'users', user.uid, 'enrollments', course.id);
  }, [firestore, user, course]);

  const { data: enrollment, isLoading: isEnrollmentLoading } = useDoc(enrollmentDocRef);

  const isEnrolled = !!enrollment;
  const isLoading = isUserLoading || isCourseLoading || isEnrollmentLoading;

  const image = course ? PlaceHolderImages.find((img) => img.id === course.imageId) : undefined;

  // Do not redirect during render lifecycle; instead show a friendly fallback below if not found

  const handleEnroll = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!course) return;

    try {
      await enrollInCourse(user.uid, course.id);
      toast({
        title: 'Successfully Enrolled!',
        description: `You have enrolled in ${course.title}.`,
      });
      if (firstLessonId) {
        router.push(`/learn/${slug}/${firstLessonId}`);
      } else {
        router.push(`/learn/${slug}`);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Enrollment Failed',
        description: error.message || 'There was an error enrolling in the course.',
      });
    }
  };

  if (isLoading) {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1">
            <div className="container py-10 md:py-16">
              <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                <Skeleton className="h-96 w-full" />
                <div className="space-y-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-10 md:py-16">
            <p className="text-muted-foreground">Course not found.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
              <div className="relative h-96 w-full rounded-lg overflow-hidden shadow-lg">
                {image && (
                  <Image
                    src={image.imageUrl}
                    alt={course.title}
                    fill
                    className="object-cover"
                    data-ai-hint={image.imageHint}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <Badge variant="secondary" className="bg-accent/10 text-accent w-fit mb-2">{course.category}</Badge>
              <h1 className="font-headline text-3xl md:text-4xl font-bold">{course.title}</h1>
              <p className="mt-4 text-lg text-muted-foreground">{course.description}</p>
              
              <div className="flex items-center gap-6 text-muted-foreground mt-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {course.duration}
                </div>
                <div className="flex items-center gap-2">
                  <Signal className="w-4 h-4" /> {course.level}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-3xl font-bold text-accent">{course.price}</p>
              </div>

              <div className="mt-8">
                {isEnrolled ? (
                    <Button
                      size="lg"
                      className="w-full md:w-auto bg-green-500 hover:bg-green-600 flex items-center gap-2"
                      onClick={() => {
                        if (firstLessonId) {
                          router.push(`/learn/${slug}/${firstLessonId}`);
                        } else {
                          router.push(`/learn/${slug}`);
                        }
                      }}
                    >
                      Go to Course
                    </Button>
                ) : (
                    <Button onClick={handleEnroll} size="lg" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                        Enroll Now
                    </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
