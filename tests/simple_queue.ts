import path from "path";
import { Queue } from "../lib";
import QueuePersistenceAdapter from "../lib/QueuePersistenceAdapter";

const myQueue = new Queue('test', 4, new QueuePersistenceAdapter('queue.test.dat', 60), [
    { name: 'task1', script: path.join(__dirname, 'task1.js'), priority: 200, timeout: 5000 },
    { name: 'task2', script: path.join(__dirname, 'task1.js'), priority: 100 },
]);

myQueue.on('task1', (err, result) => {
    if (err) {
        //handle error
    }
    console.log(err, result);
});

for (var i = 0; i < 10; i++) {
    myQueue.add('task1', {a: 300 - i});
}

