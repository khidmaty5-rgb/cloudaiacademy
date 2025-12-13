'use client';

import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase } from '@/firebase';
import { getFirestore, doc } from 'firebase/firestore';

const statsEn = [
  { value: '10,000+', label: 'Students Enrolled' },
  { value: '50+', label: 'Expert Instructors' },
  { value: '200+', label: 'Courses & Learning Paths' },
  { value: '95%', label: 'Completion Rate' },
];

const statsAr = [
  { value: '10,000+', label: 'طلاب مسجّلون' },
  { value: '50+', label: 'مدرّسون خبراء' },
  { value: '200+', label: 'دورات ومسارات تعلم' },
  { value: '95%', label: 'معدل الإكمال' },
];

export default function Stats() {
  const { lang } = useLang();
  const stats = lang === 'ar' ? statsAr : statsEn;
  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);
  const showStats = ui?.showStats !== false; // default: show

  if (!showStats) return null;

  return (
    <section className="bg-primary text-primary-foreground py-20 md:py-24">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <h3 className="font-headline text-4xl md:text-5xl font-bold text-accent">
                {stat.value}
              </h3>
              <p className="mt-2 text-primary-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
