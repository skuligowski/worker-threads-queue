import fs from 'fs';
import fsp from 'fs/promises';
import readline from 'readline';
import { PersistenceAdapter, Task } from "./Queue";
import { log } from './logger';

class QueuePersistenceAdapter implements PersistenceAdapter<any> {
    
    fileName: string;

    constructor(fileName: string, compactIntervalSeconds: number) {
        this.fileName = fileName;
        setInterval(this.compactIndex.bind(this), compactIntervalSeconds*1000);
    }

    onAppend(task: Task<any>): Promise<void> {
        const line = this.toAppendLine(task);
        return fsp.appendFile(this.fileName, line);
    }
    onDelete(task: Task<any>): Promise<void> {
        const line = `DELETE | ${task.id}\n`;
        return fsp.appendFile(this.fileName, line);
    }
    async getAll(): Promise<Task<any>[]> {
        const fileStream = fs.createReadStream(this.fileName);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        const tasksMap: { [key: string]: Task<any> } = {};
        const order: string[] = [];
        for await (const line of rl) {
            const [action, id, name, script, priority, timeout, payload] = line.split('|').map(item => item.trim());
            if (action === 'APPEND') {
                tasksMap[id] = {
                    id, 
                    name, 
                    script, 
                    priority: parseInt(priority), 
                    timeout: parseInt(timeout), 
                    payload: JSON.parse(payload)
                };
                order.push(id);
            }
            if (action === 'DELETE') {
                delete tasksMap[id];
            }
        }
        fileStream.close();
        return Promise.resolve(order.map(id => tasksMap[id]).filter(task => task !== undefined));
    }

    private toAppendLine(task: Task<any>): string {
        return `APPEND | ${task.id} | ${task.name} | ${task.script} | ${task.priority} | ${task.timeout} | ${JSON.stringify(task.payload)}\n`;
    }

    private async compactIndex(): Promise<void> { 
        log('Compacting queue logindex...');
        const allTasks = await this.getAll();
        const lines = allTasks.map(task => this.toAppendLine(task));
        await fsp.unlink(this.fileName);
        await fsp.appendFile(this.fileName, lines.join(''));
    }
    
}

export { QueuePersistenceAdapter };
