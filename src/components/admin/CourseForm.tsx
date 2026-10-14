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
import { PACKAGE_LIMITS, type LessonPackage } from '@/lib/lesson-package';
import { suggestCourseDetails, courseManifest } from '@/lib/course-package-details';
import { lessonImportRequest } from '@/lib/lesson-import-client';
import { InteractiveLessonPlayer } from '@/components/learn/interactive-lesson-player';
import { ImportedLessonContent } from '@/components/learn/imported-lesson-content';
import { CourseImageInput } from './CourseImageInput';
import { isCourseImageData } from '@/lib/course-image-upload';

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
      return trimmed;
    },
    z
      .string()
      .refine(
        (v) => v === '' || v.startsWith('/') || v.startsWith('http://') || v.startsWith('https://') || isCourseImageData(v),
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
  const [imageBusy, setImageBusy] = useState(false);
  const [uploading,setUploading]=useState(false);
  const [uploadMode,setUploadMode]=useState<'interactive'|'standard'>('interactive');
  const [packageUpload,setPackageUpload]=useState<{name:string;id:string;pkg:LessonPackage}|null>(null);
  const [packageError,setPackageError]=useState('');
  const [previewPackage,setPreviewPackage]=useState(false);
  const [createdCourse,setCreatedCourse]=useState<{id:string;slug:string}|null>(null);
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

  async function uploadCoursePackage(file:File) {
    setUploading(true);setPackageError('');setPreviewPackage(false);setPackageUpload(null);
    try {
      if(file.size>PACKAGE_LIMITS.zip)throw new Error('ZIP_TOO_LARGE');
      const bytes=new Uint8Array(await file.arrayBuffer());
      let pkg:LessonPackage;
      const isHtml=/\.html?$/i.test(file.name);
      if(uploadMode==='interactive') {
        const parser=await import('@/lib/parse-interactive-zip');
        pkg=isHtml?parser.parseInteractiveHtml(await file.text(),file.name):parser.parseInteractiveZip(bytes);
      } else {
        if(isHtml)throw new Error('ZIP_REQUIRED');
        pkg=(await import('@/lib/parse-lesson-zip')).parseLessonZip(bytes);
      }
      const suggestions=suggestCourseDetails(pkg,file.name,isHtml?{}:courseManifest(bytes));
      for(const [key,value] of Object.entries(suggestions)) {
        const field=key as keyof CourseFormValues;
        if(value!==undefined && value!=='' && !form.getFieldState(field).isDirty)form.setValue(field,value as never,{shouldValidate:true});
      }
      setPackageUpload({name:file.name,id:crypto.randomUUID(),pkg});
    } catch {
      setPackageError(lang==='ar'?'تعذّر قراءة الحزمة. تأكد من تضمين الملفات المطلوبة واختر نوع الاستيراد المناسب.':'Could not read this package. Include its required assets and select the appropriate import mode.');
    } finally {setUploading(false);}
  }

  const onSubmit = async (data: CourseFormValues) => {
    if (imageBusy) return;
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
        let saved=createdCourse;
        if(saved) await updateCourse(saved.id,{...cleanedForSave,...extra});
        else {saved=await addCourse(cleanedForSave,extra);setCreatedCourse(saved);}
        if(packageUpload) {
          const result=await lessonImportRequest(saved.id,{action:'save',importId:packageUpload.id,name:packageUpload.name,lessons:packageUpload.pkg.lessons});
          if(!['DRAFT','PUBLISHED'].includes(result.status))throw new Error('IMPORT_CONFLICT');
          toast({title:lang==='ar'?'حُفظت الدورة والدروس':'Course and lesson drafts saved',description:lang==='ar'?'راجع الدروس ثم انشرها عندما تكون جاهزة.':'Review the lessons and publish when ready.'});
          router.push('/admin/courses/edit/'+encodeURIComponent(saved.slug)+(result.status==='DRAFT'?'?lessonImport='+packageUpload.id:''));
          router.refresh();return;
        }
        toast({
          title: t("Course Created!"),
          description: lang === 'ar' ? `تمت إضافة ${cleaned.title} بنجاح.` : `${cleaned.title} has been successfully added.`,
        });
      }
      router.push('/admin/courses');
      router.refresh(); // To reflect changes in the table
    } catch (error: any) {
      if(createdCourse || packageUpload)setPackageError(lang==='ar'?'تعذّر إكمال الحفظ. أعد المحاولة لاستكمال رفع الدروس.':'Saving could not finish. Retry to complete the lesson upload.');
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
        {!isEditMode&&isAdmin&&<section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-lg font-semibold">{lang==='ar'?'ابدأ برفع حزمة الدورة':'Start with a course package'}</h2>
          <p className="text-sm text-muted-foreground">{lang==='ar'?'ارفع ZIP أو HTML لتعبئة التفاصيل المتاحة وتجهيز الدروس. راجع السعر والحقول الناقصة قبل الحفظ.':'Upload ZIP or HTML to fill available course details and prepare lessons. Review pricing and missing fields before saving.'}</p>
          <label className="block space-y-1 text-sm"><span>{lang==='ar'?'نوع الدروس':'Lesson mode'}</span><select className="w-full rounded-md border bg-background p-2" value={uploadMode} disabled={uploading||isLoading} onChange={e=>{setUploadMode(e.target.value as 'interactive'|'standard');setPackageUpload(null);setPreviewPackage(false);}}><option value="interactive">{lang==='ar'?'HTML تفاعلي':'Interactive HTML'}</option><option value="standard">{lang==='ar'?'دروس قياسية مبسّطة':'Standard simplified lessons'}</option></select></label>
          <label className="block space-y-1 text-sm"><span>{lang==='ar'?'ملف الدورة ZIP أو HTML':'Course ZIP or HTML file'}</span><Input type="file" accept={uploadMode==='interactive'?'.zip,.html,.htm':'.zip'} disabled={uploading||isLoading} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadCoursePackage(file);e.target.value='';}}/></label>
          {uploading&&<p role="status">{lang==='ar'?'جارٍ قراءة الدورة…':'Reading course package…'}</p>}
          {packageError&&<p role="alert" className="text-sm text-destructive">{packageError}</p>}
          {createdCourse&&packageError&&<p className="text-sm">{lang==='ar'?'الدورة محفوظة بالفعل. إعادة المحاولة ستستخدم الدورة نفسها.':'The course is already saved. Retrying will use the same course.'}</p>}
          {packageUpload&&<div className="space-y-2"><p role="status" className="break-words text-sm">{packageUpload.name} · {packageUpload.pkg.lessons.length} {lang==='ar'?'دروس جاهزة للحفظ كمسودات. التفاصيل مقترحة وقابلة للتعديل.':'lessons ready to save as drafts. Suggested details are editable.'}</p><Button type="button" variant="outline" size="sm" onClick={()=>setPreviewPackage(value=>!value)}>{lang==='ar'?'معاينة الدرس الأول':'Preview first lesson'}</Button>{previewPackage&&(packageUpload.pkg.lessons[0].interactiveHtml?<InteractiveLessonPlayer title={packageUpload.pkg.lessons[0].title} html={packageUpload.pkg.lessons[0].interactiveHtml}/>:<ImportedLessonContent nodes={packageUpload.pkg.lessons[0].nodes}/>)}</div>}
        </section>}
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
              <p className="text-sm font-medium">{lang === 'ar' ? 'صورة الدورة (اختيارية)' : 'Course image (optional)'}</p>
              <CourseImageInput value={field.value || ''} onChange={field.onChange} disabled={isLoading} arabic={lang === 'ar'} onBusyChange={setImageBusy} />
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
                 <Select onValueChange={field.onChange} value={field.value}>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                  value={field.value}
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
        <Button type="submit" disabled={isLoading||uploading||imageBusy} className="w-full">
          {isLoading
            ? isEditMode
              ? t("Saving Changes...")
              : createdCourse ? (lang==='ar'?'جارٍ حفظ الدروس…':'Saving lesson drafts…') : t("Creating Course...")
            : isEditMode
            ? t("Save Changes")
            : createdCourse&&packageUpload ? (lang==='ar'?'إعادة رفع الدروس':'Retry lesson upload') : t("Create Course")}
        </Button>
      </form>
    </Form>
  );
}

    
