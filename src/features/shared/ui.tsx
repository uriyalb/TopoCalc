import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// The TopoCalc look, in one place: black 4px outlines, hard offset shadows,
// lime surfaces, loud uppercase labels. Same vocabulary as the Stairs builder.

export const labelClass = 'text-lime-800 text-xs md:text-sm font-bold uppercase';
export const inputClass =
  'w-full min-w-0 h-11 rounded-md border-4 border-black bg-white px-2 text-base font-bold text-black shadow-[4px_4px_0px_#000] outline-none focus-visible:bg-lime-50 disabled:opacity-50';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** The outer card of a tool — sits right under the folder tabs. */
export function ToolCard({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border-4 border-black bg-lime-200 p-4 md:p-6 shadow-[8px_8px_0px_#000]', className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-xl md:text-2xl font-black text-lime-900 uppercase tracking-tight">{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** An inner block. `paper` is the drawing surface used for plans and charts. */
export function Panel({ tone = 'lime', className, ...props }: DivProps & { tone?: 'lime' | 'paper' | 'white' }) {
  const bg = tone === 'paper' ? 'bg-lime-50' : tone === 'white' ? 'bg-white' : 'bg-lime-100';
  return <div className={cn('min-w-0 border-4 border-black shadow-[4px_4px_0px_#000]', bg, className)} {...props} />;
}

export function PanelHead({ icon, title, children, className }: { icon?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b-4 border-black bg-lime-300 px-3 py-2', className)}>
      <h3 className="flex min-w-0 items-center gap-2 text-sm font-black uppercase text-black [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{title}</span>
      </h3>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A numbered step heading: the number is the instruction. */
export function Step({ n, title, note, done }: { n: number; title: string; note?: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black text-xs font-black', done ? 'bg-black text-lime-300' : 'bg-white text-black')}>{n}</span>
      <span className="text-sm font-black uppercase text-black">{title}</span>
      {note && <span className="ml-auto text-xs font-bold text-lime-700">{note}</span>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'plain' | 'danger' | 'dark';
  size?: 'md' | 'sm' | 'icon' | 'icon-sm';
};

const BTN_VARIANT = {
  primary: 'bg-lime-500 hover:bg-lime-600 text-black',
  secondary: 'bg-lime-300 hover:bg-lime-400 text-black',
  plain: 'bg-white hover:bg-lime-100 text-black',
  danger: 'bg-white hover:bg-red-200 text-red-800',
  dark: 'bg-lime-900 hover:bg-black text-lime-100',
};
const BTN_SIZE = {
  md: 'h-11 px-4 text-sm border-4 shadow-[4px_4px_0px_#000]',
  sm: 'h-8 px-2 text-xs border-2 shadow-[2px_2px_0px_#000]',
  icon: 'h-11 w-11 p-0 border-4 shadow-[4px_4px_0px_#000]',
  'icon-sm': 'h-8 w-8 p-0 border-2 shadow-[2px_2px_0px_#000]',
};

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(function Btn({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border-black font-black uppercase transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className
      )}
      {...props}
    />
  );
});

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & { label: string; unit?: string; className?: string };

/** Labelled input; the unit sits inside the box so the label stays short. */
export function Field({ label, unit, className, ...props }: FieldProps) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className={cn(labelClass, 'mb-1 block truncate')}>{label}</span>
      <span className="relative block">
        <input className={cn(inputClass, 'font-mono', unit && 'pr-8')} {...props} />
        {unit && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-lime-700">{unit}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, className, label }: { options: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; label?: string }) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex rounded-md border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'flex items-center gap-1.5 px-3 h-9 text-xs font-black uppercase border-r-4 last:border-r-0 border-black [&_svg]:size-4',
            value === o.value ? 'bg-lime-900 text-lime-100' : 'bg-white hover:bg-lime-100 text-black'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Sub-tabs that fuse with the panel below them, like the Slope / Elevation tabs. */
export function SubTabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="relative z-10 flex items-stretch">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'flex-1 min-w-0 -ml-1 first:ml-0 border-4 border-black first:rounded-tl-lg last:rounded-tr-lg px-1 md:px-3 py-2 text-[11px] md:text-sm leading-tight font-bold uppercase text-black flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 [&_svg]:size-4 [&_svg]:shrink-0',
            value === t.value ? 'bg-lime-100 text-lime-900 border-b-lime-100' : 'bg-lime-400 hover:bg-lime-300'
          )}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/** One number that matters. `swatch` ties it to its colour in the drawing. */
export function Stat({ label, value, unit, sub, swatch, tone = 'white', className }: { label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode; swatch?: string; tone?: 'white' | 'dark'; className?: string }) {
  const dark = tone === 'dark';
  return (
    <div className={cn('min-w-0 border-4 border-black px-3 py-2 shadow-[4px_4px_0px_#000]', dark ? 'bg-lime-900 text-lime-100' : 'bg-white text-black', className)}>
      <div className={cn('flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide', dark ? 'text-lime-300' : 'text-lime-800')}>
        {swatch && <span className="h-3 w-3 shrink-0 border-2 border-black" style={{ background: swatch }} />}
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate font-mono text-xl md:text-2xl font-black leading-tight tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-bold">{unit}</span>}
      </div>
      {sub != null && <div className={cn('truncate text-xs font-bold', dark ? 'text-lime-300' : 'text-lime-700')}>{sub}</div>}
    </div>
  );
}

/** What to do next, when there is nothing to show yet. */
export function EmptyState({ icon, children, tone = 'idle', className }: { icon?: React.ReactNode; children: React.ReactNode; tone?: 'idle' | 'bad'; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-40 flex-col items-center justify-center gap-2 border-4 border-dashed border-black p-6 text-center text-sm font-bold uppercase [&_svg]:size-8',
        tone === 'bad' ? 'bg-red-100 text-red-800' : 'bg-lime-100 text-lime-800',
        className
      )}
    >
      {icon}
      <div>{children}</div>
    </div>
  );
}

/** A quiet one-liner under or over a drawing. */
export function Hint({ className, ...props }: DivProps) {
  return <div className={cn('flex items-center gap-1.5 text-xs font-bold text-lime-700 [&_svg]:size-3.5 [&_svg]:shrink-0', className)} {...props} />;
}

/** A floating label on top of a drawing (mouse hints, scale notes). */
export function Chip({ className, ...props }: DivProps) {
  return (
    <div
      className={cn('pointer-events-none flex select-none items-center gap-2 border-2 border-black bg-white px-2 py-1 text-[11px] font-black uppercase text-black shadow-[2px_2px_0px_#000] [&_svg]:size-3.5', className)}
      {...props}
    />
  );
}

/** Zoom out / fit / zoom in — the same cluster on every drawing. */
export function ZoomButtons({ onOut, onFit, onIn, vertical, className, icons }: { onOut: () => void; onFit: () => void; onIn: () => void; vertical?: boolean; className?: string; icons: { out: React.ReactNode; fit: React.ReactNode; in: React.ReactNode } }) {
  return (
    <div className={cn('flex gap-1', vertical && 'flex-col', className)} onMouseDown={(e) => e.stopPropagation()}>
      <Btn size="icon-sm" variant="plain" onClick={onIn} aria-label="Zoom in" title="Zoom in">{icons.in}</Btn>
      <Btn size="icon-sm" variant="plain" onClick={onFit} aria-label="Fit to view" title="Fit to view">{icons.fit}</Btn>
      <Btn size="icon-sm" variant="plain" onClick={onOut} aria-label="Zoom out" title="Zoom out">{icons.out}</Btn>
    </div>
  );
}

/** Tooltip box for charts — matches the glossary popovers in Stairs. */
export function ChartTip({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="border-4 border-black bg-white px-2 py-1.5 text-xs font-bold text-black shadow-[4px_4px_0px_#000]">
      <div className="font-black uppercase">{title}</div>
      {children}
    </div>
  );
}

export function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono">
      <span className="h-2.5 w-2.5 shrink-0 border border-black" style={{ background: color }} />
      <span className="font-sans uppercase text-lime-800">{label}</span>
      <span className="ml-auto pl-3 tabular-nums">{value}</span>
    </div>
  );
}

export function Legend({ items, className }: { items: { color: string; label: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-black uppercase text-black', className)}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-0 w-5 shrink-0 border-t-4" style={{ borderColor: i.color, borderTopStyle: i.dashed ? 'dashed' : 'solid' }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ---- Dialogs ----

export function Modal({ open, onClose, title, icon, children, footer, className, bodyClassName }: { open: boolean; onClose: () => void; title: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/60" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-[100] flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col border-4 border-black bg-lime-200 shadow-[8px_8px_0px_#000] outline-none',
            className
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-black bg-lime-400 px-4 py-3">
            <DialogPrimitive.Title className="flex min-w-0 items-center gap-2 text-lg font-black uppercase tracking-tight text-black [&_svg]:size-5 [&_svg]:shrink-0">
              {icon}
              <span className="truncate">{title}</span>
            </DialogPrimitive.Title>
            <Btn size="icon-sm" variant="plain" onClick={onClose} aria-label="Close">
              <X />
            </Btn>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto p-4', bodyClassName)}>{children}</div>
          {footer && <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t-4 border-black bg-lime-100 px-4 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ConfirmRequest {
  title: string;
  text?: string;
  action: string;
  onConfirm: () => void;
}

/** Replaces window.confirm: name the action on the button instead of "OK". */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <Modal
      open={request != null}
      onClose={onClose}
      title={request?.title ?? ''}
      className="max-w-sm"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="danger"
            onClick={() => {
              request?.onConfirm();
              onClose();
            }}
          >
            {request?.action}
          </Btn>
        </>
      }
    >
      <p className="text-sm font-bold text-lime-900">{request?.text}</p>
    </Modal>
  );
}

// ---- Notices (replace alert) ----

export interface NoticeState {
  text: string;
  bad?: boolean;
  id: number;
}

export function useNotice(): [NoticeState | null, (text: string, bad?: boolean) => void] {
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const notify = useCallback((text: string, bad = false) => {
    clearTimeout(timer.current);
    setNotice({ text, bad, id: Date.now() });
    timer.current = setTimeout(() => setNotice(null), bad ? 6000 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [notice, notify];
}

export function Notice({ notice }: { notice: NoticeState | null }) {
  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4">
      <div
        role="status"
        className={cn('border-4 border-black px-4 py-2 text-sm font-black uppercase shadow-[4px_4px_0px_#000]', notice.bad ? 'bg-red-200 text-red-900' : 'bg-lime-900 text-lime-100')}
      >
        {notice.text}
      </div>
    </div>
  );
}

export function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Wheel listener that may call preventDefault (React's onWheel is passive, so the
 * page would scroll under a drawing while it zooms). Re-attaches when `ready` flips.
 */
export function useWheel(ref: React.RefObject<HTMLElement | null>, handler: (e: WheelEvent) => void, ready: unknown = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => latest.current(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, ready]);
}
