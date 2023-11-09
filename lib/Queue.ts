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
  payload: P;
  timeout?: number;
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

class Queue {
  name: string;
  numThreads: number;

  tasksQueue: PriorityQueue<Task<any>> = new PriorityQueue(
    (task: Task<any>) => task.priority
  );
  whenReady: Promise<boolean>;
  dlQueue: Task<any>[] = [];
  workersPool: { [threadId: number]: Worker } = {};
  freeWorkers: number[] = [];
  jobs: { [threadId: number]: Task<any> } = {};
  persistenceStore: PersistenceStore<any>;
  taskFactory: TaskFactory;

  events: EventEmitter = new EventEmitter();

  constructor(
    name: string,
    numThreads: number,
    persistenceAdapter?: PersistenceAdapter<any>,
    taskDefinitions: TaskDefinition[] = []
  ) {
    log(`[${name}] queue created; [${numThreads}] threads.`);
    this.name = name;
    this.numThreads = numThreads;
    this.persistenceStore = new PersistenceStore(persistenceAdapter);
    this.taskFactory = new TaskFactory(name, taskDefinitions);
    this.whenReady = new Promise((resolve) => {
      this.persistenceStore
        .getAll()
        .then((tasks) => {
          if (tasks.length) {
            log(`[${name}}] Restoring tasks: ${tasks.length}`);
            tasks.forEach((task) => this.tasksQueue.enqueue(task));
            process.nextTick(() => this.trySchedule());
          }
        })
        .catch((e) => Promise.resolve())
        .finally(() => {
          for (var i = 0; i < numThreads; i++) {
            const worker = this.createWorker();
          }
          resolve(true);
        });
    });
  }

  add<P>(name: string, payload: P, options?: TaskOptions): void {
    this.whenReady.then(() => {
      const task = this.taskFactory.createTask(name, payload, options);
      this.persistenceStore
        .onAppend(task)
        .catch((e) => Promise.resolve())
        .finally(() => {
          this.tasksQueue.enqueue(task);
          this.trySchedule();
        });
    });
  }

  on<R>(taskName: string, callback: (error: any, result: R) => void): void {
    this.events.on(taskName, (error: any, response: R) => {
      callback(error, response);
    });
  }

  private createWorker(): void {
    const worker = new Worker(path.join(__dirname, "WorkerExecutor.js"));
    worker.on("message", <R>(message: WorkerResponse<R>) => {
      this.freeWorkers.push(worker.threadId);
      this.handleResponse(worker.threadId, message);
      this.trySchedule();
    });
    worker.on("error", (e) => {
      this.handleResponse(worker.threadId, { error: e });
      delete this.workersPool[worker.threadId];
      this.trySchedule();
    });
    this.workersPool[worker.threadId] = worker;
    this.freeWorkers.push(worker.threadId);
  }

  private handleResponse<R>(
    threadId: number,
    response: WorkerResponse<R>
  ): void {
    const task = this.jobs[threadId];
    if (response.error) {
      log(
        `[${task.id}] Task error: ${task.name}, releasing worker [${threadId}]`
      );
      this.dlQueue.push(task);
      this.persistenceStore
        .onDelete(task)
        .catch((e) => Promise.resolve())
        .finally(() => this.events.emit(task.name, response.error));
    } else {
      log(`[${task.id}] Task completed: ${task.name}, releasing worker [${threadId}]`);
      this.persistenceStore
        .onDelete(task)
        .catch((e) => Promise.resolve())
        .finally(() => this.events.emit(task.name, null, response.payload));
    }
    delete this.jobs[threadId];
  }

  private trySchedule(): void {
    if (this.freeWorkers.length > 0 && this.tasksQueue.size() > 0) {
      const task = this.tasksQueue.dequeue();
      const workerId = this.freeWorkers.shift();
      if (workerId && task) {
        this.jobs[workerId] = task;
        const worker = this.workersPool[workerId];
        log(
          `[${task.id}] Starting task ${task.name} using worker [${worker.threadId}]`
        );
        worker.postMessage(task);
      }
      this.trySchedule();
    }
  }
}

export { Queue };
