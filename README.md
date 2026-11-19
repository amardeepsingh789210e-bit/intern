# Banking System with Advanced Data Structures (Frontend)

A complete frontend-only project based on the report "Banking System with Database Integration Using Advanced Data Structures". No backend, no database, no build step, no dependencies.

## Run locally
Open `index.html` in any browser. Or run `npx serve .` and open the address it prints.

## Deploy on Vercel
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
js/ui.js        screen rendering and events
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
- Add customers, open and close accounts
- Deposit, withdraw and transfer between accounts
- Transaction queue with "Process next" and "Process all"
- Transaction history with account filter and CSV export
- Customer-to-account mapping view
- Live view of every data structure
- Built-in test cases (the report's Table 4.1 plus extra checks) that you can run from the page
- Data is kept in the browser (localStorage) so it survives a refresh; there is no server

## Demo data
Customer 1, account 101 starts at 6000, then +500 and -200 gives 6300, matching Table 4.1.
