'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useToast } from '@/hooks/use-toast';
import { createUserWithRole } from '@/lib/user';
import { useEffect } from 'react';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';

const newUserSchema = z.object({
  fullName: z.string().min(3, 'Full name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
  role: z.enum(['student', 'teacher', 'admin']),
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const firestore = getFirestore();
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();
  const t = {
    en: {
      pageTitle: 'Create New User',
      cardTitle: 'New User Details',
      cardDescription: 'Create a new account and assign a role.',
      fullName: 'Full Name',
      fullNamePlaceholder: 'John Doe',
      email: 'Email Address',
      emailPlaceholder: 'user@example.com',
      password: 'Password',
      role: 'Role',
      student: 'Student',
      teacher: 'Teacher',
      admin: 'Admin',
      createButton: 'Create User',
      creatingButton: 'Creating User...',
      createdTitle: 'User Created!',
      createdDesc: (name: string, role: string) =>
        `Account for ${name} has been created with the role: ${role}.`,
      creationFailedTitle: 'Creation Failed',
      creationFailedDesc: 'An unexpected error occurred.',
      noPermission: 'You do not have permission to view this page.',
    },
    ar: {
      pageTitle: 'إنشاء مستخدم جديد',
      cardTitle: 'بيانات المستخدم الجديد',
      cardDescription: 'قم بإنشاء حساب جديد وتعيين الدور المناسب.',
      fullName: 'الاسم الكامل',
      fullNamePlaceholder: 'محمد أحمد',
      email: 'البريد الإلكتروني',
      emailPlaceholder: 'user@example.com',
      password: 'كلمة المرور',
      role: 'الدور',
      student: 'طالب',
      teacher: 'معلم',
      admin: 'مشرف',
      createButton: 'إنشاء المستخدم',
      creatingButton: 'جارٍ إنشاء المستخدم...',
      createdTitle: 'تم إنشاء المستخدم!',
      createdDesc: (name: string, role: string) =>
        `تم إنشاء حساب لـ ${name} بدور: ${role}.`,
      creationFailedTitle: 'فشل الإنشاء',
      creationFailedDesc: 'حدث خطأ غير متوقع.',
      noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    },
  }[lang];

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userDocRef);

  // useCurrentRole handles admin detection

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'student',
    },
  });

  const onSubmit = async (data: NewUserFormValues) => {
    setIsLoading(true);
    try {
      await createUserWithRole(data.email, data.password, data.fullName, data.role);
      toast({
        title: t.createdTitle,
        description: t.createdDesc(
          data.fullName,
          data.role === 'student' ? t.student : data.role === 'teacher' ? t.teacher : t.admin,
        ),
      });
      router.push('/admin/users');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t.creationFailedTitle,
        description: error.message || t.creationFailedDesc,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canView = isAdmin === true;

  if (roleLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-2xl mx-auto">
            <Skeleton className="h-8 w-1/2 mb-8" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-2xl mx-auto">
          {canView ? (
            <>
              <h1 className="font-headline text-3xl md:text-4xl font-bold mb-8">
                {t.pageTitle}
              </h1>
              <Card>
                <CardHeader>
                  <CardTitle>{t.cardTitle}</CardTitle>
                  <CardDescription>
                    {t.cardDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.fullName}</FormLabel>
                            <FormControl>
                              <Input placeholder={t.fullNamePlaceholder} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.email}</FormLabel>
                            <FormControl>
                              <Input placeholder={t.emailPlaceholder} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.password}</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.role}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="student">{t.student}</SelectItem>
                                <SelectItem value="teacher">{t.teacher}</SelectItem>
                                <SelectItem value="admin">{t.admin}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? t.creatingButton : t.createButton}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t.noPermission}</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
