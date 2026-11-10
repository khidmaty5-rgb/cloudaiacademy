'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function OpenAssignmentStaff({courseId}:{courseId:string}) {
  const {user}=useUser(); const {lang}=useLang(); const ar=lang==='ar';
  const [email,setEmail]=useState(''); const [status,setStatus]=useState(''); const [busy,setBusy]=useState(false);
  async function save(value:string) {
    setBusy(true);setStatus('');
    try {
      const res=await fetch('/api/assignment-instructors',{method:'PUT',headers:{Authorization:'Bearer '+await user?.getIdToken(),'Content-Type':'application/json'},body:JSON.stringify({courseId,email:value})});
      if (!res.ok) throw Error();
      setStatus(ar?'تم تحديث صلاحية المدرّس.':'Instructor access updated.');
    } catch {setStatus(ar?'تعذّر التحديث. تحقق من حساب المدرّس.':'Update failed. Check the instructor account and retry.');}
    finally {setBusy(false);}
  }
  return <form className="space-y-2 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();void save(email.trim());}}>
    <label>{ar?'مدرّس واجبات الدورة (البريد الإلكتروني)':'Course assignment instructor (email)'}<Input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <Button disabled={busy}>{ar?'تعيين أو استبدال المدرّس':'Assign or replace instructor'}</Button>{' '}
    <Button type="button" variant="outline" disabled={busy} onClick={()=>{if(window.confirm(ar?'إلغاء وصول المدرّس الحالي؟':'Remove the current instructor’s assignment access?')) void save('');}}>{ar?'إلغاء صلاحية المدرّس':'Remove instructor access'}</Button>
    <p role="status">{status}</p>
  </form>;
}

export function MyOpenAssignments() {
  const {user}=useUser(); const {lang}=useLang();
  const [items,setItems]=useState<{id:string;title:{ar:string;en:string}}[]>([]); const [failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;setItems([]);setFailed(false);if(user)void (async()=>{try{
    const r=await fetch('/api/assignment-instructors',{headers:{Authorization:'Bearer '+await user.getIdToken()},cache:'no-store'});if(!r.ok)throw Error();
    const v=await r.json();if(active)setItems(v.items);
  }catch{if(active)setFailed(true);}})();return()=>{active=false;};},[user]);
  if(failed)return <p role="alert">{lang==='ar'?'تعذّر تحميل واجبات الدورات المفتوحة.':'Could not load open-course assignments.'}</p>;
  if(!items.length)return null;
  return <section><h2>{lang==='ar'?'واجبات الدورات المفتوحة':'Open-course assignments'}</h2><ul>{items.map(i=><li key={i.id}><Link className="underline" href={'/assignments/open/'+i.id+'?manage=1'}>{i.title[lang]}</Link></li>)}</ul></section>;
}
