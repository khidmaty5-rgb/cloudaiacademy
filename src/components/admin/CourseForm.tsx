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

const livePlatformSchema = z.enum(['none', 'jitsi', 'google-meet']);

const courseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  courseCode: z
    .string()
    .trim()
    .min(2, 'Course code must be at least 2 characters')
    .max(12, 'Course code must be 12 characters or less')
    .regex(/^[A-Za-z0-9-]+$/, 'Use only letters, numbers, and hyphens')
    .transform((v) => v.toUpperCase()),
  imageUrl: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return undefined;
      const trimmed = v.trim();
      return trimmed ? trimmed : undefined;
    },
    z
      .string()
      .refine(
        (v) => v.startsWith('/') || v.startsWith('http://') || v.startsWith('https://'),
        'Use a full URL or a /images/... path',
      )
      .optional(),
  ),
  description: z.string().min(10, 'Description is too short'),
  category: z.string().min(1, 'Category is required'),
  price: z.string().min(1, 'Price is required'),
  duration: z.string().min(1, 'Duration is required'),
  isFull: z.boolean().default(false),
  totalHours: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().positive().optional(),
  ),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  livePlatform: livePlatformSchema.default('none'),
  liveJitsiRoom: z.string().optional(),
  liveMeetUrl: z.union([z.string().url('Must be a valid https://meet.google.com/... URL'), z.literal('')]).optional(),
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
    defaultValues: {
      title: (course as any)?.title ?? '',
      courseCode: (course as any)?.courseCode ?? '',
      imageUrl: (course as any)?.imageUrl ?? '',
      description: (course as any)?.description ?? '',
      category: (course as any)?.category ?? '',
      price: (course as any)?.price ?? '',
      duration: (course as any)?.duration ?? '',
      isFull: (course as any)?.isFull ?? false,
      totalHours: (course as any)?.totalHours ?? undefined,
      level: ((course as any)?.level as any) ?? 'Beginner',
      livePlatform: ((course as any)?.livePlatform as any) ?? 'none',
      liveJitsiRoom: ((course as any)?.liveJitsiRoom as any) ?? '',
      liveMeetUrl: ((course as any)?.liveMeetUrl as any) ?? '',
    },
  });

  // Admin-only teacher list and instructor assignment state
  const teachersQuery = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'teacher'));
  }, [firestore, isAdmin]);
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
      // simple guard: if google-meet selected, ensure URL is present
      if (data.livePlatform === 'google-meet' && !data.liveMeetUrl) {
        toast({ variant: 'destructive', title: 'Live URL required', description: 'Please provide the Google Meet URL.' });
        setIsLoading(false);
        return;
      }
      // normalize live fields
      const makeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
      const defaultRoom = `CloudAIAcademy-${(course as any)?.slug || (course as any)?.id || makeSlug(data.title)}`;
      const cleaned = {
        ...data,
        liveJitsiRoom: data.livePlatform === 'jitsi' ? (data.liveJitsiRoom?.trim() || defaultRoom) : null,
        liveMeetUrl: data.livePlatform === 'google-meet' ? (data.liveMeetUrl?.trim() || null) : null,
      } as CourseFormValues;
      // Prevent teachers from accidentally toggling admin-only fields.
      const cleanedForSave: CourseFormValues = isAdmin ? cleaned : ({ ...(cleaned as any), isFull: undefined } as any);

      const extra = isAdmin
        ? {
            ...(ownerId ? { ownerId } : {}),
            instructorIds: Array.from(new Set([...(instructorIds || []), ...(ownerId ? [ownerId] : [])])),
          }
        : undefined;
      if (isEditMode) {
        await updateCourse(course.id!, { ...cleanedForSave, ...(extra || {}) });
        toast({
          title: 'Course Updated!',
          description: `${cleaned.title} has been successfully updated.`,
        });
      } else {
        await addCourse(cleanedForSave, extra);
        toast({
          title: 'Course Created!',
          description: `${cleaned.title} has been successfully added.`,
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
          name="courseCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., AWSFND, PY101, AI-BASICS"
                  autoCapitalize="characters"
                  spellCheck={false}
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course image URL (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., /images/course-aws.png"
                  spellCheck={false}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Tip: put an image in <span className="font-mono">public/images</span> and use <span className="font-mono">/images/filename.png</span>.
              </p>
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
          <FormField
            control={form.control}
            name="isFull"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Course is full (use waiting list)</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    If enabled, students will see "Join Waiting List" instead of "Enroll Now".
                  </p>
                </div>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="totalHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Hours (for certificate)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g., 15"
                  value={(field.value ?? '') as any}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
        {isAdmin && (
          <div className="space-y-4 border-t pt-6">
            <FormLabel>Live session</FormLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="livePlatform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Live platform</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select live platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="jitsi">Jitsi</SelectItem>
                        <SelectItem value="google-meet">Google Meet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('livePlatform') === 'jitsi' && (
                <FormField
                  control={form.control}
                  name="liveJitsiRoom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jitsi room name</FormLabel>
                      <FormControl>
                        <Input placeholder={`CloudAIAcademy-${(course as any)?.slug || (course as any)?.id || 'course-slug'}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch('livePlatform') === 'google-meet' && (
                <FormField
                  control={form.control}
                  name="liveMeetUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Meet URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://meet.google.com/abc-defg-hij" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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

    
