'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getCourseImage } from '@/lib/course-images';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Signal, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, orderBy, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useLang } from '@/components/i18n/lang';
 

const coursesCopy = {
  en: {
    title: 'Explore Our Courses',
    subtitle: 'Find the perfect course to advance your skills in Cloud and AI.',
    searchPlaceholder: 'Search for courses...',
    filterCategory: 'Filter by category',
    filterLevel: 'Filter by level',
    allCategories: 'All Categories',
    allLevels: 'All Levels',
    noResults: 'No courses found matching your criteria.',
  },
  ar: {
    title: 'استكشف دوراتنا',
    subtitle: 'اعثر على الدورة المناسبة لتطوير مهاراتك في الحوسبة السحابية والذكاء الاصطناعي.',
    searchPlaceholder: 'ابحث عن الدورات...',
    filterCategory: 'تصفية حسب الفئة',
    filterLevel: 'تصفية حسب المستوى',
    allCategories: 'كل الفئات',
    allLevels: 'كل المستويات',
    noResults: 'لم يتم العثور على دورات مطابقة لمعايير البحث.',
  },
} as const;

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');
  const { lang } = useLang();
  const t = coursesCopy[lang];

  const firestore = getFirestore();
  const coursesQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, 'courses'),
        where('status', '==', 'PUBLISHED'),
        orderBy('createdAt', 'desc'),
      ),
    [firestore]
  );
  const { data: allCourses, isLoading, error } = useCollection(coursesQuery);

  const categories = useMemo(() => {
    if (!allCourses) return [];
    const allCategories = allCourses.map((course) => course.category);
    return ['all', ...Array.from(new Set(allCategories))];
  }, [allCourses]);

  const levels = useMemo(() => {
    if (!allCourses) return [];
    const allLevels = allCourses.map((course) => course.level);
    return ['all', ...Array.from(new Set(allLevels))];
  }, [allCourses]);

  const filteredCourses = useMemo(() => {
    if (!allCourses) return [];
    return allCourses.filter((course) => {
      const matchesSearch = course.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        category === 'all' || course.category === category;
      const matchesLevel = level === 'all' || course.level === level;
      return matchesSearch && matchesCategory && matchesLevel;
    });
  }, [allCourses, searchTerm, category, level]);

  return (
    <>
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          <div className="text-center">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">
              {t.title}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {t.subtitle}
            </p>
          </div>

          <div className="mt-8 mb-10 max-w-3xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-4">
                <div className='sm:col-span-2'>
                     <div className="relative">
                        <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            aria-label={t.searchPlaceholder}
                            placeholder={t.searchPlaceholder}
                            className="w-full ps-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
              <div className='sm:col-span-1'>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger aria-label={t.filterCategory}>
                    <SelectValue placeholder={t.filterCategory} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat} className='capitalize'>
                        {cat === 'all' ? t.allCategories : cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='sm:col-span-1'>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger aria-label={t.filterLevel}>
                    <SelectValue placeholder={t.filterLevel} />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((lvl) => (
                      <SelectItem key={lvl} value={lvl} className='capitalize'>
                        {lvl === 'all' ? t.allLevels : lvl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {error ? (
             <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive text-center max-w-2xl mx-auto">
               {error.message || 'Failed to load courses. Please try again.'}
             </div>
          ) : isLoading ? (
             <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-96 w-full" />
                ))}
             </div>
          ) : filteredCourses.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-6">
              {filteredCourses.map((course) => {
                const image = getCourseImage(course as any);
                const isContain = image.fit === 'contain';
                return (
                  <Link
                    href={`/courses/${course.slug}`}
                    key={course.id}
                    className="block"
                  >
                    <Card className="group h-full overflow-hidden border border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl">
                      <CardHeader className="p-0">
                        <div className="relative w-full bg-white" style={{ aspectRatio: '3/2' }}>
                          <div className={`absolute inset-0 ${isContain ? 'p-8' : ''}`}>
                            <div className="relative h-full w-full">
                              <Image
                                src={image.src}
                                alt={course.title}
                                fill
                                className={`${isContain ? 'object-contain' : 'object-cover'} bg-white ${isContain ? '' : 'group-hover:scale-105'} transition-transform duration-300`}
                                data-ai-hint={image.hint}
                              />
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex min-h-64 flex-col p-6">
                        <Badge
                          dir="auto"
                          variant="secondary"
                          className="mb-2 w-fit bg-accent/10 text-accent"
                        >
                          {course.category}
                        </Badge>
                        <CardTitle dir="auto" className="mb-2 line-clamp-2 font-headline">
                          {course.title}
                        </CardTitle>
                        <p dir="auto" className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                          {course.description}
                        </p>
                        <div className="mt-auto mb-4 text-2xl font-bold text-accent">
                          {course.price}
                        </div>
                        <div className="flex flex-wrap justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" /> {course.duration}
                          </div>
                          <div className="flex items-center gap-2">
                            <Signal className="w-4 h-4" /> {course.level}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">
                {t.noResults}
              </p>
              <Button asChild className="mt-4">
                <Link href="/courses">{t.title}</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
