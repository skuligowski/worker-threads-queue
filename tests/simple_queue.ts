import path from "path";
import { Queue } from "../lib";

const myQueue = new Queue('test', 6);

for (var i = 0; i < 10; i++) {
    myQueue.add(path.join(__dirname, 'task1.js'), {a: 300 - i}, {priority: 300 -i})
        .then(r => console.log(r))
        .catch(e => console.log(e));
}

myQueue.add(path.join(__dirname, 'task1.js'), {a: 2}, {priority: 2})
    .then(r => console.log(r))
    .catch(e => console.log(e));