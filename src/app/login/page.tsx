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
import { Suspense, useState } from 'react';
import { signIn } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/components/i18n/lang';
import AuthShell from '@/components/layout/auth-shell';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { lang } = useLang();
  const ar = lang === 'ar';

  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cred = await signIn(email, password);
      const tr = await cred.user.getIdTokenResult(true);
      const role = (tr.claims as any)?.role;
      if (safeNext) {
        router.push(safeNext);
        return;
      }
      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'reviewer') {
        router.push('/reviewer');
      } else if (role === 'editor') {
        router.push('/admin/journal');
      } else if (role === 'teacher') {
        router.push('/teacher/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: ar ? 'تعذّر تسجيل الدخول' : 'Login Failed',
        description: error.message,
      });
    }
  };

  return (
    <AuthShell>
      <Card className="w-full border-border/80 shadow-xl shadow-primary/5">
        <CardHeader className="text-center">
          <Link href="/" className="mb-3 inline-flex justify-center lg:hidden">
            <Logo />
          </Link>
          <CardTitle>{ar ? 'مرحباً بعودتك' : 'Welcome Back'}</CardTitle>
          <CardDescription>
            {ar ? 'سجّل الدخول إلى حسابك في CloudAI Academy.' : 'Log in to your CloudAI Academy account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="email">{ar ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{ar ? 'كلمة المرور' : 'Password'}</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              {ar ? 'تسجيل الدخول' : 'Log In'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {ar ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
            <Link
              href="/signup"
              className="font-medium text-accent hover:underline"
            >
              {ar ? 'إنشاء حساب' : 'Sign up'}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>…</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
