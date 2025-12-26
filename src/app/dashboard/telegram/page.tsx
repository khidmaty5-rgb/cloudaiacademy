'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, getFirestore } from 'firebase/firestore';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface TgJob {
  id: string;
  sendAt?: any;
  status: 'scheduled'|'sent'|'cancelled'|'failed';
  payload?: { text: string; mediaUrl?: string|null; linkUrl?: string|null };
}

export default function TelegramDashboardPage() {
  const { user, isUserLoading } = useUser();
  const { isAdmin, isTeacher, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();
  const { toast } = useToast();
  const firestore = getFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading: profileLoading } = useDoc<any>(userDocRef);
  const telegram = profile?.telegram || null;

  const [genLoading, setGenLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sendAtLocal, setSendAtLocal] = useState(''); // yyyy-MM-ddTHH:mm (local)

  const [jobs, setJobs] = useState<TgJob[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);

  const isProvider = isAdmin || isTeacher;

  async function authFetch(url: string, init?: RequestInit) {
    const u = getAuth().currentUser;
    if (!u) throw new Error('Not signed in');
    const idToken = await u.getIdToken();
    const headers = new Headers(init?.headers || {});
    headers.set('Authorization', `Bearer ${idToken}`);
    if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers });
  }

  async function handleGenerateCode() {
    setGenLoading(true);
    setCode(null);
    setExpiresAt(null);
    try {
      const resp = await authFetch('/api/telegram/connect/start', { method: 'POST' });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || 'Failed');
      setCode(j.code);
      setExpiresAt(j.expiresAt);
      toast({ title: lang === 'ar' ? 'تم إنشاء الرمز' : 'Code generated' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: lang === 'ar' ? 'فشل' : 'Failed', description: e?.message || 'Error' });
    } finally {
      setGenLoading(false);
    }
  }

  async function loadJobs() {
    try {
      setJobsLoading(true);
      const resp = await authFetch('/api/telegram/jobs/list');
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || 'Failed');
      setJobs(Array.isArray(j.jobs) ? j.jobs : []);
    } catch (e) {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }

  useEffect(() => {
    if (user && isProvider) loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isProvider]);

  async function createJob(payload: { text: string; mediaUrl?: string; linkUrl?: string; sendAt?: string; }) {
    const body: any = { text: payload.text.trim() };
    if (payload.mediaUrl) body.mediaUrl = payload.mediaUrl.trim();
    if (payload.linkUrl) body.linkUrl = payload.linkUrl.trim();
    if (payload.sendAt) body.sendAt = payload.sendAt;
    const resp = await authFetch('/api/telegram/jobs/create', { method: 'POST', body: JSON.stringify(body) });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j?.error || 'Failed to create');
    return j;
  }

  async function handleSendNow() {
    try {
      if (!text.trim()) return;
      await createJob({ text, mediaUrl, linkUrl });
      setText(''); setMediaUrl(''); setLinkUrl('');
      toast({ title: lang === 'ar' ? 'تم الإرسال' : 'Sent' });
      loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: lang === 'ar' ? 'فشل' : 'Failed', description: e?.message || 'Error' });
    }
  }

  async function handleSchedule() {
    try {
      if (!text.trim()) return;
      if (!sendAtLocal) throw new Error('Pick a date/time');
      const when = new Date(sendAtLocal);
      if (Number.isNaN(when.getTime())) throw new Error('Invalid date/time');
      await createJob({ text, mediaUrl, linkUrl, sendAt: when.toISOString() });
      setText(''); setMediaUrl(''); setLinkUrl(''); setSendAtLocal(''); setScheduleOpen(false);
      toast({ title: lang === 'ar' ? 'تمت الجدولة' : 'Scheduled' });
      loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: lang === 'ar' ? 'فشل' : 'Failed', description: e?.message || 'Error' });
    }
  }

  async function handleCancel(jobId: string) {
    try {
      const resp = await authFetch('/api/telegram/jobs/cancel', { method: 'POST', body: JSON.stringify({ jobId }) });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || 'Failed');
      toast({ title: lang === 'ar' ? 'تم الإلغاء' : 'Cancelled' });
      loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: lang === 'ar' ? 'فشل' : 'Failed', description: e?.message || 'Error' });
    }
  }

  function toMillisLike(v: any): number {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const d = new Date(v); return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000 + (typeof v.nanoseconds === 'number' ? v.nanoseconds / 1e6 : 0);
    if (typeof v._seconds === 'number') return v._seconds * 1000 + (typeof v._nanoseconds === 'number' ? v._nanoseconds / 1e6 : 0);
    return 0;
  }

  if (isUserLoading || roleLoading || profileLoading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (!user || !isProvider) {
    return <div className="text-center py-16 text-muted-foreground">{lang === 'ar' ? 'ليس لديك صلاحية الوصول.' : 'No permission.'}</div>;
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="font-headline text-3xl md:text-4xl font-bold">Telegram</h1>

      {/* Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === 'ar' ? 'الاتصال' : 'Connection'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!telegram?.verified ? (
            <div className="space-y-3">
              <Button onClick={handleGenerateCode} disabled={genLoading}>{genLoading ? (lang === 'ar' ? 'جاري الإنشاء...' : 'Generating...') : (lang === 'ar' ? 'إنشاء رمز' : 'Generate code')}</Button>
              {code && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-2"><strong>CODE:</strong> <span className="font-mono">{code}</span> {expiresAt ? <span className="text-muted-foreground">({lang === 'ar' ? 'ينتهي' : 'expires'} {new Date(expiresAt).toLocaleTimeString()})</span> : null}</div>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>{lang === 'ar' ? 'أضف البوت إلى مجموعتك/قناتك كمسؤول' : 'Add the bot to your Telegram group/channel as an admin'} (<code>@YourBotUsername</code>)</li>
                    <li>{lang === 'ar' ? 'أرسل الرسالة' : 'Send the message'}: <code>/connect {code}</code></li>
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div><strong>{lang === 'ar' ? 'الحالة' : 'Status'}:</strong> {lang === 'ar' ? 'متصل' : 'Connected'}</div>
              <div><strong>{lang === 'ar' ? 'المجموعة/القناة' : 'Chat'}:</strong> {telegram.chatTitle || '—'} ({telegram.chatType || '—'})</div>
              {telegram.verifiedAt && <div className="text-muted-foreground">{lang === 'ar' ? 'تاريخ التحقق' : 'Verified at'}: {new Date(toMillisLike(telegram.verifiedAt)).toLocaleString()}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === 'ar' ? 'منشور جديد' : 'New Post'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!telegram?.verified ? (
            <div className="text-muted-foreground text-sm">{lang === 'ar' ? 'الرجاء توصيل تيليجرام أولاً.' : 'Please connect Telegram first.'}</div>
          ) : (
            <>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={lang === 'ar' ? 'نص الرسالة...' : 'Post text...'} rows={4} />
              <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={lang === 'ar' ? 'رابط صورة اختياري' : 'Optional media URL'} />
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder={lang === 'ar' ? 'رابط اختياري' : 'Optional link URL'} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSendNow} disabled={!text.trim()}>{lang === 'ar' ? 'أرسل الآن' : 'Send now'}</Button>
                <Button variant="secondary" onClick={() => setScheduleOpen((s) => !s)}>{lang === 'ar' ? 'جدولة' : 'Schedule'}</Button>
                {scheduleOpen && (
                  <div className="flex items-center gap-2">
                    <input type="datetime-local" value={sendAtLocal} onChange={(e) => setSendAtLocal(e.target.value)} className="border rounded px-2 py-1" />
                    <Button onClick={handleSchedule} disabled={!text.trim() || !sendAtLocal}>{lang === 'ar' ? 'تأكيد الجدولة' : 'Confirm schedule'}</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Jobs list */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === 'ar' ? 'المهام' : 'Jobs'}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !jobs || jobs.length === 0 ? (
            <div className="text-muted-foreground text-sm">{lang === 'ar' ? 'لا توجد مهام.' : 'No jobs yet.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">{lang === 'ar' ? 'الوقت' : 'Send at'}</th>
                    <th className="py-2 pr-4">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="py-2 pr-4">{lang === 'ar' ? 'المحتوى' : 'Preview'}</th>
                    <th className="py-2 pr-4">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b">
                      <td className="py-2 pr-4">{toMillisLike(j.sendAt) ? new Date(toMillisLike(j.sendAt)).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-4">{j.status}</td>
                      <td className="py-2 pr-4 truncate max-w-[320px]">{j.payload?.text || ''}</td>
                      <td className="py-2 pr-4">
                        {j.status === 'scheduled' ? (
                          <Button size="sm" variant="outline" onClick={() => handleCancel(j.id)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
