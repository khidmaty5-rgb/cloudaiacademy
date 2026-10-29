import PublicOpenCourse from '@/components/open-course-player';
export default async function OpenCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicOpenCourse id={id} />;
}
