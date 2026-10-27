export const MAX_LECTURE_PDF_BYTES = 3 * 1024 * 1024;
export const lectureIdValid = (id: string) => /^[a-f0-9-]{36}$/.test(id);
export type LectureResource = { id: string; title: string; topic: string; description: string; published: boolean; size: number };
export function lectureMetadata(value: Record<string, unknown>) {
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const topic = typeof value.topic === 'string' ? value.topic.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  if (!title || title.length > 160 || topic.length > 100 || description.length > 1000) throw new Error('INVALID_METADATA');
  return { title, topic, description };
}
// Only these fields ever leave the server. Storage paths and uploader IDs are private.
export function publicLecture(id: string, data: Record<string, unknown>): LectureResource {
  return { id, title: String(data.title || ''), topic: String(data.topic || ''), description: String(data.description || ''), published: data.published === true, size: Number(data.size || 0) };
}
