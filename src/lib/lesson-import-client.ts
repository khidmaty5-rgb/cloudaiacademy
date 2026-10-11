'use client';
import { getAuth } from 'firebase/auth';
export async function lessonImportRequest(courseId:string, action?:Record<string,unknown>, query='') {
  const user=getAuth().currentUser; if(!user)throw new Error('UNAUTHORIZED');
  const response=await fetch('/api/courses/'+encodeURIComponent(courseId)+'/lesson-imports'+query,{
    method:action?'POST':'GET',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},...(action?{body:JSON.stringify(action)}:{})
  });
  const data=await response.json(); if(!response.ok)throw new Error(data.error||'IMPORT_FAILED'); return data;
}
