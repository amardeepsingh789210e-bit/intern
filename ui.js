/* Screen rendering and events. Business logic lives in bank.js. */
const KEY = "banking-system-v2";
let bank = loadBank(), tab = "history", filter = "all";
const $ = id => document.getElementById(id);
const fmt = n => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const typeLabel = t => ({ deposit: "Deposit", withdraw: "Withdraw", transfer: "Transfer" }[t]);

function loadBank() {
  try { const s = localStorage.getItem(KEY); if (s) return Bank.fromJSON(JSON.parse(s)); } catch (e) {}
  return Bank.demo();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(bank.toJSON())); } catch (e) {} }

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 2800);
}
/** Run an action; show any validation error as a toast. */
function act(fn) {
  try { const msg = fn(); render(); if (msg) toast(msg); }
  catch (e) { toast(e.message); }
}
const ownerName = a => (bank.customers.get(a.customerId) || {}).name || "";
const acctOptions = () => [...bank.accounts.values()].map(a => `<option value="${a.id}">Account ${a.id} (${esc(ownerName(a))})</option>`).join("");

function render() {
  const keep = { c: $("aCustomer").value, a: $("tAccount").value, t: $("tTo").value };
  $("aCustomer").innerHTML = [...bank.customers.values()].map(c => `<option value="${c.id}">${c.id} – ${esc(c.name)}</option>`).join("");
  $("tAccount").innerHTML = acctOptions(); $("tTo").innerHTML = acctOptions();
  if (keep.c) $("aCustomer").value = keep.c; if (keep.a) $("tAccount").value = keep.a; if (keep.t) $("tTo").value = keep.t;
  const isTransfer = $("tType").value === "transfer";
  $("toWrap").classList.toggle("hidden", !isTransfer);
  $("tAccountLabel").textContent = isTransfer ? "From account" : "Account";

  $("stats").innerHTML = [
    [bank.customers.size, "Customers"], [bank.accounts.size, "Accounts"],
    [fmt(bank.totalBalance()), "Total balance"], [bank.history.length, "Transactions processed"]
  ].map(([v, l]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");

  $("accounts").innerHTML = bank.accounts.size ? [...bank.accounts.values()].map(a => `
    <div class="acct"><div class="no">Account ${a.id}</div><div class="bal">${fmt(a.balance)}</div>
    <div class="own">${esc(ownerName(a))}</div>
    <button class="ghost danger small" data-close="${a.id}">Close account</button></div>`).join("")
    : `<div class="empty">No accounts yet. Add a customer, then open an account.</div>`;

  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  $("panel").innerHTML = panels[tab]();
  save();
}

const histRows = () => bank.history.filter(h => filter === "all" || String(h.accountId) === filter || String(h.toAccountId) === filter);

const panels = {
  history() {
    const opts = `<option value="all">All accounts</option>` + [...new Set(bank.history.flatMap(h => [h.accountId, h.toAccountId]).filter(x => x != null))]
      .sort((a, b) => a - b).map(id => `<option value="${id}" ${String(id) === filter ? "selected" : ""}>Account ${id}</option>`).join("");
    const rows = histRows();
    const toolbar = `<div class="toolbar"><div><label for="hFilter">Show</label><select id="hFilter">${opts}</select></div>
      <button class="ghost" id="exportCsv">Export CSV</button></div>`;
    if (!rows.length) return toolbar + `<div class="empty">No transactions to show.</div>`;
    return toolbar + `<div class="scroll"><table><thead><tr><th>#</th><th>Time</th><th>Account</th><th>Type</th><th class="num">Amount</th><th class="num">Balance after</th><th>Status</th></tr></thead><tbody>` +
      [...rows].reverse().map(h => `<tr><td>${h.id}</td><td>${esc(new Date(h.time).toLocaleString("en-IN"))}</td>
        <td>${h.accountId}${h.toAccountId ? " → " + h.toAccountId : ""}</td>
        <td><span class="tag ${h.type}">${typeLabel(h.type)}</span></td>
        <td class="num">${fmt(h.amount)}</td><td class="num">${h.balanceAfter == null ? "–" : fmt(h.balanceAfter)}</td>
        <td>${h.status === "success" ? "Completed" : `<span class="tag failed">${esc(h.note)}</span>`}</td></tr>`).join("") + `</tbody></table></div>`;
  },
  queue() {
    const q = bank.queue.toArray();
    if (!q.length) return `<div class="empty">The queue is empty. Turn off “Process automatically”, submit a few transactions, and they will wait here in order.</div>`;
    return `<p class="note">Transactions leave the queue in the order they arrived (first in, first out).</p><div class="scroll"><table><thead><tr><th>Position</th><th>Account</th><th>Type</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>` +
      q.map((t, i) => `<tr><td>${i + 1}${i === 0 ? " (front)" : ""}</td><td>${t.accountId}${t.toAccountId ? " → " + t.toAccountId : ""}</td>
      <td><span class="tag ${t.type}">${typeLabel(t.type)}</span></td><td class="num">${fmt(t.amount)}</td><td><span class="tag pending">Waiting</span></td></tr>`).join("") + `</tbody></table></div>`;
  },
  graph() {
    if (!bank.customers.size) return `<div class="empty">No customers yet.</div>`;
    return `<ul class="graph">` + bank.graph.entries().map(([cid, list]) =>
      `<li><strong>${esc((bank.customers.get(cid) || {}).name || cid)}</strong> (ID ${cid}) → ` +
      (list.length ? list.map(a => `<span class="chip">${a}</span>`).join("") : `<span class="empty">no accounts</span>`) + `</li>`).join("") + `</ul>`;
  },
  ds() {
    return `<div class="scroll"><table class="bold"><thead><tr><th>Structure</th><th>Used for</th><th>Complexity</th><th class="num">Items now</th></tr></thead><tbody>
      <tr><td>Hash map (customers)</td><td>Customer lookup</td><td>O(1) average</td><td class="num">${bank.customers.size}</td></tr>
      <tr><td>Hash map (accounts)</td><td>Account lookup</td><td>O(1) average</td><td class="num">${bank.accounts.size}</td></tr>
      <tr><td>Queue</td><td>Transaction order</td><td>O(1) enqueue and dequeue</td><td class="num">${bank.queue.size}</td></tr>
      <tr><td>Array (vector)</td><td>Transaction history</td><td>O(1) append, O(n) search</td><td class="num">${bank.history.length}</td></tr>
      <tr><td>Graph (map of lists)</td><td>Customer → accounts</td><td>O(1) average lookup</td><td class="num">${bank.graph.size}</td></tr></tbody></table></div>`;
  },
  tests() {
    const r = Bank.runTests(), passed = r.filter(x => x.pass).length;
    return `<p class="note">${passed} of ${r.length} passed. These run on a separate, empty bank, so your data is not touched. The first five rows are the report's Table 4.1.</p>
      <div class="scroll"><table><thead><tr><th>Test case</th><th>Input</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>` +
      r.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.input)}</td><td>${esc(x.expected)}</td><td>${esc(x.actual)}</td>
        <td><span class="tag ${x.pass ? "pass" : "fail"}">${x.pass ? "Pass" : "Fail"}</span></td></tr>`).join("") + `</tbody></table></div>`;
  }
};

function exportCsv() {
  const head = ["id", "time", "type", "from_account", "to_account", "amount", "status", "note", "balance_after"];
  const lines = [head.join(",")].concat(histRows().map(h =>
    [h.id, h.time, h.type, h.accountId, h.toAccountId ?? "", h.amount, h.status, `"${h.note}"`, h.balanceAfter ?? ""].join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = "transactions.csv"; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- Events ---------- */
$("addCustomer").onclick = () => act(() => { const id = bank.addCustomer($("cName").value); $("cName").value = ""; return `Customer ${id} added.`; });
$("addAccount").onclick = () => act(() => `Account ${bank.openAccount(Number($("aCustomer").value), $("aInitial").value)} opened.`);
$("tType").onchange = render;
$("submitTx").onclick = () => act(() => {
  const type = $("tType").value;
  bank.submit(type, Number($("tAccount").value), $("tAmount").value, type === "transfer" ? Number($("tTo").value) : null);
  $("tAmount").value = "";
  if ($("auto").checked) { const r = bank.processAll().pop(); tab = "history"; return r.status === "success" ? "Transaction completed." : "Failed: " + r.note; }
  tab = "queue"; return "Added to the queue.";
});
$("procOne").onclick = () => act(() => { const r = bank.processNext(); tab = "history"; return r ? (r.status === "success" ? "Processed 1 transaction." : "Failed: " + r.note) : "The queue is empty."; });
$("procAll").onclick = () => act(() => { const r = bank.processAll(); tab = "history"; return r.length ? `Processed ${r.length} transaction(s).` : "The queue is empty."; });
$("reset").onclick = () => { if (confirm("Reset all data to the demo?")) { bank = Bank.demo(); filter = "all"; render(); toast("Demo data restored."); } };
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]");
  if (c) act(() => { bank.closeAccount(Number(c.dataset.close)); return "Account closed."; });
  if (e.target.id === "exportCsv") exportCsv();
});
document.addEventListener("change", e => { if (e.target.id === "hFilter") { filter = e.target.value; render(); } });

render();
