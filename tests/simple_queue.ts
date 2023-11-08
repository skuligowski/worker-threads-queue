import path from "path";
import { Queue } from "../lib";
import QueuePersistenceAdapter from "../lib/QueuePersistenceAdapter";

const myQueue = new Queue('test', 4, new QueuePersistenceAdapter('queue.test.dat', 60));

myQueue.on(path.join(__dirname, 'task1.js'), (err, result) => {
    if (err) {
        //handle error

    }
    console.log(err, result);
});

for (var i = 0; i < 100; i++) {
    myQueue.add(path.join(__dirname, 'task1.js'), {a: 300 - i}, {priority: 300 -i});
}
myQueue.add(path.join(__dirname, 'task1.js'), {a: 2}, {priority: 2});

