
import { Task, TaskDefinition, TaskOptions } from "./Queue";
import nextId from "./TaskId";

type TaskDefinitionsMap = { [taskName: string]: TaskDefinition };

class TaskFactory {
  queueName: string;
  taskDefinitionsMap: TaskDefinitionsMap = {};

  constructor(queueName: string, taskDefinitions: TaskDefinition[]) {
    this.queueName = queueName;
    this.taskDefinitionsMap = taskDefinitions.reduce(
      (map, definition) => ({ ...map, [definition.name]: definition }),
      {}
    );
  }

  createTask<P>(name: string, payload: P, options?: TaskOptions): Task<P> {
    const id = nextId(this.queueName);
    return {
      id,
      name,
      script: options?.script || this.taskDefinitionsMap[name]?.script || name,
      payload,
      timeout: options?.timeout || this.taskDefinitionsMap[name]?.timeout || undefined,
      priority:
        options?.priority || this.taskDefinitionsMap[name]?.priority || 100,
    };
  }
}

export { TaskFactory };
