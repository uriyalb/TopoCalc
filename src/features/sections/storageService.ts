import { ProjectFile } from './types';

const DB_NAME = 'DXF_PROFILER_V1';
const STORE = 'projects';

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const storageService = {
    async saveProject(project: ProjectFile): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            store.put(project);
            tx.oncomplete = () => {
                localStorage.setItem('last_project_id', project.id!);
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    },

    async getProject(id: string): Promise<ProjectFile | undefined> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const store = tx.objectStore(STORE);
            const req = store.get(id);
            req.onsuccess = () => {
                if (req.result) localStorage.setItem('last_project_id', id);
                resolve(req.result);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async getAllMetadata(): Promise<Partial<ProjectFile>[]> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const store = tx.objectStore(STORE);
            const cursorRequest = store.openCursor();
            const results: Partial<ProjectFile>[] = [];
            
            cursorRequest.onsuccess = (e: any) => {
                const cursor = e.target.result;
                if (cursor) {
                    // Extract minimal info
                    const { id, name, timestamp, fileName } = cursor.value;
                    results.push({ id, name, timestamp, fileName });
                    cursor.continue();
                } else {
                    // Sort descending by timestamp
                    results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    resolve(results);
                }
            };
            cursorRequest.onerror = () => reject(cursorRequest.error);
        });
    },

    async deleteProject(id: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    getLastProjectId(): string | null {
        return localStorage.getItem('last_project_id');
    }
};