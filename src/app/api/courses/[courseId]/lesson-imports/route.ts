import { NextRequest, NextResponse } from 'next/server';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { firebaseConfig } from '@/firebase/config';
import { getEffectiveUserRole } from '@/server/effective-user-role';
import { canManageLessonImport } from '@/server/lesson-import-policy';
import { contentText, PACKAGE_LIMITS, validatePackage, type PackageLesson } from '@/lib/lesson-package';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = {params: Promise<{courseId:string}>};
class RequestError extends Error { constructor(message:string, public status = 400) {super(message);} }
function app() {
  const name = 'lesson-imports';
  const existing = getApps().find(a => a.name === name);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
  return initializeApp({projectId, credential:clientEmail && privateKey ? cert({projectId,clientEmail,privateKey}) : applicationDefault()},name);
}
async function authorize(req:NextRequest, context:Context) {
  const {courseId} = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,150}$/.test(courseId)) throw new RequestError('INVALID_COURSE');
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new RequestError('UNAUTHORIZED',401);
  const admin = app();
  const decoded = await getAuth(admin).verifyIdToken(token, true).catch(() => {throw new RequestError('UNAUTHORIZED',401);});
  const db = getFirestore(admin);
  const courseRef = db.doc('courses/'+courseId);
  const course = await courseRef.get();
  if (!course.exists) throw new RequestError('NOT_FOUND',404);
  const role = await getEffectiveUserRole(db,decoded.uid,decoded.role);
  if (!canManageLessonImport(role,decoded.uid,course.data()!)) throw new RequestError('FORBIDDEN',403);
  return {db, courseRef, courseId, uid:decoded.uid, tokenRole:decoded.role};
}
async function body(req:NextRequest) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new RequestError('JSON_REQUIRED');
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError('INVALID_REQUEST');
  const chunks:Uint8Array[]=[]; let length=0;
  for (;;) {
    const {value,done}=await reader.read(); if(done) break;
    length+=value.length;
    if(length>PACKAGE_LIMITS.request) {await reader.cancel(); throw new RequestError('PACKAGE_TOO_LARGE',413);}
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RequestError('INVALID_REQUEST'); }
}
function failure(error:unknown) {
  if (error instanceof RequestError) return NextResponse.json({error:error.message},{status:error.status});
  console.error('Lesson import request failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({error:'IMPORT_FAILED'},{status:500});
}
const validId = (id:unknown): id is string => typeof id==='string' && /^[a-f0-9-]{36}$/.test(id);
export async function GET(req:NextRequest, context:Context) {
  try {
    const {courseRef}=await authorize(req,context);
    const id=req.nextUrl.searchParams.get('importId');
    if(id) {
      if(!validId(id)) throw new RequestError('INVALID_REQUEST');
      const ref=courseRef.collection('lessonImports').doc(id);
      const snap=await ref.get();
      if(!snap.exists || snap.data()?.status!=='DRAFT') throw new RequestError('NOT_FOUND',404);
      const drafts=await ref.collection('importLessons').get();
      return NextResponse.json({id,status:'DRAFT',lessons:drafts.docs.map(d => d.data()).sort((a,b)=>a.position-b.position).map(d=>({key:d.key,title:d.title,nodes:JSON.parse(d.richContent)}))},{headers:{'Cache-Control':'private, no-store'}});
    }
    const drafts=await courseRef.collection('lessonImports').orderBy('createdAt','desc').limit(50).get();
    return NextResponse.json({imports:drafts.docs.filter(d=>d.data().status==='DRAFT').map(d=>({id:d.id,name:d.data().name,count:d.data().count}))},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return failure(error);}
}
export async function POST(req:NextRequest, context:Context) {
  try {
    const {db,courseRef,courseId,uid,tokenRole}=await authorize(req,context);
    const data=await body(req);
    if(!data || !validId(data.importId) || !['save','publish','archive'].includes(data.action)) throw new RequestError('INVALID_REQUEST');
    const ref=courseRef.collection('lessonImports').doc(data.importId);
    let lessons:PackageLesson[]=[];
    if(data.action==='save') {
      try {lessons=validatePackage(data).lessons;} catch(error) {throw new RequestError(error instanceof Error ? error.message : 'INVALID_REQUEST');}
    }
    const digest=data.action==='save' ? createHash('sha256').update(JSON.stringify(lessons)).digest('hex') : '';
    const result=await db.runTransaction(async tx=>{
      const course=await tx.get(courseRef);
      const profile=await tx.get(db.doc('users/'+uid));
      const role=profile.exists ? profile.data()?.role : tokenRole;
      if(!course.exists || !canManageLessonImport(role,uid,course.data()!)) throw new RequestError('FORBIDDEN',403);
      const current=await tx.get(ref);
      if(data.action==='save') {
        if(current.exists) {
          if(current.data()?.digest!==digest) throw new RequestError('IMPORT_CONFLICT',409);
          return {id:ref.id,status:current.data()?.status};
        }
        tx.create(ref,{status:'DRAFT',digest,count:lessons.length,name:typeof data.name==='string' ? data.name.slice(0,200) : 'ZIP import',createdBy:uid,createdAt:Timestamp.now()});
        lessons.forEach((lesson,position)=>tx.create(ref.collection('importLessons').doc(lesson.key),{key:lesson.key,title:lesson.title,richContent:JSON.stringify(lesson.nodes),position}));
        return {id:ref.id,status:'DRAFT'};
      }
      if(!current.exists) throw new RequestError('NOT_FOUND',404);
      if(current.data()?.status==='PUBLISHED' && data.action==='publish') return {id:ref.id,status:'PUBLISHED'};
      if(current.data()?.status!=='DRAFT') throw new RequestError('IMPORT_CONFLICT',409);
      if(data.action==='archive') {tx.update(ref,{status:'ARCHIVED'}); return {id:ref.id,status:'ARCHIVED'};}
      const snapshots=await tx.get(ref.collection('importLessons'));
      const ordered=snapshots.docs.map(d=>d.data()).sort((a,b)=>a.position-b.position);
      const checked=validatePackage({lessons:ordered.map(d=>({key:d.key,title:d.title,nodes:JSON.parse(d.richContent)}))}).lessons;
      const newest=await tx.get(courseRef.collection('lessons').orderBy('createdAt','desc').limit(1));
      const latest=newest.docs[0]?.data().createdAt?.toMillis?.() || 0;
      const start=Math.max(Date.now(),latest+1);
      const links=Object.fromEntries(checked.map(l=>[l.key,ref.id+'_'+l.key]));
      // All lessons are created atomically. Stable IDs make publication retries safe.
      checked.forEach((lesson,index)=>{
        const id=links[lesson.key];
        tx.create(courseRef.collection('lessons').doc(id),{id,title:lesson.title,content:contentText(lesson.nodes),richContent:JSON.stringify(lesson.nodes),importLinks:links,importId:ref.id,createdAt:Timestamp.fromMillis(start+index)});
      });
      tx.update(ref,{status:'PUBLISHED',publishedBy:uid,publishedAt:Timestamp.now()});
      return {id:ref.id,status:'PUBLISHED',courseId};
    });
    return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return failure(error);}
}

