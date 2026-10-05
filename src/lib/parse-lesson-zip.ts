import { unzipSync, strFromU8 } from 'fflate';
import { parseDocument } from 'htmlparser2';
type ChildNode = ReturnType<typeof parseDocument>['children'][number];
type Element = Extract<ChildNode, {attribs: unknown}>;
import { CONTENT_TAGS, PACKAGE_LIMITS, safeExternalLink, safeImage, validatePackage, type ContentNode, type ContentTag, type LessonPackage } from './lesson-package';

function archivePath(path: string) {
  if (!path || path.length > 400 || /[\\:\x00-\x1f]/.test(path) || path.startsWith('/') || path.split('/').some(p => p === '..' || p === '.' || ['__proto__','constructor','prototype'].includes(p))) throw new Error('UNSAFE_ARCHIVE_PATH');
  return path;
}
function resolvePath(base: string, raw: string): string | null {
  try {
    const value = decodeURIComponent(raw.split(/[?#]/)[0]);
    if (!value || /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('/') || value.includes('\\') || /[\x00-\x1f]/.test(value)) return null;
    const parts = base.split('/').slice(0, -1);
    for (const part of value.split('/')) { if (part === '..') {if (!parts.length) return null; parts.pop();} else if (part && part !== '.') parts.push(part); }
    return parts.join('/');
  } catch { return null; }
}
function elements(nodes: ChildNode[], name: string): Element[] {
  const found: Element[] = [];
  const walk = (list: ChildNode[], depth: number) => { if (depth > 60) throw new Error('CONTENT_TOO_COMPLEX'); for (const n of list) if ('attribs' in n) {if (n.name === name) found.push(n); walk(n.children, depth+1);} };
  walk(nodes, 0); return found;
}
const text = (nodes: ChildNode[]): string => nodes.map(n => n.type === 'text' ? n.data : 'children' in n ? text(n.children) : '').join('');
export function parseLessonZip(bytes: Uint8Array): LessonPackage {
  if (bytes.length > PACKAGE_LIMITS.zip) throw new Error('ZIP_TOO_LARGE');
  const seen = new Set<string>(); let expanded = 0; let extracted = 0;
  // First inspect every directory entry, without decompressing anything.
  unzipSync(bytes, {filter: entry => {
    archivePath(entry.name);
    if (seen.has(entry.name.toLowerCase())) throw new Error('DUPLICATE_PATH');
    seen.add(entry.name.toLowerCase());
    expanded += entry.originalSize;
    if (seen.size > PACKAGE_LIMITS.entries || expanded > PACKAGE_LIMITS.expanded || entry.originalSize / Math.max(entry.size, 1) > 250) throw new Error('ARCHIVE_LIMIT');
    return false;
  }});
  const warnings = new Set<string>();
  const files = unzipSync(bytes, {filter: entry => {
    const html = /\.html?$/i.test(entry.name);
    const image = /\.(png|jpe?g|webp)$/i.test(entry.name);
    if (!html && !image) return false;
    if (entry.originalSize > (html ? PACKAGE_LIMITS.html : PACKAGE_LIMITS.image)) {
      if (html) throw new Error('HTML_TOO_LARGE');
      warnings.add('LARGE_IMAGES_SKIPPED'); return false;
    }
    extracted += entry.originalSize;
    if (extracted > PACKAGE_LIMITS.extracted) throw new Error('ARCHIVE_LIMIT');
    return true;
  }});
  const htmlPaths = Object.keys(files).filter(path => /\.html?$/i.test(path));
  // ZIP size metadata is untrusted; check actual selected bytes as well.
  let actualBytes = 0;
  for (const [path, file] of Object.entries(files)) {
    actualBytes += file.length;
    if (file.length > (/\.html?$/i.test(path) ? PACKAGE_LIMITS.html : PACKAGE_LIMITS.image) || actualBytes > PACKAGE_LIMITS.extracted) throw new Error('ARCHIVE_LIMIT');
  }
  const toc = htmlPaths.find(path => /(^|\/)table of contents\.html?$/i.test(path));
  const docs = new Map(htmlPaths.map(path => [path, parseDocument(strFromU8(files[path]))]));
  // Traverse once to reject excessive nesting before recursive transformations.
  for (const doc of docs.values()) elements(doc.children, 'body');
  const ordered: {path: string; title?: string}[] = [];
  if (toc) {
    for (const anchor of elements(docs.get(toc)!.children, 'a')) {
      const path = resolvePath(toc, anchor.attribs.href || '');
      if (path && docs.has(path) && path !== toc && !ordered.some(item => item.path === path)) ordered.push({path, title: text(anchor.children).replace(/^\s*\d+[.)]\s*/, '').trim()});
    }
  }
  if (!ordered.length) for (const path of htmlPaths.filter(p => p !== toc).sort((a,b) => a.localeCompare(b, undefined, {numeric:true}))) ordered.push({path});
  if (ordered.length < 1 || ordered.length > PACKAGE_LIMITS.lessons) throw new Error('INVALID_LESSONS');
  const pathKeys = new Map(ordered.map((item, i) => [item.path, 'l' + i]));
  warnings.add('ACTIVE_CONTENT_REMOVED');
  const lessons = ordered.map(({path, title}, index) => {
    const doc = docs.get(path)!;
    const root = elements(doc.children, 'main')[0] || elements(doc.children, 'body')[0] || doc;
    let count = 0;
    function convert(nodes: ChildNode[], depth: number): ContentNode[] {
      if (depth > 24) throw new Error('CONTENT_TOO_COMPLEX');
      return nodes.flatMap((node): ContentNode[] => {
        if (++count > 5000) throw new Error('CONTENT_TOO_COMPLEX');
        if (node.type === 'text') return [{text:node.data}];
        if (!('attribs' in node)) return [];
        if (['script','style','head','iframe','object','embed','form','input','button','svg','math','video','audio','link','meta','noscript'].includes(node.name)) return [];
        if (node.name === 'img') {
          const imagePath = resolvePath(path, node.attribs.src || '');
          const image = imagePath ? files[imagePath] : undefined;
          if (!image) {warnings.add('MISSING_IMAGES'); return [{text: node.attribs.alt ? '[' + node.attribs.alt + ']' : ''}];}
          let binary = ''; for (let i=0; i<image.length; i+=8192) binary += String.fromCharCode(...image.subarray(i,i+8192));
          const mime = imagePath!.toLowerCase().endsWith('.png') ? 'png' : imagePath!.toLowerCase().endsWith('.webp') ? 'webp' : 'jpeg';
          const src = 'data:image/' + mime + ';base64,' + btoa(binary);
          if (!safeImage(src)) {warnings.add('MISSING_IMAGES'); return [];}
          return [{tag:'img', children:[], src, alt:node.attribs.alt || ''}];
        }
        const children = convert(node.children, depth + 1);
        if (node.name === 'a') {
          const href = node.attribs.href || '';
          const local = resolvePath(path, href);
          const target = local ? pathKeys.get(local) : undefined;
          const external = safeExternalLink(href);
          if (target) return [{tag:'a', children, target}];
          if (external) return [{tag:'a', children, href:external}];
          if (href) warnings.add('UNSUPPORTED_LINKS');
          return children;
        }
        const tag = node.name === 'b' ? 'strong' : node.name === 'i' ? 'em' : node.name === 'section' ? 'div' : node.name;
        return CONTENT_TAGS.includes(tag as ContentTag) ? [{tag:tag as ContentTag, children}] : children;
      });
    }
    return {key:'l'+index, title:(title || text(elements(doc.children,'h1')[0]?.children || []) || path.split('/').pop()!.replace(/\.html?$/i,'')).slice(0,200), nodes:convert(root.children, 0)};
  });
  return {...validatePackage({lessons}), warnings:[...warnings]};
}
