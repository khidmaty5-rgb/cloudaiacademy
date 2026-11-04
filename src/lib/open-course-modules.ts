import { validatePackage, type LessonPackage, type PackageLesson } from './lesson-package';
import { OPEN_COURSE_REQUEST_LIMIT } from './open-course-management';

export type ModuleChange =
  | { kind: 'add'; lesson: PackageLesson }
  | { kind: 'replace'; key: string; lesson: PackageLesson }
  | { kind: 'rename'; key: string; title: string }
  | { kind: 'remove'; key: string }
  | { kind: 'move'; key: string; direction: -1 | 1 };

export function changeModule(pkg: LessonPackage, change: ModuleChange): LessonPackage {
  const current = validatePackage(pkg);
  if (current.lessons.some(x => !x.interactiveHtml)) throw new Error('INVALID_PACKAGE');
  let lessons = [...current.lessons];
  if (change.kind === 'add') {
    let index = 0;
    while (lessons.some(x => x.key === 'l' + index)) index++;
    lessons.push({ ...change.lesson, key: 'l' + index });
  } else {
    const index = lessons.findIndex(x => x.key === change.key);
    if (index < 0) throw new Error('MODULE_NOT_FOUND');
    if (change.kind === 'remove') {
      if (lessons.length === 1) throw new Error('LAST_MODULE');
      lessons = lessons.filter(x => x.key !== change.key);
    } else if (change.kind === 'rename') {
      lessons[index] = { ...lessons[index], title: change.title.trim() };
    } else if (change.kind === 'replace') {
      lessons[index] = { ...change.lesson, key: change.key };
    } else {
      const target = index + change.direction;
      if (target < 0 || target >= lessons.length) throw new Error('INVALID_MOVE');
      [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
    }
  }
  const result = validatePackage({ lessons, warnings: [] });
  if (result.lessons.some(x => !x.interactiveHtml)) throw new Error('INVALID_PACKAGE');
  if (new TextEncoder().encode(JSON.stringify(result)).length > OPEN_COURSE_REQUEST_LIMIT - 100_000) throw new Error('FILE_TOO_LARGE');
  return result;
}
