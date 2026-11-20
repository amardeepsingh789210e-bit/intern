# Banking System with Advanced Data Structures (Frontend)

A complete frontend-only project based on the report "Banking System with Database Integration Using Advanced Data Structures". No backend, no database, no build step, no dependencies.

## Run locally
Open `index.html` in any browser. Or run `npx serve .` and open the address it prints.

## Deploy on Vercel
Important: `index.html` must be at the top level of what you upload. Unzip first, then upload the files inside, not the zip itself.

1. Go to https://vercel.com/new and sign in.
2. Upload this folder (or push it to GitHub and import the repo).
3. Framework Preset: **Other**. Leave build command and output directory empty.
4. Click **Deploy**.

CLI alternative: `npm i -g vercel`, then `vercel --prod` inside this folder.

## Project structure
```
index.html      page layout
css/style.css   styles (light and dark mode)
js/ds.js        data structures: Queue, Graph
js/bank.js      banking logic (customers, accounts, transactions, built-in tests)
js/storage.js   storage layer (the report's "database layer", localStorage for now)
js/ui.js        screen rendering, console menu, report tab
vercel.json     Vercel config
```

## Data structures (from the report)
| Structure | Used for | Complexity |
|---|---|---|
| Map (hash map) | Customer and account lookup | O(1) average |
| Queue | Transaction processing order | O(1) enqueue and dequeue |
| Array (vector) | Transaction history | O(1) append, O(n) search |
| Graph (map of lists) | Customer to accounts | O(1) average lookup |

## Features
- Guided flow: add a customer, open an account, then make transactions
- Add customers, open and close accounts
- Deposit, withdraw and transfer between accounts, with a live "balance after" preview
- Transaction queue with "Process next" and "Process all"
- Transaction history with account filter and CSV export
- Customer-to-account mapping view
- Live view of every data structure
- Console menu that works like the report's bank.exe (Show Balance, Transaction History, Customer Mapping, Exit)
- Project report tab: abstract, objectives, design flow, architecture, algorithm, constraints
- Built-in test cases (the report's Table 4.1 plus extra checks) that you can run from the page
- Data is kept in the browser (localStorage) so it survives a refresh; there is no server

## Demo data
Customer 1, account 101 starts at 6000, then +500 and -200 gives 6300, matching Table 4.1.
