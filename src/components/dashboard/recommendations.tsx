'use client';

import { useState, useMemo, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { getCourseRecommendations } from '@/ai/flows/ai-powered-course-recommendations';
import { Sparkles } from 'lucide-react';
import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, where, getDocs } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';

export default function Recommendations() {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const [careerGoals, setCareerGoals] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [largeSetCourses, setLargeSetCourses] = useState<any[] | null>(null);
  const [largeSetLoading, setLargeSetLoading] = useState(false);
  const [largeSetError, setLargeSetError] = useState<Error | null>(null);

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'enrollments');
  }, [firestore, user]);

  const { data: enrollments, isLoading: enrollmentsLoading, error: enrollmentsError } = useCollection(enrollmentsQuery);

  const enrolledCourseIds = useMemo(() => {
    if (!enrollments) return [];
    return enrollments.map(e => e.id);
  }, [enrollments]);

  const useRealtime = enrolledCourseIds.length > 0 && enrolledCourseIds.length <= 10;

  const coursesQuery = useMemoFirebase(() => {
    if (!useRealtime) return null;
    return query(collection(firestore, 'courses'), where('id', 'in', enrolledCourseIds));
  }, [firestore, useRealtime, enrolledCourseIds]);

  const { data: enrolledCourses, isLoading: coursesLoading, error: coursesError } = useCollection(coursesQuery);

  // Fallback for >10 ids
  useEffect(() => {
    let cancelled = false;
    async function fetchLarge() {
      if (useRealtime || enrolledCourseIds.length === 0) {
        setLargeSetCourses(null);
        setLargeSetLoading(false);
        setLargeSetError(null);
        return;
      }
      setLargeSetLoading(true);
      setLargeSetError(null);
      const chunks: string[][] = [];
      for (let i = 0; i < enrolledCourseIds.length; i += 10) {
        chunks.push(enrolledCourseIds.slice(i, i + 10));
      }
      try {
        const results: any[] = [];
        for (const c of chunks) {
          const q = query(collection(firestore, 'courses'), where('id', 'in', c));
          const snap = await getDocs(q);
          snap.forEach(d => results.push({ id: d.id, ...d.data() } as any));
        }
        if (!cancelled) {
          setLargeSetCourses(results);
          setLargeSetLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLargeSetError(err instanceof Error ? err : new Error('Failed to load your learning history.'));
          setLargeSetCourses([]);
          setLargeSetLoading(false);
        }
      }
    }
    fetchLarge();
    return () => { cancelled = true };
  }, [firestore, useRealtime, enrolledCourseIds]);

  const mergedCourses = useMemo(() => {
    if (useRealtime) return enrolledCourses || [];
    return largeSetCourses || [];
  }, [useRealtime, enrolledCourses, largeSetCourses]);

  const learningHistory = useMemo(() => {
    if (!mergedCourses) return 'None';
    return mergedCourses.length > 0 ? mergedCourses.map((c: any) => c.title).join(', ') : 'None';
  }, [mergedCourses]);


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
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      setAiError('Failed to get recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || enrollmentsLoading || (useRealtime ? coursesLoading : largeSetLoading)) {
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
      {(enrollmentsError || coursesError || largeSetError) && (
        <p className="text-sm text-destructive">
          Couldn’t load your learning history. Recommendations may be less accurate.
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
