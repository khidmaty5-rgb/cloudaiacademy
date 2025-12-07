
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/components/i18n/lang';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const { lang } = useLang();
  const t = {
    en: {
      title: 'Admin & Teacher Login',
      description: 'Access the administration dashboard.',
      emailLabel: 'Email',
      emailPlaceholder: 'admin@example.com',
      passwordLabel: 'Password',
      loginButton: 'Log In',
      loginFailedTitle: 'Login Failed',
      loginFailedDesc: 'Please check your credentials or role.',
    },
    ar: {
      title: 'تسجيل دخول المشرفين والمعلمين',
      description: 'الوصول إلى لوحة تحكم الإدارة.',
      emailLabel: 'البريد الإلكتروني',
      emailPlaceholder: 'admin@example.com',
      passwordLabel: 'كلمة المرور',
      loginButton: 'تسجيل الدخول',
      loginFailedTitle: 'فشل تسجيل الدخول',
      loginFailedDesc: 'يرجى التحقق من بيانات الدخول أو الدور.',
    },
  }[lang];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      // Redirect to the admin dashboard upon successful login
      router.push('/admin/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t.loginFailedTitle,
        description: t.loginFailedDesc,
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="mb-4 inline-block">
            <Logo />
          </Link>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="email">{t.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.emailPlaceholder}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.passwordLabel}</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              {t.loginButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
