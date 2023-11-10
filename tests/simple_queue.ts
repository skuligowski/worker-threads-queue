import path from "path";
import { Queue, QueuePersistenceAdapter } from "../lib";

const myQueue = Queue.create('test')
    .withNumThreads(4)
    .withPersistenceAdapter(new QueuePersistenceAdapter('queue.test.dat', 60))
    .addTaskDefinition({ name: 'task1', script: path.join(__dirname, 'task1.js'), priority: 200})
    .addTaskDefinition({ name: 'task2', script: path.join(__dirname, 'task1.js'), priority: 100})
    .on('task1', (err, result) => {
        console.log(err, result);
    })
    .start();


for (var i = 0; i < 4; i++) {
    myQueue.add('task1', {a: 300});
    myQueue.add('task2', {a: 200});
}