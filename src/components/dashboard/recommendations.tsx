'use client';

import { useState, useMemo, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { getCourseRecommendations } from '@/ai/flows/ai-powered-course-recommendations';
import { Sparkles } from 'lucide-react';
import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, getDoc, getFirestore } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';

export default function Recommendations() {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const [careerGoals, setCareerGoals] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [courses, setCourses] = useState<any[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<Error | null>(null);

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'enrollments');
  }, [firestore, user]);

  const { data: enrollments, isLoading: enrollmentsLoading, error: enrollmentsError } = useCollection(enrollmentsQuery);

  const enrolledCourseIds = useMemo(() => {
    if (!enrollments) return [];
    return enrollments.map(e => e.id);
  }, [enrollments]);

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      if (!user) {
        setCourses(null);
        setCoursesLoading(false);
        setCoursesError(null);
        return;
      }
      if (enrolledCourseIds.length === 0) {
        setCourses([]);
        setCoursesLoading(false);
        setCoursesError(null);
        return;
      }

      setCoursesLoading(true);
      setCoursesError(null);
      try {
        const results = await Promise.all(
          enrolledCourseIds.map(async (courseId) => {
            const snap = await getDoc(doc(firestore, 'courses', courseId));
            return snap.exists() ? ({ id: snap.id, ...snap.data() } as any) : null;
          }),
        );
        if (!cancelled) {
          setCourses(results.filter(Boolean));
          setCoursesLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setCoursesError(err instanceof Error ? err : new Error('Failed to load your learning history.'));
          setCourses([]);
          setCoursesLoading(false);
        }
      }
    }
    fetchCourses();
    return () => { cancelled = true };
  }, [firestore, user, enrolledCourseIds]);

  const learningHistory = useMemo(() => {
    if (!courses) return 'None';
    return courses.length > 0 ? courses.map((c: any) => c.title).join(', ') : 'None';
  }, [courses]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setRecommendations([]);
    setAiError(null);
    try {
      const result = await getCourseRecommendations({
        careerGoals,
        learningHistory: learningHistory,
        inDemandSkills: 'AI, Cloud Computing, DevOps, Machine Learning', // Placeholder
      });
      setRecommendations(result.courseRecommendations);
    } catch (error: any) {
      console.error('Failed to get recommendations:', error);
      const msg = String(error?.message || error);
      if (msg.includes('AI_DISABLED')) {
        setAiError('AI recommendations are currently unavailable. Please try again later.');
      } else {
        setAiError('Failed to get recommendations. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || enrollmentsLoading || coursesLoading) {
    return (
        <div className="space-y-4">
            <Skeleton className='h-4 w-full' />
             <Skeleton className='h-20 w-full' />
             <Skeleton className='h-10 w-full' />
        </div>
    )
  }

  return (
    <div className="space-y-4">
      {(enrollmentsError || coursesError) && (
        <p className="text-sm text-destructive">
          Couldn't load your learning history. Recommendations may be less accurate.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Tell us your career goals, and our AI will suggest the perfect courses for you based on your learning history.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder="e.g., 'Become a cloud architect' or 'Specialize in machine learning applications'"
          value={careerGoals}
          onChange={(e) => setCareerGoals(e.target.value)}
          rows={3}
        />
        <Button type="submit" disabled={isLoading || !careerGoals.trim()} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {isLoading ? 'Generating...' : 'Get Recommendations'}
        </Button>
      </form>
      {aiError && (
        <p className="text-sm text-destructive">{aiError}</p>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-2 pt-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Sparkles className="text-accent" />
            Recommended Courses
          </h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            {recommendations.map((course, index) => (
              <li key={index}>{course}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
