export type PriorityGetter<T> = (item: T) => number;

class PriorityQueue<T> {

    items: T[] = [];
    priorityGetter: PriorityGetter<T>;

    constructor(priotrityGetter: PriorityGetter<T>) {
        this.priorityGetter = priotrityGetter;
    }

    enqueue(item: T): void {
        this.items.push(item);
    }

    dequeue(): T {
        const minItem = this.items.reduce((previous, current, index) => {
            const priority = this.priorityGetter(current);
            return (priority < previous.priority) ? {index, priority} : previous;
        }, {index: -1, priority: Number.MAX_VALUE});
        if (minItem.index !== -1) {
            const item = this.items[minItem.index];
            const first = this.items.slice(0, minItem.index);
            const second = this.items.slice(minItem.index + 1);
            this.items = [...first, ...second];
            return item;
        } else {
            return undefined;
        }
    }

    size(): number {
        return this.items.length;
    }
}

export { PriorityQueue };
