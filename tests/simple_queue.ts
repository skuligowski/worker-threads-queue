import path from "path";
import { Queue } from "../lib";

const myQueue = new Queue('test', 2);
myQueue.add(path.join(__dirname, 'task1.js'), {a: 1})
    .then(r => console.log(r))
    .catch(e => console.log(e));