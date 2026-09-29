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
import { signUp } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { LangToggle, useLang } from '@/components/i18n/lang';


function SignupContent() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { lang } = useLang();
  const ar = lang === 'ar';

  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp(email, password, fullName);
      router.push(safeNext || '/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: ar ? 'تعذّر إنشاء الحساب' : 'Signup Failed',
        description: error.message,
      });
    }
  };


  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/50 p-4" dir={ar ? 'rtl' : 'ltr'}>
      <LangToggle className="absolute end-4 top-4 border-border bg-card text-foreground [&_button]:text-foreground" />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="mb-4 inline-block">
            <Logo />
          </Link>
          <CardTitle>{ar ? 'إنشاء حساب' : 'Create an Account'}</CardTitle>
          <CardDescription>
            {ar ? 'ابدأ رحلتك مع CloudAI Academy.' : 'Start your journey with CloudAI Academy.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="space-y-2">
              <Label htmlFor="name">{ar ? 'الاسم الكامل' : 'Full Name'}</Label>
              <Input id="name" placeholder={ar ? 'الاسم الكامل' : 'John Doe'} required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
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
              {ar ? 'إنشاء الحساب' : 'Create Account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {ar ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
            <Link
              href="/login"
              className="font-medium text-accent hover:underline"
            >
              {ar ? 'تسجيل الدخول' : 'Log in'}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <CardTitle>…</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
