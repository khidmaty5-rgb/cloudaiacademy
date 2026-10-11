import { parseDocument } from 'htmlparser2';
import { unzipSync, strFromU8 } from 'fflate';
import { contentText, type LessonPackage } from './lesson-package';
type Node = ReturnType<typeof parseDocument>['children'][number];
type Element = Extract<Node,{attribs:unknown}>;
export type CourseSuggestions = Partial<{title:string;description:string;courseCode:string;category:string;price:string;duration:string;level:'Beginner'|'Intermediate'|'Advanced';totalHours:number;imageUrl:string}>;
const clean = (value: unknown, limit = 2000) => typeof value === 'string' ? value.replace(/\s+/g,' ').trim().slice(0,limit) : '';
const text = (nodes:Node[]):string => nodes.map(node => node.type==='text'?node.data:'children' in node && (!('name' in node)||!['script','style'].includes(node.name))?text(node.children)+' ':'').join('');
function tags(nodes:Node[], depth=0):Element[] {
  if(depth>60) return [];
  return nodes.flatMap(node=>'attribs' in node?[node,...tags(node.children,depth+1)]:[]);
}
export function suggestCourseDetails(pkg:LessonPackage, filename:string, manifest:Record<string,unknown>={}) : CourseSuggestions {
  const first=pkg.lessons[0];
  const elements=first?.interactiveHtml ? tags(parseDocument(first.interactiveHtml).children) : [];
  const meta=(name:string)=>elements.find(node=>node.name==='meta' && (node.attribs.name||node.attribs.property||'').toLowerCase()===name)?.attribs.content;
  const h1=elements.find(node=>node.name==='h1');
  const paragraph=elements.find(node=>node.name==='p' && /(^|\s)(lead|description)(\s|$)/.test(node.attribs.class||'')) || elements.find(node=>node.name==='p');
  const fallback=filename.replace(/\.(zip|html?)$/i,'').replace(/[_-]+/g,' ');
  const title=clean(manifest.title||meta('og:title')||(h1?text(h1.children):first?.title)||fallback,200);
  const description=clean(manifest.description||meta('description')||meta('og:description')||(paragraph?text(paragraph.children):first?contentText(first.nodes):''),2000);
  const result:CourseSuggestions={title,description};
  const code=clean(manifest.courseCode||meta('course-code'),12).toUpperCase();
  const proposed=code || title.split(/[\s:—–]+/)[0].replace(/[^A-Za-z0-9]/g,'').slice(0,12).toUpperCase();
  if(/^[A-Z0-9-]{2,12}$/.test(proposed)) result.courseCode=proposed;
  const subject=title+' '+description;
  result.category=clean(manifest.category||meta('course-category'),100) || (/tailscale|network|wireguard|vpn/i.test(subject)?'Networking':/\bcloud\b|\bAWS\b|Azure/i.test(subject)?'Cloud':/\bAI\b|artificial intelligence/i.test(subject)?'AI':'');
  result.duration=clean(manifest.duration||meta('course-duration'),100) || 'Self-paced';
  const level=clean(manifest.level||meta('course-level'),30);
  if(['Beginner','Intermediate','Advanced'].includes(level)) result.level=level as CourseSuggestions['level'];
  const hours=Number(manifest.totalHours||meta('course-hours'));
  if(Number.isInteger(hours) && hours>0 && hours<=10000) result.totalHours=hours;
  const price=clean(typeof manifest.price==='number'&&Number.isFinite(manifest.price)&&manifest.price>=0?String(manifest.price):manifest.price,50); if(price) result.price=price;
  const image=clean(manifest.imageUrl||meta('og:image'),2000);
  try {const url=new URL(image); if(url.protocol==='https:'&&!url.username&&!url.password)result.imageUrl=url.href;}catch{/* Package-relative images are not public course covers. */}
  return result;
}
// Call only after the lesson parser has validated the entire archive.
export function courseManifest(bytes:Uint8Array):Record<string,unknown> {
  let count=0;
  const files=unzipSync(bytes,{filter:entry=>{
    if(!/(^|\/)course\.json$/i.test(entry.name)) return false;
    if(++count>1 || entry.originalSize>20000) throw new Error('COURSE_METADATA_INVALID');
    return true;
  }});
  const value=Object.values(files)[0]; if(!value)return {};
  if(value.length>20000)throw new Error('COURSE_METADATA_INVALID');
  try {const parsed=JSON.parse(strFromU8(value)); if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error(); return parsed;}catch{throw new Error('COURSE_METADATA_INVALID');}
}
