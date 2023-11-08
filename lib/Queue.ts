import EventEmitter from "events";
import path from "path";
import { Worker } from "worker_threads";
import { PersistenceStore } from "./PersistenceStore";
import { PriorityQueue } from "./PriorityQueue";
import nextId from "./TaskId";

export interface Task<P> {
  id: string;
  name: string;
  priority: number;
  payload: P;
}

interface TaskInstance<P, R> {
  task: Task<P>;
}

export interface PersistenceAdapter<P> {
  onAppend(task: Task<P>): Promise<void>;
  onDelete(task: Task<P>): Promise<void>;
  getAll(): Promise<Task<P>[]>;
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

  tasksQueue: PriorityQueue<TaskInstance<any, any>> = new PriorityQueue(
    (instance: TaskInstance<any, any>) => instance.task.priority
  );
  whenReady: Promise<boolean>;
  dlQueue: Task<any>[] = [];
  workersPool: { [threadId: number]: Worker } = {};
  freeWorkers: number[] = [];
  jobs: { [threadId: number]: TaskInstance<any, any> } = {};
  persistenceStore: PersistenceStore<any>;

  events: EventEmitter = new EventEmitter();

  constructor(
    name: string,
    numThreads: number,
    persistenceAdapter?: PersistenceAdapter<any>
  ) {
    console.log(`[${name}] queue created; [${numThreads}] threads.`);
    this.name = name;
    this.numThreads = numThreads;
    this.persistenceStore = new PersistenceStore(persistenceAdapter);
    this.whenReady = new Promise((resolve) => {
      this.persistenceStore.getAll()
      .then(tasks => { 
        if (tasks.length) {
          console.log(`[${name}}] Restoring tasks: ${tasks.length}`);
          tasks.forEach(task => this.tasksQueue.enqueue({ task }));
          process.nextTick(() => this.trySchedule());
        }
      })
      .catch(e => Promise.resolve())
      .finally(() => {
        for (var i = 0; i < numThreads; i++) {
          const worker = this.createWorker();
        }
        resolve(true);
      })
    });

  }

  add<P>(name: string, payload: P, options?: TaskOptions): void {
    this.whenReady.then(() => {
      const id = nextId(this.name);
      console.log(`[${id}] Queueing task: ${name}`);
      const task = { id, name, payload, priority: options?.priority || 100 };
      this.persistenceStore.onAppend(task)
        .catch(e => Promise.resolve())
        .finally(() => {
          this.tasksQueue.enqueue({ task });
          this.trySchedule();
        });  
    });
  }

  on<R>(taskName: string, callback: (error: any, result: R) => void) {
    this.events.on(taskName, (error: any, response: R) => {
      callback(error, response);
    });
  }

  status(): any {
    console.log(this.jobs);
    console.log(this.tasksQueue);
    console.log(this.freeWorkers);
    console.log(this.dlQueue);
  }

  private createWorker() {
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

  private handleResponse<R>(threadId: number, response: WorkerResponse<R>) {
    const taskInstance = this.jobs[threadId];
    if (response.error) {
      console.log(
        `[${taskInstance.task.id}] Task error: ${taskInstance.task.name}, releasing worker [${threadId}]`
      );
      this.dlQueue.push(taskInstance.task);
      this.persistenceStore.onDelete(taskInstance.task)
        .catch(e => Promise.resolve())
        .finally(() => this.events.emit(taskInstance.task.name, response.error));
    } else {
      console.log(
        `[${taskInstance.task.id}] Task completed: ${taskInstance.task.name}, releasing worker [${threadId}]`
      );
      this.persistenceStore.onDelete(taskInstance.task)
        .catch(e => Promise.resolve())
        .finally(() => this.events.emit(taskInstance.task.name, null, response.payload));
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
        console.log(
          `[${taskInstance.task.id}] Starting task ${taskInstance.task.name} using worker [${worker.threadId}]`
        );
        worker.postMessage(taskInstance.task);
      }
      this.trySchedule();
    }
  }
}

export { Queue };
