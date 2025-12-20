'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addLesson, updateLesson } from '@/lib/lessons';
import type { Lesson } from '@/lib/lessons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WHITEBOARD_TEMPLATE_KEY = 'lessons/shared/whiteboard.pdf';

const lessonSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  content: z.string().min(10, 'Content is too short'),
  embedUrl: z.string().url().optional().or(z.literal('')),
  whiteboardPlatform: z
    .enum(['excalidraw', 'miro', 'ms-whiteboard'])
    .optional()
    .or(z.literal('none'))
    .or(z.literal('')),
  whiteboardUrl: z.string().url().optional().or(z.literal('')),
  codingPlatform: z
    .enum(['replit', 'codesandbox', 'stackblitz', 'colab', 'livecodes'])
    .optional()
    .or(z.literal('none'))
    .or(z.literal('')),
  codingUrl: z.string().url().optional().or(z.literal('')),
  labPlatform: z
    .enum(['labex', 'whizlabs', 'vmware-hol', 'virtual-labs'])
    .optional()
    .or(z.literal('none'))
    .or(z.literal('')),
  labUrl: z.string().url().optional().or(z.literal('')),
});

type LessonFormValues = z.infer<typeof lessonSchema>;

type LessonFormProps = {
  courseId: string;
  lesson?: Lesson | null;
  onSuccess?: () => void;
};

export default function LessonForm({ courseId, lesson, onSuccess }: LessonFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [whiteboardToggling, setWhiteboardToggling] = useState(false);
  const [currentPdfPath, setCurrentPdfPath] = useState<string | null>((lesson as any)?.pdfPath ?? null);

  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateCopying, setTemplateCopying] = useState(false);
  const isEditMode = !!lesson;
  const usingSharedTemplate = currentPdfPath === WHITEBOARD_TEMPLATE_KEY;

  useEffect(() => {
    setCurrentPdfPath((lesson as any)?.pdfPath ?? null);
    setTemplateFile(null);
    setWhiteboardToggling(false);
    setTemplateUploading(false);
    setTemplateCopying(false);
  }, [lesson?.id]);

  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: lesson?.title || '',
      content: lesson?.content || '',
      embedUrl: lesson?.embedUrl || '',
      whiteboardPlatform: (lesson as any)?.whiteboardPlatform || '',
      whiteboardUrl: (lesson as any)?.whiteboardUrl || '',
      codingPlatform: (lesson as any)?.codingPlatform || '',
      codingUrl: (lesson as any)?.codingUrl || '',
      labPlatform: (lesson as any)?.labPlatform || '',
      labUrl: (lesson as any)?.labUrl || '',
    },
  });

  const onSubmit = async (data: LessonFormValues) => {
    setIsLoading(true);
    try {
      const payload: any = { ...data };
      // Sanitize new optional fields: drop empty strings so Firestore doesn't get undefined/empty
      ['whiteboardPlatform', 'whiteboardUrl', 'codingPlatform', 'codingUrl', 'labPlatform', 'labUrl']
        .forEach((k) => {
          if (payload[k] === '' || payload[k] === 'none') delete payload[k];
        });

      if (isEditMode) {
        await updateLesson(courseId, lesson.id, payload);
        toast({ title: 'Lesson Updated!' });
      } else {
        await addLesson(courseId, payload);
        toast({ title: 'Lesson Added!' });
      }
      onSuccess?.();
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

  const toggleSharedWhiteboard = async (checked: boolean) => {
    if (!lesson) return;
    setWhiteboardToggling(true);
    try {
      if (checked) {
        await updateLesson(courseId, lesson.id, { pdfPath: WHITEBOARD_TEMPLATE_KEY });
        setCurrentPdfPath(WHITEBOARD_TEMPLATE_KEY);
        toast({ title: 'Whiteboard PDF enabled for this lesson.' });
      } else {
        await updateLesson(courseId, lesson.id, { pdfPath: null });
        setCurrentPdfPath(null);
        toast({ title: 'Whiteboard PDF disabled for this lesson.' });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err?.message || String(err),
      });
    } finally {
      setWhiteboardToggling(false);
    }
  };

  const uploadSharedTemplate = async () => {
    if (!templateFile) return;
    setTemplateUploading(true);
    try {
      const maxBytes = 20 * 1024 * 1024;
      if (templateFile.size > maxBytes) throw new Error('PDF is too large. Max size is 20 MB.');
      const isPdf =
        templateFile.type === 'application/pdf' || templateFile.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) throw new Error('File must be a PDF (application/pdf).');

      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');

      const presignResp = await fetch('/api/lessons/whiteboard-template/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contentType: 'application/pdf' }),
      });
      const presignJson = await presignResp.json().catch(() => ({}));
      if (!presignResp.ok) throw new Error(presignJson?.error || 'Failed to create upload URL');
      const uploadUrl = presignJson?.url as string | undefined;
      if (!uploadUrl) throw new Error('Invalid presign response');

      const putResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: templateFile,
      });
      if (!putResp.ok) throw new Error(`Upload failed with status ${putResp.status}`);

      toast({ title: 'Shared whiteboard template uploaded.' });
      setTemplateFile(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Template Upload Failed',
        description: err?.message || String(err),
      });
    } finally {
      setTemplateUploading(false);
    }
  };

  const copyLessonPdfToTemplate = async () => {
    if (!lesson) return;
    if (!currentPdfPath || currentPdfPath === WHITEBOARD_TEMPLATE_KEY) return;

    setTemplateCopying(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');

      const resp = await fetch('/api/lessons/whiteboard-template/copy-from-lesson', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId, lessonId: lesson.id }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || 'Failed to copy template');

      toast({ title: 'Shared whiteboard template updated from this lesson.' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: err?.message || String(err),
      });
    } finally {
      setTemplateCopying(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lesson Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Introduction to Firestore" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lesson Content</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="The main text content for the lesson."
                  rows={8}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="embedUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code Embed URL (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://stackblitz.com/..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-2">
          <h3 className="text-lg font-semibold">External Learning Tools</h3>
          <div className="mt-4 grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="whiteboardPlatform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Whiteboard Platform</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="excalidraw">Excalidraw</SelectItem>
                        <SelectItem value="miro">Miro</SelectItem>
                        <SelectItem value="ms-whiteboard">Microsoft Whiteboard</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whiteboardUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Whiteboard URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://excalidraw.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codingPlatform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coding Platform</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="replit">Replit</SelectItem>
                        <SelectItem value="codesandbox">CodeSandbox</SelectItem>
                        <SelectItem value="stackblitz">StackBlitz</SelectItem>
                        <SelectItem value="colab">Colab</SelectItem>
                        <SelectItem value="livecodes">LiveCodes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="codingUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coding URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://stackblitz.com/edit/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="labPlatform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cloud Lab Platform</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="labex">LabEx</SelectItem>
                        <SelectItem value="whizlabs">Whizlabs</SelectItem>
                        <SelectItem value="vmware-hol">VMware Hands-on Labs</SelectItem>
                        <SelectItem value="virtual-labs">Virtual Labs</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="labUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cloud Lab URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://labs.whizlabs.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <h3 className="text-lg font-semibold">Whiteboard PDF</h3>
          <div className="mt-3 space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="use-shared-whiteboard"
                checked={usingSharedTemplate}
                disabled={!isEditMode || whiteboardToggling}
                onCheckedChange={(v) => toggleSharedWhiteboard(v === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="use-shared-whiteboard">
                  Use shared whiteboard PDF (reusable across all lessons)
                </Label>
                <p className="text-xs text-muted-foreground">
                  One global file is reused everywhere. No per-lesson uploads.
                </p>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Shared template (global)</p>
              <Input
                type="file"
                accept="application/pdf"
                disabled={templateUploading || templateCopying}
                onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="bg-accent text-accent-foreground"
                  onClick={uploadSharedTemplate}
                  disabled={!templateFile || templateUploading || templateCopying}
                >
                  {templateUploading ? 'Uploading...' : 'Upload / Replace Whiteboard Template'}
                </Button>
                {isEditMode && currentPdfPath && currentPdfPath !== WHITEBOARD_TEMPLATE_KEY ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyLessonPdfToTemplate}
                    disabled={templateUploading || templateCopying}
                  >
                    {templateCopying ? 'Copying...' : 'Use This Lesson PDF as Template'}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload once, then just check the box above on any lesson to activate it.
              </p>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading
            ? isEditMode
              ? 'Saving Changes...'
              : 'Adding Lesson...'
            : isEditMode
            ? 'Save Changes'
            : 'Add Lesson'}
        </Button>
      </form>
    </Form>
  );
}
