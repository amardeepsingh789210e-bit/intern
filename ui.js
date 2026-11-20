/* Screen rendering and events. Business logic lives in bank.js. */
let bank = loadBank(), tab = "history", mode = "tx", txType = "deposit", filter = "all", selected = null, pending = {};
const $ = id => document.getElementById(id);
const fmt = n => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const typeLabel = t => ({ deposit: "Deposit", withdraw: "Withdraw", transfer: "Transfer" }[t]);
const when = iso => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function loadBank() {
  const saved = Repository.load();
  if (saved) { try { return Bank.fromJSON(saved); } catch (e) {} }
  return Bank.demo();
}
function save() { Repository.save(bank.toJSON()); }

/* ---------- Console menu: the same menu as bank.exe in the report (Figure 4.1) ---------- */
const MENU = ["==== Banking System Menu ====", "1. Show Balance", "2. Show Transaction History", "3. Show Customer Mapping", "4. Exit"];
let conLog = [...MENU], conMode = "menu";
const conLabel = () => conMode === "balance" ? "Enter account ID:" : conMode === "exit" ? "Press Enter to restart:" : "Enter choice:";
function conReset() { conLog = [...MENU]; conMode = "menu"; }
function conRun(raw) {
  const v = raw.trim();
  conLog.push(`${conLabel()} ${v}`);
  if (conMode === "exit") { conReset(); return; }
  if (conMode === "balance") {
    const id = v === "" ? bank.accounts.keys().next().value : Number(v);
    const a = bank.accounts.get(id);
    conLog.push("", a ? `Account ${a.id} Balance: ${a.balance}` : "Account not found.", "");
    conMode = "menu"; return;
  }
  if (v === "1") conMode = "balance";
  else if (v === "2") {
    conLog.push("Transaction History:");
    if (!bank.history.length) conLog.push("No transactions yet.");
    bank.history.forEach(h => conLog.push(`Account ID: ${h.accountId} | ${typeLabel(h.type).padEnd(8)} | Amount: ${h.amount}` +
      (h.toAccountId ? ` -> ${h.toAccountId}` : "") + (h.status === "failed" ? ` | FAILED (${h.note})` : "")));
    conLog.push("");
  } else if (v === "3") {
    conLog.push("Customer Account Mapping:");
    bank.graph.entries().forEach(([cid, list]) => list.length ? list.forEach(a => conLog.push(`Customer ID: ${cid} -> ${a}`)) : conLog.push(`Customer ID: ${cid} -> (no accounts)`));
    conLog.push("");
  } else if (v === "4") { conLog.push("", "Thank you for using the Banking System.", ""); conMode = "exit"; }
  else conLog.push("Invalid choice. Enter 1, 2, 3 or 4.", "");
}

/* ---------- Helpers ---------- */
function toast(msg, isError) {
  const t = $("toast"); t.textContent = msg; t.className = "show" + (isError ? " err" : "");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 3000);
}
/** Run an action; show its message, or the validation error, as a toast. */
function act(fn) {
  try { const msg = fn(); render(); if (msg) toast(msg); }
  catch (e) { toast(e.message, true); }
}
const ownerName = a => (bank.customers.get(a.customerId) || {}).name || "";
const acctOptions = () => [...bank.accounts.values()].map(a => `<option value="${a.id}">Account ${a.id} · ${esc(ownerName(a))}</option>`).join("");

function selectAccount(id) {
  selected = selected === id ? null : id;
  filter = selected ? String(selected) : "all";
  if (selected) $("tAccount").value = String(selected);
  render();
}

function preview() {
  const el = $("tPreview"), a = bank.accounts.get(Number($("tAccount").value)), amt = Number($("tAmount").value);
  if (!a || !(amt > 0)) { el.textContent = ""; el.className = "preview"; return; }
  let msg, bad = false;
  if (txType === "deposit") msg = `Balance after: ${fmt(a.balance + amt)}`;
  else if (a.balance < amt) { bad = true; msg = `Not enough balance. Available: ${fmt(a.balance)}`; }
  else msg = `Balance after: ${fmt(a.balance - amt)}`;
  el.textContent = msg; el.className = "preview" + (bad ? " bad" : "");
}

/* ---------- Rendering ---------- */
function render() {
  const keep = { c: $("aCustomer").value, a: $("tAccount").value, t: $("tTo").value };
  $("aCustomer").innerHTML = [...bank.customers.values()].map(c => `<option value="${c.id}">${c.id} · ${esc(c.name)}</option>`).join("");
  $("tAccount").innerHTML = acctOptions(); $("tTo").innerHTML = acctOptions();
  if (keep.c) $("aCustomer").value = keep.c; if (keep.a) $("tAccount").value = keep.a; if (keep.t) $("tTo").value = keep.t;
  if (pending.c) $("aCustomer").value = String(pending.c);
  if (pending.a) { $("tAccount").value = String(pending.a); }
  pending = {};

  document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === mode));
  ["tx", "acct", "cust"].forEach(m => $("mode-" + m).classList.toggle("hidden", m !== mode));
  document.querySelectorAll("#typeSeg button").forEach(b => b.setAttribute("aria-selected", b.dataset.type === txType));
  $("toWrap").classList.toggle("hidden", txType !== "transfer");
  $("tAccountLabel").textContent = txType === "transfer" ? "From account" : "Account";
  $("submitTx").textContent = typeLabel(txType);
  $("submitTx").disabled = !bank.accounts.size;
  $("addAccount").disabled = !bank.customers.size;

  $("stats").innerHTML = [
    [bank.customers.size, "Customers"], [bank.accounts.size, "Accounts"],
    [fmt(bank.totalBalance()), "Total balance"], [bank.history.length, "Transactions processed"]
  ].map(([v, l]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");

  $("accounts").innerHTML = bank.accounts.size ? [...bank.accounts.values()].map(a => `
    <div class="acct ${a.id === selected ? "sel" : ""}" data-acct="${a.id}" role="button" tabindex="0" aria-pressed="${a.id === selected}">
      <div class="no">Account ${a.id}</div><div class="bal">${fmt(a.balance)}</div>
      <div class="foot"><span class="own">${esc(ownerName(a))}</span><button class="ghost danger small" data-close="${a.id}">Close</button></div>
    </div>`).join("") : `<div class="empty">No accounts yet. Choose “New account” on the left.</div>`;

  document.querySelectorAll(".tabs button").forEach(b => {
    b.setAttribute("aria-selected", b.dataset.tab === tab);
    if (b.dataset.tab === "queue") b.innerHTML = "Queue" + (bank.queue.size ? ` <span class="badge">${bank.queue.size}</span>` : "");
  });
  $("panel").innerHTML = panels[tab]();
  if (tab === "console") { const o = $("conOut"); if (o) o.scrollTop = o.scrollHeight; }
  preview();
  save();
}

const histRows = () => bank.history.filter(h => filter === "all" || String(h.accountId) === filter || String(h.toAccountId) === filter);

const panels = {
  history() {
    const ids = [...new Set(bank.history.flatMap(h => [h.accountId, h.toAccountId]).filter(x => x != null))].sort((a, b) => a - b);
    const opts = `<option value="all">All accounts</option>` + ids.map(id => `<option value="${id}" ${String(id) === filter ? "selected" : ""}>Account ${id}</option>`).join("");
    const rows = histRows();
    const toolbar = `<div class="toolbar"><div><label for="hFilter">Show</label><select id="hFilter">${opts}</select></div>
      <button class="ghost" id="exportCsv">Export CSV</button></div>`;
    if (!rows.length) return toolbar + `<div class="empty">No transactions to show.</div>`;
    return toolbar + `<div class="scroll"><table><thead><tr><th>#</th><th>When</th><th>Account</th><th>Type</th><th class="num">Amount</th><th class="num">Balance after</th><th>Status</th></tr></thead><tbody>` +
      [...rows].reverse().map(h => `<tr><td>${h.id}</td><td>${esc(when(h.time))}</td>
        <td>${h.accountId}${h.toAccountId ? " → " + h.toAccountId : ""}</td>
        <td><span class="tag ${h.type}">${typeLabel(h.type)}</span></td>
        <td class="num">${fmt(h.amount)}</td><td class="num">${h.balanceAfter == null ? "–" : fmt(h.balanceAfter)}</td>
        <td>${h.status === "success" ? "Completed" : `<span class="tag failed">${esc(h.note)}</span>`}</td></tr>`).join("") + `</tbody></table></div>`;
  },
  queue() {
    const q = bank.queue.toArray();
    const buttons = `<div class="toolbar"><button id="procOne" ${q.length ? "" : "disabled"}>Process next</button><button id="procAll" class="ghost" ${q.length ? "" : "disabled"}>Process all</button></div>`;
    if (!q.length) return buttons + `<div class="empty">The queue is empty. Tick “Only add to the queue” in the transaction form, submit a few transactions, and they will wait here in order.</div>`;
    return buttons + `<p class="note">Transactions leave the queue in the order they arrived (first in, first out).</p><div class="scroll"><table><thead><tr><th>Position</th><th>Account</th><th>Type</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>` +
      q.map((t, i) => `<tr><td>${i + 1}${i === 0 ? " (front)" : ""}</td><td>${t.accountId}${t.toAccountId ? " → " + t.toAccountId : ""}</td>
      <td><span class="tag ${t.type}">${typeLabel(t.type)}</span></td><td class="num">${fmt(t.amount)}</td><td><span class="tag pending">Waiting</span></td></tr>`).join("") + `</tbody></table></div>`;
  },
  graph() {
    if (!bank.customers.size) return `<div class="empty">No customers yet.</div>`;
    return `<ul class="graph">` + bank.graph.entries().map(([cid, list]) =>
      `<li><strong>${esc((bank.customers.get(cid) || {}).name || cid)}</strong> (ID ${cid}) → ` +
      (list.length ? list.map(a => `<span class="chip">${a}</span>`).join("") : `<span class="empty">no accounts</span>`) + `</li>`).join("") + `</ul>`;
  },
  console() {
    return `<div class="term"><pre id="conOut">${esc(conLog.join("\n"))}</pre>
      <div class="in"><label for="conIn">${conLabel()}</label><input id="conIn" autocomplete="off" spellcheck="false"></div></div>
      <p class="note" style="margin-top:10px">This is the menu of the C++ program in the report (Figure 4.1). Type 1, 2, 3 or 4 and press Enter. It reads the same data as the rest of this page.</p>`;
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
  },
  report() {
    return `<div class="report">
      <h3>Abstract</h3>
      <p>The Banking System manages customer information, account records, transactions and customer-account relationships using hash maps, a queue, a vector and graph-based relationship mapping. It supports account creation, deposits, withdrawals, transaction processing and transaction history. The design is ready for future database integration.</p>
      <h3>Objectives</h3>
      <ul><li>Fast account lookup</li><li>Efficient transaction processing</li><li>Maintain transaction history</li><li>Model customer-account relationships</li><li>Enable future database integration</li></ul>
      <h3>Design flow (Figure 3.1)</h3>
      <div class="flow"><div class="fbox">Customer</div><span class="farrow">→</span><div class="fbox">Account</div><span class="farrow">→</span><div class="fbox">Transaction processing</div><span class="farrow">→</span><div class="fbox">Transaction history</div></div>
      <h3>System architecture (Figure 3.2)</h3>
      <div class="arch">
        <div class="core full">Banking System Core</div>
        <div class="ds">Customer and account records<br>(hash map)</div><div class="ds">Transaction queue<br>(queue)</div><div class="ds">Transaction history<br>(vector)</div><div class="ds">Customer-account mapping<br>(graph)</div>
        <div class="op">Deposit / withdrawal</div><div class="op">Balance inquiry</div><div class="op">Transaction history view</div><div class="op">Relationship lookup</div>
        <div class="future full">Future: database integration (MySQL). This page already isolates storage in js/storage.js.</div>
      </div>
      <h3>Algorithm</h3>
      <ol><li>Create customer</li><li>Create account</li><li>Perform deposit or withdrawal</li><li>Store transaction (queue)</li><li>Update transaction history (vector)</li><li>Display information</li></ol>
      <h3>Design constraints and solutions (Table 3.2)</h3>
      <div class="scroll"><table><thead><tr><th>Constraint</th><th>Solution adopted</th></tr></thead><tbody>
        <tr><td>Limited memory usage</td><td>Compact hash-based structures instead of nested arrays</td></tr>
        <tr><td>Fast execution</td><td>O(1) average-time structures (hash map, queue)</td></tr>
        <tr><td>Data consistency</td><td>Centralized update through single account and customer maps</td></tr>
        <tr><td>Scalability</td><td>Modular design allows future MySQL integration</td></tr></tbody></table></div>
      <h3>Tools</h3>
      <p>The report's program was built in C++ with Visual Studio Code and the MSYS2 GCC compiler. This website is the same design written in JavaScript so it can run on Vercel.</p>
    </div>`;
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

/* ---------- Actions ---------- */
function addCustomer() {
  act(() => { const id = bank.addCustomer($("cName").value); $("cName").value = ""; pending.c = id; mode = "acct"; return `Customer ${id} added. Now open an account for them.`; });
}
function addAccount() {
  act(() => {
    const id = bank.openAccount(Number($("aCustomer").value), $("aInitial").value);
    pending.a = id; selected = id; filter = String(id); mode = "tx"; return `Account ${id} opened. You can make a transaction now.`;
  });
}
function submitTx() {
  act(() => {
    bank.submit(txType, Number($("tAccount").value), $("tAmount").value, txType === "transfer" ? Number($("tTo").value) : null);
    $("tAmount").value = "";
    if ($("queueOnly").checked) { tab = "queue"; return "Added to the queue. Process it from the Queue tab."; }
    const r = bank.processAll().pop(); tab = "history";
    if (r.status !== "success") throw new Error("Failed: " + r.note);
    return `${typeLabel(r.type)} completed. New balance: ${fmt(r.balanceAfter)}`;
  });
}

/* ---------- Events ---------- */
document.addEventListener("click", e => {
  const t = e.target;
  const m = t.closest("#modeSeg button"); if (m) { mode = m.dataset.mode; return render(); }
  const ty = t.closest("#typeSeg button"); if (ty) { txType = ty.dataset.type; return render(); }
  const chip = t.closest("[data-chip]"); if (chip) { $("tAmount").value = (Number($("tAmount").value) || 0) + Number(chip.dataset.chip); return preview(); }
  const tb = t.closest(".tabs button"); if (tb) { tab = tb.dataset.tab; return render(); }
  const cl = t.closest("[data-close]");
  if (cl) { const id = Number(cl.dataset.close); if (confirm(`Close account ${id}?`)) act(() => { bank.closeAccount(id); if (selected === id) { selected = null; filter = "all"; } return "Account closed."; }); return; }
  const ac = t.closest("[data-acct]"); if (ac) return selectAccount(Number(ac.dataset.acct));
  if (t.id === "addCustomer") return addCustomer();
  if (t.id === "addAccount") return addAccount();
  if (t.id === "submitTx") return submitTx();
  if (t.id === "exportCsv") return exportCsv();
  if (t.id === "procOne") return act(() => { const r = bank.processNext(); tab = "history"; return r ? (r.status === "success" ? "Processed 1 transaction." : "Failed: " + r.note) : "The queue is empty."; });
  if (t.id === "procAll") return act(() => { const r = bank.processAll(); tab = "history"; return r.length ? `Processed ${r.length} transaction(s).` : "The queue is empty."; });
  if (t.id === "reset" && confirm("Reset all data to the demo?")) { bank = Bank.demo(); filter = "all"; selected = null; mode = "tx"; conReset(); render(); toast("Demo data restored."); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const id = e.target.id;
  if (id === "conIn" && e.key === "Enter") { conRun(e.target.value); render(); $("conIn").focus(); }
  else if (id === "tAmount" && e.key === "Enter") submitTx();
  else if (id === "cName" && e.key === "Enter") addCustomer();
  else if (id === "aInitial" && e.key === "Enter") addAccount();
  else if (e.target.dataset && e.target.dataset.acct) { e.preventDefault(); selectAccount(Number(e.target.dataset.acct)); }
});
document.addEventListener("change", e => {
  if (e.target.id === "hFilter") { filter = e.target.value; render(); }
  if (e.target.id === "tAccount") preview();
});
document.addEventListener("input", e => { if (e.target.id === "tAmount") preview(); });

render();
