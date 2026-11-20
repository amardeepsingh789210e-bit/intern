/* Banking logic. No DOM code here, so it can be tested on its own. */
const DS = (typeof require !== "undefined") ? require("./ds.js") : { Queue, Graph };
const round2 = n => Math.round(n * 100) / 100;

class Bank {
  constructor() {
    this.customers = new Map();      // Map<id, {id, name}>
    this.accounts = new Map();       // Map<id, {id, customerId, balance}>
    this.queue = new DS.Queue();     // pending transactions (FIFO)
    this.history = [];               // processed transactions (vector)
    this.graph = new DS.Graph();     // customerId -> [accountId]
    this.nextCustomer = 1; this.nextAccount = 101; this.nextTx = 1;
  }

  addCustomer(name) {
    name = String(name || "").trim();
    if (!name) throw new Error("Enter the customer's name.");
    const id = this.nextCustomer++;
    this.customers.set(id, { id, name });
    this.graph.addNode(id);
    return id;
  }

  openAccount(customerId, initial = 0) {
    if (!this.customers.has(customerId)) throw new Error("Add a customer first.");
    initial = round2(Number(initial) || 0);
    if (initial < 0) throw new Error("Initial deposit can't be negative.");
    const id = this.nextAccount++;
    this.accounts.set(id, { id, customerId, balance: 0 });
    this.graph.addEdge(customerId, id);
    if (initial > 0) { this.submit("deposit", id, initial); this.processAll(); }
    return id;
  }

  closeAccount(id) {
    const a = this.accounts.get(id);
    if (!a) throw new Error("Account not found.");
    if (a.balance !== 0) throw new Error("Withdraw or transfer the balance before closing the account.");
    if (this.queue.toArray().some(t => t.accountId === id || t.toAccountId === id))
      throw new Error("Process the queued transactions for this account first.");
    this.accounts.delete(id);
    this.graph.removeEdge(a.customerId, id);
  }

  /** Validate input and add a transaction to the queue. Returns the queued transaction. */
  submit(type, accountId, amount, toAccountId = null) {
    if (!["deposit", "withdraw", "transfer"].includes(type)) throw new Error("Unknown transaction type.");
    if (!this.accounts.has(accountId)) throw new Error("Account not found.");
    amount = round2(Number(amount));
    if (!(amount > 0)) throw new Error("Enter an amount greater than zero.");
    if (type === "transfer") {
      if (!this.accounts.has(toAccountId)) throw new Error("Choose the account to transfer to.");
      if (toAccountId === accountId) throw new Error("Choose two different accounts.");
    }
    const tx = { id: this.nextTx++, type, accountId, toAccountId: type === "transfer" ? toAccountId : null, amount };
    this.queue.enqueue(tx);
    return tx;
  }

  /** Take the next transaction off the queue, apply it, and record it in history. */
  processNext() {
    if (this.queue.isEmpty()) return null;
    const tx = this.queue.dequeue();
    const from = this.accounts.get(tx.accountId);
    const to = tx.toAccountId != null ? this.accounts.get(tx.toAccountId) : null;
    let status = "success", note = "";
    if (!from) { status = "failed"; note = "Account not found"; }
    else if (tx.type === "transfer" && !to) { status = "failed"; note = "Destination account not found"; }
    else if (tx.type !== "deposit" && from.balance < tx.amount) { status = "failed"; note = "Insufficient balance"; }
    else {
      if (tx.type === "deposit") from.balance = round2(from.balance + tx.amount);
      else { from.balance = round2(from.balance - tx.amount); if (to) to.balance = round2(to.balance + tx.amount); }
    }
    const done = { ...tx, status, note, balanceAfter: from ? from.balance : null, time: new Date().toISOString() };
    this.history.push(done);
    return done;
  }

  processAll() { const out = []; let r; while ((r = this.processNext())) out.push(r); return out; }

  totalBalance() { let t = 0; for (const a of this.accounts.values()) t += a.balance; return round2(t); }

  toJSON() {
    return {
      customers: [...this.customers], accounts: [...this.accounts], queue: this.queue.toArray(),
      history: this.history, graph: this.graph.entries(),
      next: { c: this.nextCustomer, a: this.nextAccount, t: this.nextTx }
    };
  }
  static fromJSON(s) {
    const b = new Bank();
    b.customers = new Map(s.customers); b.accounts = new Map(s.accounts);
    b.queue = new DS.Queue(s.queue); b.history = s.history;
    b.graph = new DS.Graph(); for (const [k, v] of s.graph) b.graph.adj.set(k, v);
    b.nextCustomer = s.next.c; b.nextAccount = s.next.a; b.nextTx = s.next.t;
    return b;
  }

  /** Demo data that matches the report's Table 4.1. */
  static demo() {
    const b = new Bank();
    const c1 = b.addCustomer("Amardeep Singh"), c2 = b.addCustomer("Demo Customer");
    const a1 = b.openAccount(c1, 6000);
    b.openAccount(c2, 2500);
    b.submit("deposit", a1, 500); b.submit("withdraw", a1, 200);
    b.processAll();
    return b;
  }

  /** Test cases: the report's Table 4.1 plus extra checks. Runs on a fresh Bank. */
  static runTests() {
    const results = [];
    const test = (name, input, expected, fn) => {
      let pass = false, actual = "";
      try { const r = fn(); pass = r === true || (r && r.pass); actual = r && r.actual ? r.actual : ""; }
      catch (e) { actual = "Error: " + e.message; }
      results.push({ name, input, expected, pass: !!pass, actual });
    };
    const b = new Bank();
    const cid = b.addCustomer("Test Customer");
    let acc;
    test("Create account", "Customer ID 1, initial deposit 6000", "Account 101 created with balance 6000", () => {
      acc = b.openAccount(cid, 6000);
      return { pass: acc === 101 && b.accounts.get(101).balance === 6000, actual: `Account ${acc}, balance ${b.accounts.get(acc).balance}` };
    });
    test("Deposit", "Account 101, amount 500", "Balance 6500, transaction logged", () => {
      const n = b.history.length; b.submit("deposit", acc, 500); b.processAll();
      return { pass: b.accounts.get(acc).balance === 6500 && b.history.length === n + 1, actual: `Balance ${b.accounts.get(acc).balance}` };
    });
    test("Withdrawal", "Account 101, amount 200", "Balance 6300, transaction logged", () => {
      const n = b.history.length; b.submit("withdraw", acc, 200); b.processAll();
      return { pass: b.accounts.get(acc).balance === 6300 && b.history.length === n + 1, actual: `Balance ${b.accounts.get(acc).balance}` };
    });
    test("View history", "Account 101", "Deposit and withdraw transactions listed", () => {
      const h = b.history.filter(t => t.accountId === acc);
      return { pass: h.length === 3 && h.every(t => t.status === "success"), actual: `${h.length} transactions` };
    });
    test("Customer mapping", "Customer ID 1", "Mapped account 101 displayed", () => {
      const m = b.graph.neighbors(cid);
      return { pass: m.length === 1 && m[0] === 101, actual: `Customer 1 -> ${m.join(", ")}` };
    });
    test("Overdraft rejected", "Withdraw 999999 from account 101", "Failed, balance stays 6300", () => {
      b.submit("withdraw", acc, 999999); const r = b.processAll()[0];
      return { pass: r.status === "failed" && b.accounts.get(acc).balance === 6300, actual: `${r.status}: ${r.note}` };
    });
    test("Invalid amount rejected", "Deposit -50", "Error before queueing", () => {
      try { b.submit("deposit", acc, -50); return false; } catch (e) { return { pass: true, actual: e.message }; }
    });
    test("Transfer", "101 -> new account, amount 300", "101 = 6000, new = 300", () => {
      const other = b.openAccount(cid, 0); b.submit("transfer", acc, 300, other); b.processAll();
      return { pass: b.accounts.get(acc).balance === 6000 && b.accounts.get(other).balance === 300, actual: `101: ${b.accounts.get(acc).balance}, ${other}: ${b.accounts.get(other).balance}` };
    });
    test("Queue is first in, first out", "Submit deposit 1, then deposit 2", "Processed in the same order", () => {
      const t1 = b.submit("deposit", acc, 1), t2 = b.submit("deposit", acc, 2);
      const a = b.processNext(), c = b.processNext();
      return { pass: a.id === t1.id && c.id === t2.id, actual: `Order ${a.id}, ${c.id}` };
    });
    return results;
  }
}

if (typeof module !== "undefined") module.exports = { Bank };
