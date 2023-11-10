import path from "path";
import { Queue, QueuePersistenceAdapter } from "../lib";

const myQueue = new Queue('test', {
    numThreads: 10,
    persistenceAdapter: new QueuePersistenceAdapter('queue.test.dat', 60),
    taskDefinitions: [
        { name: 'task1', script: path.join(__dirname, 'task1.js'), priority: 200},
        { name: 'task2', script: path.join(__dirname, 'task1.js'), priority: 100}
    ]
})
.on('task1', (err, result) => {
    console.log(err, result);
});

for (var i = 0; i < 1; i++) {
    myQueue.add('task1', {a: 200});
}