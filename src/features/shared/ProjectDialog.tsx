import React, { useEffect, useState } from 'react';
import { FolderOpen, Save, Trash2 } from 'lucide-react';
import { Btn, EmptyState, Field, Modal } from './ui';

export interface ProjectEntry {
  id: string;
  name: string;
  detail?: string;
  timestamp: number;
}

interface ProjectDialogProps {
  mode: 'save' | 'open' | null;
  projects: ProjectEntry[];
  loading?: boolean;
  defaultName?: string;
  onClose: () => void;
  onSave: (name: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Save-as and Open for both workspace tools. Projects live in this browser only. */
export function ProjectDialog({ mode, projects, loading, defaultName = '', onClose, onSave, onOpen, onDelete }: ProjectDialogProps) {
  const [name, setName] = useState(defaultName);
  const [armed, setArmed] = useState<string | null>(null); // id waiting for a second click to delete

  useEffect(() => {
    if (mode === 'save') setName(defaultName);
    setArmed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  return (
    <Modal
      open={mode != null}
      onClose={onClose}
      title={mode === 'save' ? 'Save project' : 'Open project'}
      icon={mode === 'save' ? <Save /> : <FolderOpen />}
    >
      {mode === 'save' && (
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. North path, option B" autoFocus />
          <Btn type="submit" variant="primary" disabled={!name.trim()}>
            <Save /> Save
          </Btn>
        </form>
      )}

      {mode === 'open' &&
        (loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-lime-400 border-t-black" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState icon={<FolderOpen />}>Nothing saved yet</EmptyState>
        ) : (
          <ul className="grid gap-3">
            {[...projects]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((p) => (
                <li key={p.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    className="min-w-0 flex-1 border-4 border-black bg-white px-3 py-2 text-left shadow-[4px_4px_0px_#000] hover:bg-lime-100"
                  >
                    <span className="block truncate text-sm font-black uppercase text-black">{p.name}</span>
                    <span className="block truncate text-xs font-bold text-lime-700">
                      {p.detail ? `${p.detail} · ` : ''}
                      {new Date(p.timestamp).toLocaleString()}
                    </span>
                  </button>
                  {armed === p.id ? (
                    <Btn variant="danger" className="h-auto" onClick={() => onDelete(p.id)}>
                      Delete
                    </Btn>
                  ) : (
                    <Btn variant="plain" size="icon" className="h-auto" onClick={() => setArmed(p.id)} aria-label={`Delete ${p.name}`} title="Delete">
                      <Trash2 />
                    </Btn>
                  )}
                </li>
              ))}
          </ul>
        ))}

      <p className="mt-4 text-xs font-bold text-lime-700">Saved in this browser only.</p>
    </Modal>
  );
}
