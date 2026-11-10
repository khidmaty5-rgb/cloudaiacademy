import { notFound } from 'next/navigation';
import LectureResources from '@/components/lecture-resources';
export default async function AssignmentsPage({params,searchParams}:{params:Promise<{kind:string;id:string}>;searchParams:Promise<{manage?:string}>}) {
  const {kind,id}=await params;
  if(!['regular','open'].includes(kind) || !/^[\w-]{1,180}$/.test(id)) notFound();
  return <LectureResources courseId={id} regular={kind==='regular'} manage={(await searchParams).manage==='1'} />;
}
