'use client';

import { useState } from 'react';
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
  const isEditMode = !!lesson;

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
