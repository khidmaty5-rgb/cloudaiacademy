'use client';
import { academy } from '@/lib/academy';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEditorCopy } from './editor-copy';
import { Label } from '@/components/ui/label';
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

const createCourseSchema = (t: (text: string) => string) => z.object({
  title: z.string().min(3, t("Title must be at least 3 characters long")),
  courseCode: z
    .string()
    .trim()
    .min(2, t("Course code must be at least 2 characters"))
    .max(12, t("Course code must be 12 characters or less"))
    .regex(/^[A-Za-z0-9-]+$/, t("Use only letters, numbers, and hyphens"))
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
        t("Use a full URL or a /images/... path"),
      )
      .optional(),
  ),
  description: z.string().min(10, t("Description is too short")),
  category: z.string().min(1, t("Category is required")),
  price: z.string().min(1, t("Price is required")),
  duration: z.string().min(1, t("Duration is required")),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  isFull: z.boolean().default(false),
  totalHours: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int(t('Enter a whole number')).positive(t('Enter a positive number')).optional(),
  ),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  livePlatform: livePlatformSchema.default('none'),
  liveJitsiRoom: z.string().optional(),
  liveMeetUrl: z.union([z.string().url(t('Enter a valid URL')), z.literal('')]).optional(),
});

type CourseFormValues = z.infer<ReturnType<typeof createCourseSchema>>;

type CourseFormProps = {
  course?: CourseFormValues & { id?: string };
};

export default function CourseForm({ course }: CourseFormProps) {
  const { t, lang } = useEditorCopy();
  const courseSchema = createCourseSchema(t);
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
      status: isEditMode ? ((course as any)?.status as any) ?? 'PUBLISHED' : 'DRAFT',
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
        toast({ variant: 'destructive', title: t("Live URL required"), description: t("Please provide the Google Meet URL.") });
        setIsLoading(false);
        return;
      }
      // normalize live fields
      const makeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
      const defaultRoom = `${academy.meetingPrefix}-${(course as any)?.slug || (course as any)?.id || makeSlug(data.title)}`;
      const cleaned = {
        ...data,
        liveJitsiRoom: data.livePlatform === 'jitsi' ? (data.liveJitsiRoom?.trim() || defaultRoom) : null,
        liveMeetUrl: data.livePlatform === 'google-meet' ? (data.liveMeetUrl?.trim() || null) : null,
      } as CourseFormValues;
      // Prevent teachers from accidentally toggling admin-only fields.
      const cleanedForSave: CourseFormValues = isAdmin
        ? cleaned
        : ({
            ...(cleaned as any),
            isFull: undefined,
            status: undefined,
            livePlatform: undefined,
            liveJitsiRoom: undefined,
            liveMeetUrl: undefined,
          } as any);

      const extra = isAdmin
        ? {
            ...(ownerId ? { ownerId } : {}),
            instructorIds: Array.from(new Set([...(instructorIds || []), ...(ownerId ? [ownerId] : [])])),
          }
        : undefined;
      if (isEditMode) {
        await updateCourse(course.id!, { ...cleanedForSave, ...(extra || {}) });
        toast({
          title: t("Course Updated!"),
          description: lang === 'ar' ? `تم تحديث ${cleaned.title} بنجاح.` : `${cleaned.title} has been successfully updated.`,
        });
      } else {
        await addCourse(cleanedForSave, extra);
        toast({
          title: t("Course Created!"),
          description: lang === 'ar' ? `تمت إضافة ${cleaned.title} بنجاح.` : `${cleaned.title} has been successfully added.`,
        });
      }
      router.push('/admin/courses');
      router.refresh(); // To reflect changes in the table
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t("Operation Failed"),
        description: error.message || t("An unexpected error occurred."),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("Course Title")}</FormLabel>
              <FormControl>
                <Input dir="auto" placeholder={t("e.g., Introduction to Cloud Computing")} {...field} />
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
              <FormLabel>{t("Course Code")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("e.g., AWSFND, PY101, AI-BASICS")}
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
              <FormLabel>{t("Course image URL (optional)")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("e.g., /images/course-aws.png")}
                  spellCheck={false}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? 'أدخل رابط الصورة أو مسارها، مثل /images/filename.png.' : 'Enter an image URL or path, such as /images/filename.png.'}
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
              <FormLabel>{t("Course Description")}</FormLabel>
              <FormControl>
                <Textarea dir="auto"
                  placeholder={t("A brief summary of what the course covers.")}
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
                <FormLabel>{t("Category")}</FormLabel>
                <FormControl>
                    <Input dir="auto" placeholder={t("e.g., AI, Cloud, Web Dev")} {...field} />
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
                <FormLabel>{t("Price")}</FormLabel>
                <FormControl>
                    <Input dir="auto" placeholder={t("e.g., $299 or Free")} {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
         </div>

         {isAdmin && (
           <FormField
             control={form.control}
             name="status"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>{t("Visibility")}</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                   <FormControl>
                     <SelectTrigger>
                       <SelectValue placeholder={t("Select visibility")} />
                     </SelectTrigger>
                   </FormControl>
                   <SelectContent>
                     <SelectItem value="DRAFT">{t("Draft (hidden)")}</SelectItem>
                     <SelectItem value="PUBLISHED">{t("Published (public)")}</SelectItem>
                   </SelectContent>
                 </Select>
                 <p className="text-xs text-muted-foreground">{t("Draft courses won’t appear on public course lists.")}</p>
                 <FormMessage />
               </FormItem>
             )}
           />
         )}

         {isAdmin && (
           <FormField
             control={form.control}
             name="isFull"
             render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>{t("Course is full (use waiting list)")}</FormLabel>
                  <p className="text-sm text-muted-foreground">{t("If enabled, students will see \"Join Waiting List\" instead of \"Enroll Now\".")}</p>
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
              <FormLabel>{t("Total Hours (for certificate)")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  placeholder={t("e.g., 15")}
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
            <h3 className="font-semibold">{t("Instructors")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="primary-instructor" className="text-sm text-muted-foreground">{t("Primary Instructor")}</Label>
                <Select onValueChange={(v) => setOwnerId(v)} defaultValue={ownerId}>
                  <SelectTrigger id="primary-instructor">
                      <SelectValue placeholder={t("Select primary instructor")} />
                    </SelectTrigger>
                  <SelectContent>
                    {teacherOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("Additional Instructors")}</p>
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
            <h3 id="live-session-settings" className="scroll-mt-24 font-semibold">{t("Live session")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="livePlatform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Live platform")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select live platform")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t("None")}</SelectItem>
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
                      <FormLabel>{t("Jitsi room name")}</FormLabel>
                      <FormControl>
                        <Input dir="auto" placeholder={`${academy.meetingPrefix}-${(course as any)?.slug || (course as any)?.id || 'course-slug'}`} {...field} />
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
                      <FormLabel>{t("Google Meet URL")}</FormLabel>
                      <FormControl>
                        <Input dir="auto" placeholder="https://meet.google.com/abc-defg-hij" {...field} />
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
                <FormLabel>{t("Duration")}</FormLabel>
                <FormControl>
                  <Input dir="auto" placeholder={t("e.g., 8 weeks")} {...field} />
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
                <FormLabel>{t("Level")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select a level")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Beginner">{t("Beginner")}</SelectItem>
                    <SelectItem value="Intermediate">{t("Intermediate")}</SelectItem>
                    <SelectItem value="Advanced">{t("Advanced")}</SelectItem>
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
              ? t("Saving Changes...")
              : t("Creating Course...")
            : isEditMode
            ? t("Save Changes")
            : t("Create Course")}
        </Button>
      </form>
    </Form>
  );
}

    
