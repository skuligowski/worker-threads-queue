import { log } from './logger';
import { PersistenceAdapter, Task } from "./Queue";

class PersistenceStore<T> implements PersistenceAdapter<T> {
    
    persistenceAdapter?: PersistenceAdapter<T>;

    constructor(persistenceAdapter?: PersistenceAdapter<T>) {
        this.persistenceAdapter = persistenceAdapter;
    }

    onAppend(task: Task<T>): Promise<void> {
        try {
            return this.persistenceAdapter ? this.persistenceAdapter.onAppend(task) : Promise.resolve();
        } catch(e) {
            log('Persistence adapter error:', e);
            return Promise.reject(e);
        }
    }
    onDelete(task: Task<T>): Promise<void> {
        try {
            return this.persistenceAdapter ? this.persistenceAdapter.onDelete(task) : Promise.resolve();
        } catch(e) {
            log('Persistence adapter error:', e);
            return Promise.reject(e.message);
        }
    }
    getAll(): Promise<Task<T>[]> {
        try {
            return this.persistenceAdapter ? this.persistenceAdapter.getAll() : Promise.resolve([]);
        } catch(e) {
            log('Persistence adapter error:', e);
            return Promise.reject(e);
        }
    }
}

export { PersistenceStore };
