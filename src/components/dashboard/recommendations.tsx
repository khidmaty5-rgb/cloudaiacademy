'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { useUser } from '@/firebase';
import { buildCourseLearningPlan, type CourseLearningPlan } from '@/lib/course-learning-plan';
import type { Course } from '@/types/models';

export default function Recommendations() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const { user } = useUser();
  const [goals, setGoals] = useState('');
  const [result, setResult] = useState<CourseLearningPlan | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !goals.trim() || lock.current) return;
    lock.current = true;
    setLoading(true); setError(false); setResult(null);
    try {
      const snapshot = await getDocs(query(collection(getFirestore(), 'courses'), where('status', '==', 'PUBLISHED')));
      setResult(buildCourseLearningPlan({ interests: goals, careerGoals: goals, experienceLevel: 'beginner', language: ar ? 'Arabic' : 'English' },
        snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Course)));
    } catch {
      setError(true);
    } finally {
      lock.current = false; setLoading(false);
    }
  };
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{ar ? 'اقتراحات لدورات تمهيدية منشورة حسب موضوعك، دون ذكاء اصطناعي. لتحديد مستوى آخر استخدم مخطّط التعلّم.' : 'Find published beginner courses matching your topic, without AI. Use the learning planner to choose another level.'}</p>
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="career-goals" className="text-sm font-medium">{ar ? 'موضوعك أو هدفك' : 'Your topic or goal'}</label>
      <Textarea id="career-goals" value={goals} onChange={e => setGoals(e.target.value)} required maxLength={300} rows={3} />
      <Button type="submit" disabled={loading || !user || !goals.trim()} className="w-full">{loading ? (ar ? 'جارٍ البحث…' : 'Finding courses…') : (ar ? 'اقتراح دورات' : 'Find courses')}</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{ar ? 'تعذّر تحميل الدورات. حاول مجددًا.' : 'Courses could not be loaded. Please retry.'}</p>}
    {result && <div aria-live="polite" className="space-y-2">
      {result.courses.length ? result.courses.map(course => <Link key={course.id} className="block text-sm underline" href={'/courses/' + encodeURIComponent(course.slug)}>{course.title}</Link>) : <p className="text-sm">{ar ? 'لا توجد دورات تمهيدية مطابقة حاليًا.' : 'No matching beginner courses are currently available.'}</p>}
    </div>}
    <Link href="/learning-path" className="block text-sm underline">{ar ? 'فتح مخطّط التعلّم' : 'Open learning planner'}</Link>
  </div>;
}
