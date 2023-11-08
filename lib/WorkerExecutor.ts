import { Task } from "./Queue";

const { parentPort, threadId } = require("node:worker_threads");
type AsyncFunc<P, R> = (payload: P) => Promise<R>;

async function execute<P, R>(task: Task<P>): Promise<R> {
  const run = await load<P, R>(task);
  const startTime = new Date().getTime();
  return run(task.payload);
}

async function load<P, R>(task: Task<P>): Promise<AsyncFunc<P, R>>  {
    try {
        const taskModule = (await import(task.name)) as { default: AsyncFunc<P, R> };
        return taskModule.default;
    } catch(e) {
        console.log(`[${task.id}] Task ${task.name} not found, exiting...`);
        throw new Error(`[${task.id}] Task ${task.name} not found, exiting...`);
    }
}

parentPort.on("message", <P, R>(message: Task<P>) => {
  execute<P,R>(message)
    .then(payload => parentPort.postMessage({ payload }))
    .catch(error => parentPort.postMessage({ error }));
});

export default {};

