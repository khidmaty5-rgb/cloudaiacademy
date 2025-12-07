'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Input } from '@/components/ui/input';
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
import { collection, getFirestore, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');

  const firestore = getFirestore();
  const coursesQuery = useMemoFirebase(
    () => query(collection(firestore, 'courses'), orderBy('createdAt', 'desc')),
    [firestore]
  );
  const { data: allCourses, isLoading } = useCollection(coursesQuery);

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
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          <div className="text-center">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">
              Explore Our Courses
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Find the perfect course to advance your skills in Cloud and AI.
            </p>
          </div>

          <div className="mt-8 mb-10 max-w-3xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-4">
                <div className='sm:col-span-3'>
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search for courses..."
                            className="pl-10 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
              <div className='sm:col-span-1'>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat} className='capitalize'>
                        {cat === 'all' ? 'All Categories' : cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='sm:col-span-1'>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((lvl) => (
                      <SelectItem key={lvl} value={lvl} className='capitalize'>
                        {lvl === 'all' ? 'All Levels' : lvl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-96 w-full" />
                ))}
             </div>
          ) : filteredCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course) => {
                const image = PlaceHolderImages.find(
                  (img) => img.id === course.imageId
                );
                return (
                  <Link
                    href={`/courses/${course.slug}`}
                    key={course.id}
                    className="block"
                  >
                    <Card className="overflow-hidden group hover:shadow-xl transition-shadow duration-300 h-full border-accent border-2">
                      <CardHeader className="p-0">
                        <div className="relative h-60 w-full">
                          {image && (
                            <Image
                              src={image.imageUrl}
                              alt={course.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              data-ai-hint={image.imageHint}
                            />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <Badge
                          variant="secondary"
                          className="bg-accent/10 text-accent mb-2"
                        >
                          {course.category}
                        </Badge>
                        <CardTitle className="font-headline mb-2">
                          {course.title}
                        </CardTitle>
                        <p className="text-muted-foreground mb-4 text-sm">
                          {course.description}
                        </p>
                        <div className="text-2xl font-bold text-accent mb-4">
                          {course.price}
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm border-t pt-4">
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
                No courses found matching your criteria.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
