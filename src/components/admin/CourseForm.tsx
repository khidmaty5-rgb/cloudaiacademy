'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addCourse, updateCourse } from '@/lib/courses';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, where } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { useCurrentRole } from '@/hooks/useCurrentRole';

const courseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  description: z.string().min(10, 'Description is too short'),
  category: z.string().min(1, 'Category is required'),
  price: z.string().min(1, 'Price is required'),
  duration: z.string().min(1, 'Duration is required'),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
});

type CourseFormValues = z.infer<typeof courseSchema>;

type CourseFormProps = {
  course?: CourseFormValues & { id?: string };
};

export default function CourseForm({ course }: CourseFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const firestore = getFirestore();
  const { isAdmin } = useCurrentRole();

  const isEditMode = !!course;

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: course || {
      title: '',
      description: '',
      category: '',
      price: '',
      duration: '',
      level: 'Beginner',
    },
  });

  // Admin-only teacher list and instructor assignment state
  const teachersQuery = useMemoFirebase(
    () => query(collection(firestore, 'users'), where('role', '==', 'teacher')),
    [firestore]
  );
  const { data: teachers } = useCollection<any>(teachersQuery);
  const initialOwnerId = (course as any)?.ownerId as string | undefined;
  const initialInstructorIds = ((course as any)?.instructorIds as string[] | undefined) || [];
  const [ownerId, setOwnerId] = useState<string | undefined>(initialOwnerId);
  const [instructorIds, setInstructorIds] = useState<string[]>(initialInstructorIds);
  const teacherOptions = useMemo(
    () => (teachers || []).map((t: any) => ({ id: t.id, name: `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || t.email })),
    [teachers]
  );

  const onSubmit = async (data: CourseFormValues) => {
    setIsLoading(true);
    try {
      const extra = isAdmin
        ? {
            ownerId: ownerId,
            instructorIds: Array.from(new Set([...(instructorIds || []), ...(ownerId ? [ownerId] : [])])),
          }
        : undefined;
      if (isEditMode) {
        await updateCourse(course.id!, { ...data, ...(extra || {}) });
        toast({
          title: 'Course Updated!',
          description: `${data.title} has been successfully updated.`,
        });
      } else {
        await addCourse(data, extra);
        toast({
          title: 'Course Created!',
          description: `${data.title} has been successfully added.`,
        });
      }
      router.push('/admin/courses');
      router.refresh(); // To reflect changes in the table
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Introduction to Cloud Computing" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="A brief summary of what the course covers."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., AI, Cloud, Web Dev" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., $299 or Free" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        {isAdmin && (
          <div className="space-y-4 border-t pt-6">
            <FormLabel>Instructors</FormLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel className="text-sm text-muted-foreground">Primary Instructor</FormLabel>
                <Select onValueChange={(v) => setOwnerId(v)} defaultValue={ownerId}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary instructor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {teacherOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FormLabel className="text-sm text-muted-foreground">Additional Instructors</FormLabel>
                <div className="space-y-2 max-h-56 overflow-auto p-2 border rounded-md">
                  {teacherOptions.map((t) => {
                    const checked = instructorIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const isChecked = !!v;
                            setInstructorIds((prev) => {
                              const set = new Set(prev);
                              if (isChecked) set.add(t.id); else set.delete(t.id);
                              return Array.from(set);
                            });
                          }}
                        />
                        <span className="text-sm">{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 8 weeks" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading
            ? isEditMode
              ? 'Saving Changes...'
              : 'Creating Course...'
            : isEditMode
            ? 'Save Changes'
            : 'Create Course'}
        </Button>
      </form>
    </Form>
  );
}

    