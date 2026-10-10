import { unzipSync, strFromU8 } from 'fflate';
import { parseDocument } from 'htmlparser2';
import { PACKAGE_LIMITS, validatePackage, byteLength, type LessonPackage } from './lesson-package';

type Node = ReturnType<typeof parseDocument>['children'][number];
type Element = Extract<Node, { attribs: unknown }>;
function archivePath(path: string) {
  if (!path || path.length > 400 || /[\\:\x00-\x1f]/.test(path) || path.startsWith('/') || path.split('/').some(p => p === '..' || p === '.' || ['__proto__','constructor','prototype'].includes(p))) throw new Error('UNSAFE_ARCHIVE_PATH');
}
function resolve(base: string, raw: string) {
  let value: string;
  try { value = decodeURIComponent(raw.split(/[?#]/)[0]); } catch { throw new Error('UNSAFE_ARCHIVE_PATH'); }
  if (!value || /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('/') || /[\\\x00-\x1f]/.test(value)) throw new Error('EXTERNAL_DEPENDENCY');
  const parts = base.split('/').slice(0, -1);
  for (const part of value.split('/')) {
    if (part === '..') { if (!parts.length) throw new Error('UNSAFE_ARCHIVE_PATH'); parts.pop(); }
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}
const mime: Record<string,string> = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', svg:'image/svg+xml', woff:'font/woff', woff2:'font/woff2' };
const extension = (path: string) => path.split('.').pop()!.toLowerCase();
function dataUrl(path: string, bytes: Uint8Array, explicitMime?: string) {
  const contentType = explicitMime || mime[extension(path)];
  if (!contentType) throw new Error('UNSUPPORTED_ASSET');
  let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return 'data:' + contentType + ';base64,' + btoa(binary);
}
function elements(nodes: Node[]) {
  const found: Element[] = [];
  const walk = (list: Node[], depth: number) => {
    if (depth > 60) throw new Error('CONTENT_TOO_COMPLEX');
    for (const node of list) if ('attribs' in node) { found.push(node); if (found.length > 15000) throw new Error('CONTENT_TOO_COMPLEX'); walk(node.children, depth + 1); }
  };
  walk(nodes, 0); return found;
}
const text = (nodes: Node[]): string => nodes.map(node => node.type === 'text' ? node.data : 'children' in node ? text(node.children) : '').join('');

export function parseInteractiveHtml(html: string, name = 'Interactive lesson'): LessonPackage {
  if (byteLength(html) > PACKAGE_LIMITS.html) throw new Error('HTML_TOO_LARGE');
  return bundle({ [name.toLowerCase().endsWith('.html') ? name : 'index.html']: new TextEncoder().encode(html) });
}
export function parseInteractiveZip(bytes: Uint8Array): LessonPackage {
  if (bytes.length > PACKAGE_LIMITS.zip) throw new Error('ZIP_TOO_LARGE');
  const seen = new Set<string>(); let expanded = 0; let extracted = 0;
  unzipSync(bytes, { filter: entry => {
    archivePath(entry.name);
    if (seen.has(entry.name.toLowerCase())) throw new Error('DUPLICATE_PATH'); seen.add(entry.name.toLowerCase());
    expanded += entry.originalSize;
    if (seen.size > PACKAGE_LIMITS.entries || expanded > PACKAGE_LIMITS.expanded || entry.originalSize / Math.max(entry.size, 1) > 250) throw new Error('ARCHIVE_LIMIT');
    return false;
  }});
  const files = unzipSync(bytes, { filter: entry => {
    if (entry.name.endsWith('/')) return false;
    const ext = extension(entry.name);
    if (['txt','md'].includes(ext) || /(^|\/)\.DS_Store$/.test(entry.name) || entry.name.startsWith('__MACOSX/')) return false;
    if (!['html','htm','css','js',...Object.keys(mime)].includes(ext)) throw new Error('UNSUPPORTED_ASSET');
    if (entry.originalSize > (['html','htm','css','js'].includes(ext) ? PACKAGE_LIMITS.html : PACKAGE_LIMITS.image)) throw new Error('CONTENT_TOO_LARGE');
    extracted += entry.originalSize; if (extracted > PACKAGE_LIMITS.extracted) throw new Error('ARCHIVE_LIMIT');
    return true;
  }});
  let actual = 0;
  for (const [path, value] of Object.entries(files)) {
    actual += value.length;
    if (value.length > (['html','htm','css','js'].includes(extension(path)) ? PACKAGE_LIMITS.html : PACKAGE_LIMITS.image) || actual > PACKAGE_LIMITS.extracted) throw new Error('ARCHIVE_LIMIT');
  }
  return bundle(files);
}
function bundle(files: Record<string,Uint8Array>): LessonPackage {
  for (const path of Object.keys(files)) archivePath(path);
  const paths = Object.keys(files).filter(path => /\.html?$/i.test(path)).sort((a,b) => a.localeCompare(b, undefined, { numeric:true }));
  if (!paths.length || paths.length > PACKAGE_LIMITS.lessons) throw new Error('INVALID_LESSONS');
  const file = (path: string) => { if (!files[path]) throw new Error('MISSING_ASSET'); return files[path]; };
  function css(value: string, base: string): string {
    // Complex CSS imports should be bundled by the author rather than fetched.
    if (/@import\b/i.test(value)) throw new Error('INTERACTIVE_CSS_IMPORT');
    return value.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (full, _quote, raw: string) => {
      if (raw.startsWith('#') || raw.startsWith('data:')) return full;
      const path = resolve(base, raw); return 'url("' + dataUrl(path, file(path)) + '")';
    });
  }
  const lessons = paths.map((path, index) => {
    const html = strFromU8(files[path]);
    const doc = parseDocument(html, { withStartIndices:true, withEndIndices:true });
    const tags = elements(doc.children);
    const edits: {start:number;end:number;value:string}[] = [];
    const replace = (node: Element, value: string) => {
      if (node.startIndex === null || node.endIndex === null) throw new Error('INVALID_HTML');
      edits.push({ start:node.startIndex, end:node.endIndex + 1, value });
    };
    for (const node of tags) {
      if (node.name === 'base') replace(node, '');
      else if (node.name === 'script') {
        const body = node.attribs.src ? strFromU8(file(resolve(path, node.attribs.src))) : text(node.children);
        if (node.attribs.type === 'module' && /\bimport\s*(?:\(|[{*'"\w])/m.test(body)) throw new Error('INTERACTIVE_MODULE_IMPORT');
        if (node.attribs.src) {
          const asset = resolve(path, node.attribs.src);
          // A data script preserves defer/async and global script scope. Simply
          // inlining a deferred head script would run it before the DOM exists.
          const original = html.slice(node.startIndex!, node.endIndex! + 1);
          replace(node, original.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, 'src="' + dataUrl(asset, file(asset), 'text/javascript') + '"').replace(/\s+integrity\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, ''));
        }
      } else if (node.name === 'link' && node.attribs.rel?.toLowerCase() === 'stylesheet') {
        const asset = resolve(path, node.attribs.href || '');
        const attributes = ['media','id','title'].filter(key => node.attribs[key] !== undefined).map(key => ' ' + key + '="' + node.attribs[key].replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '"').join('');
        replace(node, '<style' + attributes + '>' + css(strFromU8(file(asset)), asset).replace(/<\/style/gi, '<\\/style') + '</style>');
      } else if (node.name === 'style') {
        const original = html.slice(node.startIndex!, node.endIndex! + 1);
        const opening = original.match(/^<(?:[^"'>]|"[^"]*"|'[^']*')*>/)?.[0];
        if (!opening) throw new Error('INVALID_HTML');
        replace(node, opening + css(text(node.children), path).replace(/<\/style/gi, '<\\/style') + '</style>');
      } else if (node.name === 'img' && node.attribs.src && !node.attribs.src.startsWith('data:')) {
        const asset = resolve(path, node.attribs.src);
        // Replace only the source attribute; retain all original layout attrs.
        const original = html.slice(node.startIndex!, node.endIndex! + 1);
        replace(node, original.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, 'src="' + dataUrl(asset, file(asset)) + '"'));
      }
    }
    let output = html;
    for (const edit of edits.sort((a,b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
    const titleNode = tags.find(node => node.name === 'title') || tags.find(node => node.name === 'h1');
    return { key:'l' + index, title:(titleNode ? text(titleNode.children).trim() : path.split('/').pop()!.replace(/\.html?$/i, '')).slice(0,200) || 'Interactive lesson', nodes:[], interactiveHtml:output };
  });
  return { ...validatePackage({ lessons }), warnings:['INTERACTIVE_ISOLATION'] };
}
