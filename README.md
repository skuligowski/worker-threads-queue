# Concurrent Task Queue with Worker Threads

A TypeScript implementation of a concurrent task queue with worker threads.

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [Creating a Queue](#creating-a-queue)
  - [Adding Tasks](#adding-tasks)
  - [Event Handling](#event-handling)
  - [Checking Queue Status](#checking-queue-status)
- [Documentation](#documentation)
- [License](#license)

## Overview

This project provides a versatile task queue designed to efficiently manage and execute tasks in a concurrent environment using worker threads.

## Installation

To use this task queue in your project, install it via npm:

```
npm install
```

## Usage

### Creating a Queue

Create a task queue with a specific name and configuration:

```
import { Queue, TaskOptions, QueuePersistenceAdapter } from './Queue';
import path from 'path';

const myQueue = new Queue('test', {
  numThreads: 10,
  persistenceAdapter: new QueuePersistenceAdapter('queue.test.dat', 60),
  taskDefinitions: [
    { name: 'task1', script: path.join(__dirname, 'task1.js'), priority: 200 },
    { name: 'task2', script: path.join(__dirname, 'task2.js'), priority: 100 },
  ],
});
```

### Adding Tasks

Add a task to the queue:

```
myQueue.add('task1', { a: 200 });
```

### Event Handling

Set up an event listener for task completion or error:

```
myQueue.on('task1', (error, result) => {
  if (error) {
    console.error(`Task 'task1' failed with error: ${error}`);
  } else {
    console.log(`Task 'task1' completed successfully with result:`, result);
  }
});
```

### Checking Queue Status

Check the status of the queue:

```
const queueStatus = myQueue.status();
console.log('Queue status:', queueStatus);
```

## Documentation

### `Queue`

#### Constructor

```
const queue = new Queue(name: string, options: QueueOptions);
```

- `name`: A string representing the name of the queue.
- `options`: An object containing configuration options for the queue.
  - `numThreads`: The number of worker threads to use.
  - `persistenceAdapter`: An optional persistence adapter for storing tasks.
  - `taskDefinitions`: An array of task definitions for predefining tasks.

#### Methods

```
- `add<P>(name: string, payload: P, options?: TaskOptions): Queue`: Adds a task to the queue.
- `on<R>(taskName: string, callback: (error: any, result: R) => void): Queue`: Sets up an event listener for task completion or error.
- `status(): any`: Retrieves the current status of the queue.
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
