import EventEmitter from "events";
import path from "path";
import { Worker } from "worker_threads";
import { PersistenceStore } from "./PersistenceStore";
import { PriorityQueue } from "./PriorityQueue";

import { log } from "./logger";
import { TaskFactory } from "./TaskFactory";

export interface Task<P> {
  id: string;
  name: string;
  script: string;
  priority: number;
  timeout: number;
  payload: P;
}

interface Job {
  task: Task<any>;
  clearTimeout: () => void;
}

export interface TaskDefinition {
  name: string;
  script: string;
  priority?: number;
  timeout?: number;
}

export interface TaskOptions {
  script?: string;
  priority?: number;
  timeout?: number;
}

export interface PersistenceAdapter<P> {
  onAppend(task: Task<P>): Promise<void>;
  onDelete(task: Task<P>): Promise<void>;
  getAll(): Promise<Task<P>[]>;
}

export interface WorkerResponse<R> {
  payload?: R;
  error?: any;
}

export interface QueueOptions {
  numThreads: number;
  persistenceAdapter?: PersistenceAdapter<any>,
  taskDefinitions?: TaskDefinition[],
}

class Queue {
  private tasksQueue: PriorityQueue<Task<any>> = new PriorityQueue(
    (task: Task<any>) => task.priority
  );
  private whenReady: Promise<boolean>;
  private dlQueue: Task<any>[] = [];
  private workersPool: { [threadId: number]: Worker } = {};
  private freeWorkers: number[] = [];
  private jobs: { [threadId: number]: Job } = {};
  private persistenceStore: PersistenceStore<any>;
  private taskFactory: TaskFactory;

  private events: EventEmitter = new EventEmitter();
  
  constructor(
    name: string, { numThreads, persistenceAdapter, taskDefinitions }: QueueOptions
  ) {
    log(`[${name}] queue created; [${numThreads}] threads.`);
    this.persistenceStore = new PersistenceStore(persistenceAdapter);
    this.taskFactory = new TaskFactory(name, taskDefinitions || []);
    this.whenReady = new Promise((resolve) => {
      this.persistenceStore
        .getAll()
        .then((tasks) => {
          if (tasks.length) {
            log(`[${name}] Restoring tasks: ${tasks.length}`);
            tasks.forEach((task) => this.tasksQueue.enqueue(task));
            process.nextTick(() => this.trySchedule());
          }
        })
        .catch(() => Promise.resolve())
        .finally(() => {
          console.log('Creating workers');
          for (var i = 0; i < numThreads; i++) {
            const worker = this.createWorker();
          }
          resolve(true);
        });
    });
  }

  add<P>(name: string, payload: P, options?: TaskOptions): Queue {
    this.whenReady.then(() => {
      console.log('Adding');
      const task = this.taskFactory.createTask(name, payload, options);
      this.persistenceStore
        .onAppend(task)
        .catch((e) => Promise.resolve())
        .finally(() => {
          this.tasksQueue.enqueue(task);
          this.trySchedule();
          console.log('Try schedule from adding');
        });
    });
    return this;
  }

  on<R>(taskName: string, callback: (error: any, result: R) => void): Queue {
    console.log('On ' + taskName);
    this.events.on(taskName, (error: any, response: R) => callback(error, response));
    return this;
  }

  status(): any {
    return {
      jobs: this.jobs,
      workers: this.workersPool,
    };
  }

  private createWorker(): void {
    const worker = new Worker(path.join(__dirname, "WorkerExecutor.js"));
    worker.on("message", <R>(message: WorkerResponse<R>) => {
      this.freeWorkers.push(worker.threadId);
      this.handleResponse(worker.threadId, message)
        .then(() => this.trySchedule());
    });
    worker.on("error", (e) => {
      delete this.workersPool[worker.threadId];
      this.handleResponse(worker.threadId, { error: e })
        .then(() => {
          this.createWorker();
          this.trySchedule();    
        });
    });
    worker.on("timeout", () => {
      const workerId = worker.threadId;
      delete this.workersPool[workerId];
      worker.terminate()
        .then(() => this.handleResponse(workerId, { error: `Execution timeout!` }))
        .then(() => {
          this.createWorker();
          this.trySchedule();
        });
    });
    this.workersPool[worker.threadId] = worker;
    this.freeWorkers.push(worker.threadId);
  }

  private handleResponse<R>(
    threadId: number,
    response: WorkerResponse<R>
  ): Promise<void> {
    const { task, clearTimeout } = this.jobs[threadId];
    clearTimeout();
    delete this.jobs[threadId];
    if (response.error) {
      log(
        `[${task.id}] Task [${task.name}] error: ${response.error?.message || response.error}, releasing worker [${threadId}]`
      );
      this.dlQueue.push(task);
      return this.persistenceStore
        .onDelete(task)
        .catch(() => Promise.resolve())
        .finally(() => this.events.emit(task.name, response.error))
    } else {
      log(`[${task.id}] Task completed: ${task.name}, releasing worker [${threadId}]`);
      return this.persistenceStore
        .onDelete(task)
        .catch(() => Promise.resolve())
        .finally(() => this.events.emit(task.name, undefined, response.payload));
    }
  }

  private trySchedule(): void {
    if (this.freeWorkers.length > 0 && this.tasksQueue.size() > 0) {
      const task = this.tasksQueue.dequeue();
      const workerId = this.freeWorkers.shift();
      if (workerId && task) {
        const worker = this.workersPool[workerId];
        log(
          `[${task.id}] Starting task ${task.name} using worker [${worker.threadId}]`
        );
        const clearTimeout = this.setTimeout(worker, task);
        this.jobs[workerId] = { task, clearTimeout };
        worker.postMessage(task);
      }
      this.trySchedule();
    }
  }

  private setTimeout<T>(worker: Worker, task: Task<T>): () => void {
    if (task.timeout) {
      const timeoutId = setTimeout(() => worker.emit('timeout'), task.timeout);
      return () => clearTimeout(timeoutId);
    }
    return () => {};
  }
}

export { Queue };
