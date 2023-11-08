import fs from 'fs';
import fsp from 'fs/promises';
import readline from 'readline';
import { PersistenceAdapter, Task } from "../lib/Queue";

class FSPersistenceAdapter implements PersistenceAdapter<any> {
    
    fileName: string;

    constructor(queueName: string) {
        this.fileName = `queue.${queueName}.dat`;
    }

    onAppend(task: Task<any>): Promise<void> {
        const line = `APPEND | ${task.id} | ${task.name} | ${task.priority} | ${JSON.stringify(task.payload)}\n`;
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
            const [action, id, name, priority, payload] = line.split('|').map(item => item.trim());
            if (action === 'APPEND') {
                tasksMap[id] = {id, name, priority: parseInt(priority), payload: JSON.parse(payload)};
                order.push(id);
            }
            if (action === 'DELETE') {
                delete tasksMap[id];
            }
        }
        fileStream.close();
        return Promise.resolve(order.map(id => tasksMap[id]).filter(task => task !== undefined));
    }
    
}

export default FSPersistenceAdapter;