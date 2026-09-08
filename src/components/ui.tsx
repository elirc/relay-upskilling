'use client';
import { useEffect, useRef } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { stateLabels } from '@/lib/contracts';
export const fmt=(n:number)=>new Intl.NumberFormat('en-US').format(n);
export const date=(s:string)=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});
export function Mark(){return <div className="brand-mark"><span/><span/><span/></div>;}
export function Status({status}:{status:string}){return <span className={'status status-'+status}><span className="status-dot"/>{stateLabels[status]??status}</span>;}
export function Spinner(){return <LoaderCircle size={17} className="spin"/>;}
export type Api=(path:string,init?:RequestInit)=>Promise<Response>;
export function Dialog({title,subtitle,onClose,children}:{title:string;subtitle:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.focus();function key(e:KeyboardEvent){if(e.key==='Escape')close.current();if(e.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};},[]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><div className="dialog-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div></div>;
}
