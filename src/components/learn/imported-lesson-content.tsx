import React from 'react';
import { CONTENT_TAGS, safeExternalLink, safeImage, type ContentNode } from '@/lib/lesson-package';

export function ImportedLessonContent({nodes, links = {}}: {nodes: ContentNode[]; links?: Record<string,string>}) {
  function render(node: ContentNode, key: string, depth = 0): React.ReactNode {
    if (depth > 24 || !node || typeof node !== 'object') return null;
    if ('text' in node) return typeof node.text === 'string' ? node.text : null;
    if (!CONTENT_TAGS.includes(node.tag) || !Array.isArray(node.children)) return null;
    const children = node.children.map((child,i) => render(child,key+'-'+i,depth+1));
    if (node.tag === 'img') return node.src && safeImage(node.src) ? <img key={key} src={node.src} alt={node.alt || ''} loading="lazy" className="my-4 h-auto max-w-full rounded-lg" /> : null;
    if (node.tag === 'a') {
      const href = node.target ? links[node.target] || '#import-'+node.target : node.href && safeExternalLink(node.href);
      return href ? <a key={key} href={href} {...(!node.target ? {target:'_blank',rel:'noopener noreferrer',referrerPolicy:'no-referrer' as const} : {})} className="text-accent underline underline-offset-4">{children}</a> : <React.Fragment key={key}>{children}</React.Fragment>;
    }
    const style: Partial<Record<typeof node.tag,string>> = {
      p:'my-3 leading-8', h1:'my-5 text-2xl font-bold', h2:'my-4 text-xl font-semibold', h3:'my-4 text-lg font-semibold', h4:'my-3 font-semibold',
      ul:'my-3 list-disc ps-6',ol:'my-3 list-decimal ps-6',li:'my-2',pre:'my-4 overflow-x-auto rounded-lg bg-muted p-4 text-start',code:'font-mono text-sm',blockquote:'my-4 border-s-4 ps-4 text-muted-foreground',
      table:'my-4 w-full border-collapse',th:'border p-2 text-start',td:'border p-2 align-top',hr:'my-5'
    };
    if (node.tag === 'table') return <div key={key} className="max-w-full overflow-x-auto" tabIndex={0}><table className={style.table}>{children}</table></div>;
    return React.createElement(node.tag, {key, className:style[node.tag]}, ...(['br','hr'].includes(node.tag) ? [] : children));
  }
  return <div className="min-w-0 break-words text-foreground" dir="auto">{nodes.map((node,i) => render(node,String(i)))}</div>;
}

export function StoredImportedLesson({content,courseId,links = {}}:{content:string;courseId:string;links?:Record<string,string>}) {
  let nodes:ContentNode[];
  try {nodes=JSON.parse(content); if(!Array.isArray(nodes))return null;} catch{return null;}
  const destinations=Object.fromEntries(Object.entries(links).map(([key,id])=>[key,'/learn/'+encodeURIComponent(courseId)+'/'+encodeURIComponent(id)]));
  return <ImportedLessonContent nodes={nodes} links={destinations}/>;
}
