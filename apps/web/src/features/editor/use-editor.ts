import type { TimelineDoc } from '@myvideo/timeline-core';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ApiError, api } from '@/api/client';
import type { ProjectRecord } from '@/api/projects';
import { createEditorStore, type EditorStore, type SaveResult } from './editor-store';

/** One editor store per opened project record (created once; the server record only seeds it). */
export function useEditorStore(record: ProjectRecord): EditorStore {
  const ref = useRef<{ id: string; store: EditorStore } | null>(null);
  if (!ref.current || ref.current.id !== record.id) {
    const id = record.id;
    ref.current = {
      id,
      store: createEditorStore({
        doc: record.doc as unknown as TimelineDoc,
        version: record.version,
        save: async (doc, baseVersion): Promise<SaveResult> => {
          const res = await api.PUT('/projects/{id}', {
            params: { path: { id } },
            body: { baseVersion, doc: doc as never },
          });
          if (res.response.status === 409) return { ok: false, conflict: true };
          if (!res.data) throw new ApiError(res.response.status, res.error);
          return { ok: true, version: res.data.version };
        },
        fetchLatest: async () => {
          const res = await api.GET('/projects/{id}', { params: { path: { id } } });
          if (!res.data) throw new ApiError(res.response.status, res.error);
          return { doc: res.data.doc as unknown as TimelineDoc, version: res.data.version };
        },
      }),
    };
  }
  const store = ref.current.store;
  // save what is left when the page goes away
  useEffect(() => {
    const onHide = () => void store.flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void store.flush();
    };
  }, [store]);
  return store;
}

/** Save status + undo/redo availability (changes rarely: fine as React state via an external-store hook). */
export function useEditorMeta(store: EditorStore) {
  const status = useSyncExternalStore(store.subscribeStatus, store.status);
  const canUndo = useSyncExternalStore(subscribeDoc(store), store.canUndo);
  const canRedo = useSyncExternalStore(subscribeDoc(store), store.canRedo);
  return { status, canUndo, canRedo };
}

const docSubs = new WeakMap<EditorStore, (l: () => void) => () => void>();
function subscribeDoc(store: EditorStore) {
  let s = docSubs.get(store);
  if (!s) {
    s = (l: () => void) => store.subscribe(() => l());
    docSubs.set(store, s);
  }
  return s;
}

/** One element of the document, re-read only when that element changed (smallest slice). */
export function useElement<T>(store: EditorStore, id: string): T | undefined {
  return useSyncExternalStore(
    (l) => store.subscribe((ids) => (ids.includes(id) ? l() : undefined)),
    () => store.doc().elements[id] as T | undefined,
  );
}
