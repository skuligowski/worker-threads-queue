import path from "path";
import { Worker } from "worker_threads";
import { PriorityQueue } from "./PriorityQueue";
import nextId from './TaskId';

export interface Task<P> {
    id: string;
    name: string;
    priority: number;
    payload: P;
}

interface TaskInstance<P, R> {
    task: Task<P>;
    promise: PromiseControl<R>;
}

interface PromiseControl<R> {
    resolve: (value: R) => void;
    reject: (value: any) => void;
}

export interface TaskOptions {
  priority?: number;
  retryCount?: number;
}

export interface WorkerResponse<R> {
    payload?: R;
    error?: any;
}

class Queue {
  name: string;
  numThreads: number;
  
  tasksQueue: PriorityQueue<TaskInstance<any, any>> 
    = new PriorityQueue((instance: TaskInstance<any, any>) => instance.task.priority);
  dlQueue: Task<any>[] = [];
  workersPool: {[threadId: number]: Worker } = {};
  freeWorkers: number[] = [];
  jobs: {[threadId: number]: TaskInstance<any, any>} = {};

  setTimeoutCancel: any;

  constructor(name: string, numThreads: number) {
    console.log(`[${name}] queue created; [${numThreads}] threads.`);
    this.name = name;
    this.numThreads = numThreads;
    for (var i = 0; i < numThreads; i++) {
      const worker = this.createWorker();
    }
  }

  add<P, R>(name: string, payload: P, options?: TaskOptions): Promise<R> {
    const id = nextId(this.name);
    console.log(`[${id}] Queueing task: ${name}`);
    return new Promise<R>((resolve, reject)=>{
        this.tasksQueue.enqueue({task: {id, name, payload, priority: options?.priority || 100}, promise: {resolve, reject}});
        this.trySchedule();
    });
  }

  status(): any {
    console.log(this.jobs);
    console.log(this.tasksQueue);
    console.log(this.freeWorkers);
    console.log(this.dlQueue);
  }

  private createWorker() {
    const worker = new Worker(path.join(__dirname, 'WorkerExecutor.js'));
    worker.on("message", <R>(message: WorkerResponse<R>) => {
      this.freeWorkers.push(worker.threadId);
      this.runTaskPromise(worker.threadId, message);
      this.trySchedule();
    });
    worker.on("error", (e) => {
      this.runTaskPromise(worker.threadId, {error: e});
      delete this.workersPool[worker.threadId];
      this.trySchedule();
    });
    this.workersPool[worker.threadId] = worker;
    this.freeWorkers.push(worker.threadId);
  }

  private runTaskPromise<R>(threadId: number, reponse: WorkerResponse<R>) {
    const taskInstance = this.jobs[threadId];
    if (reponse.error) {
      console.log(`[${taskInstance.task.id}] Task error: ${taskInstance.task.name}, releasing worker [${threadId}]`);
      this.dlQueue.push(taskInstance.task);
      taskInstance.promise.reject(reponse.error);
    } else {
      console.log(`[${taskInstance.task.id}] Task completed: ${taskInstance.task.name}, releasing worker [${threadId}]`);
      taskInstance.promise.resolve(reponse.payload);
    }
    delete this.jobs[threadId];
  }

  private trySchedule() {
    if (this.freeWorkers.length > 0 && this.tasksQueue.size() > 0) {
      const taskInstance = this.tasksQueue.dequeue();
      const workerId = this.freeWorkers.shift();
      if (workerId && taskInstance) {
        this.jobs[workerId] = taskInstance;
        const worker = this.workersPool[workerId];
        console.log(`[${taskInstance.task.id}] Starting task ${taskInstance.task.name} using worker [${worker.threadId}]`);
        worker.postMessage(taskInstance.task);
      }
    }
  }
}

export { Queue };
