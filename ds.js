/* Data structures used by the banking system.
   Hash maps use the built-in Map (O(1) average). Queue and Graph are written here. */

/** FIFO queue with O(1) enqueue and amortised O(1) dequeue (head index, no array shifting). */
class Queue {
  constructor(items = []) { this.items = items.slice(); this.head = 0; }
  enqueue(x) { this.items.push(x); }
  dequeue() {
    if (this.isEmpty()) return undefined;
    const x = this.items[this.head++];
    if (this.head > 32 && this.head * 2 > this.items.length) { this.items = this.items.slice(this.head); this.head = 0; }
    return x;
  }
  peek() { return this.items[this.head]; }
  isEmpty() { return this.head >= this.items.length; }
  get size() { return this.items.length - this.head; }
  toArray() { return this.items.slice(this.head); }
}

/** Graph as an adjacency list: Map<node, node[]>. Used for customer -> accounts. */
class Graph {
  constructor() { this.adj = new Map(); }
  addNode(n) { if (!this.adj.has(n)) this.adj.set(n, []); }
  addEdge(from, to) { this.addNode(from); this.adj.get(from).push(to); }
  removeEdge(from, to) {
    const list = this.adj.get(from);
    if (list) this.adj.set(from, list.filter(x => x !== to));
  }
  neighbors(n) { return this.adj.get(n) || []; }
  get size() { return this.adj.size; }
  entries() { return [...this.adj]; }
}

if (typeof module !== "undefined") module.exports = { Queue, Graph };
