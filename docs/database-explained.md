# The Database Layer, Explained

A teaching document for understanding the local-storage / database setup in this
app. The goal is for **you** to understand it well enough to extend, debug, and
make these decisions yourself — not to memorize what was generated.

Read this top-to-bottom once. Then keep it as a reference. Every section ends
with **"Go learn this properly"** links to primary sources.

---

## 0. The big picture: what problem are we solving?

The app needs to **remember data between launches** — wallets, transactions,
budgets. When you close the app and reopen it, that data must still be there.

A phone app can't use a web browser's `localStorage`. React Native gives us a
few options for on-device persistence. We chose a **local SQL database**
(SQLite) accessed through a **typed query library** (Drizzle).

So there are three layers, bottom to top:

```
┌─────────────────────────────────────────────┐
│  Your React screens  (index.tsx, stats, …)   │  ← calls functions like getTransactions()
├─────────────────────────────────────────────┤
│  Drizzle ORM         (db/schema.ts, queries) │  ← turns TS into SQL, gives you types
├─────────────────────────────────────────────┤
│  expo-sqlite         (native module)         │  ← the actual SQLite engine on the device
├─────────────────────────────────────────────┤
│  budget.db           (a file on the phone)   │  ← your data, physically stored
└─────────────────────────────────────────────┘
```

Understanding this stack *is* the lesson. Let's go layer by layer.

---

## 1. SQLite — the database engine

### What it is
SQLite is a **relational database** that runs as a library inside your app, not
as a separate server. There's no "database server" to start; the entire database
is a single file (`budget.db`) on the device. It's the most deployed database in
the world — it's inside your phone, your browser, your car.

### "Relational" — what that actually means
Data lives in **tables** (like spreadsheets). Each table has **columns**
(fields) and **rows** (records). Tables can **reference** each other — that's the
"relational" part.

Example: a `transactions` table has a `wallet_id` column that points at a row in
the `wallets` table. That pointer is called a **foreign key**. It's how we say
"this transaction belongs to that wallet" without copying the wallet's data into
every transaction.

### Why a database instead of just a JSON file?
We *could* store everything as one big JSON blob (with AsyncStorage). The problem
shows up when data grows:

- "Show me June's transactions" with JSON → load **all** transactions into
  memory, loop through them in JavaScript, filter by date.
- Same thing with SQL → `SELECT * FROM transactions WHERE date >= ... LIMIT 20`.
  The database does the filtering, returns only what you need, and it's fast even
  with 50,000 rows.

A database gives you **querying, filtering, sorting, aggregating (SUM/GROUP BY),
and pagination** for free, computed efficiently. For a list that grows forever
(transactions), that's the whole ballgame.

### The trade-off
You have to **define a schema** (the shape of your tables) up front, and you
interact via SQL instead of plain object access. That's more ceremony than
`JSON.stringify`. In return you get correctness and speed at scale.

### Go learn this properly
- SQLite intro: https://www.sqlite.org/about.html
- **SQL basics (do this — it's the real fundamental):** https://sqlbolt.com
  (interactive, ~2 hours, teaches SELECT/WHERE/JOIN/GROUP BY hands-on)
- Relational model: search "database normalization explained"

---

## 2. expo-sqlite — the bridge to the engine

React Native is JavaScript. SQLite is C. **expo-sqlite** is the native module
that lets your JS code talk to the SQLite engine bundled with the app. It's the
Expo-maintained, SDK-compatible way to open and run a SQLite database on iOS,
Android, and web.

You rarely call expo-sqlite directly in this project — Drizzle sits on top of it.
But it's the thing doing the real work: `openDatabaseAsync("budget.db")` creates
or opens the file, and runs the SQL we hand it.

### Why this specific package?
Because Expo controls the native build. Using a random RN SQLite library can
break in Expo Go or require a custom native build. `expo-sqlite` is guaranteed to
work with our Expo SDK (54). That's why we installed it with `npx expo install`
(which picks the version matching our SDK) instead of plain `npm install`.

### Go learn this properly
- https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/  (always the **versioned**
  docs — Expo changes APIs between versions; this repo's AGENTS.md insists on it)

---

## 3. Drizzle ORM — typed queries instead of raw SQL strings

### What an "ORM" is
ORM = Object-Relational Mapper. It maps database rows ↔ programming-language
objects. Instead of writing SQL strings by hand and parsing raw results, you
write code in your language and the ORM generates the SQL.

Without an ORM:
```ts
const rows = await db.getAllAsync(
  "SELECT * FROM transactions WHERE wallet_id = ? ORDER BY date DESC",
  [walletId]
);
// rows is `any[]` — TypeScript has no idea what's in it
```

With Drizzle:
```ts
const rows = await db
  .select()
  .from(transactions)
  .where(eq(transactions.walletId, walletId))
  .orderBy(desc(transactions.date));
// rows is fully typed: Transaction[] — autocomplete on every field
```

### Why we chose Drizzle specifically
There are several RN ORMs (Drizzle, WatermelonDB, Prisma-ish tools). We picked
Drizzle because:

1. **It's thin.** Drizzle is "just" a typed SQL builder. It doesn't hide SQL from
   you — the code reads almost exactly like the SQL it generates. That means
   learning Drizzle *also teaches you SQL*, instead of hiding it.
2. **Types come from one source.** You define each table once in `db/schema.ts`,
   and Drizzle *infers* the TypeScript types (`Transaction`, `NewWallet`, …).
   Change a column, and every query using it updates its types automatically. No
   drift between "what the DB has" and "what TS thinks it has".
3. **First-class Expo support.** It has an official `drizzle-orm/expo-sqlite`
   driver and a migrations runner built for Expo.

### The trade-off
Another dependency, and a small learning curve for its query syntax. The
alternative (raw `expo-sqlite`) is one fewer library but gives you `any`-typed
results and hand-written SQL strings that can have typos SQL won't catch until
runtime. For an app you want to grow, the type safety is worth it. For a
throwaway prototype, raw SQL would be fine.

### Go learn this properly
- Drizzle + Expo guide: https://orm.drizzle.team/docs/get-started/expo-new
- Drizzle query basics: https://orm.drizzle.team/docs/select

---

## 4. The schema — `db/schema.ts`

This file is the **single source of truth** for the shape of our data. Every
table, column, type, and relationship is declared here. Drizzle reads it to (a)
generate the SQL that creates the tables, and (b) generate the TypeScript types.

Our 5 tables and *why each exists*:

| Table | Holds | Why separate |
|---|---|---|
| `wallets` | accounts (Cash, Travel) | money lives in distinct wallets, each with its own currency |
| `categories` | top-level groups (Food, Housing) | level 1 of the category hierarchy |
| `subcategories` | leaves (Groceries, Restaurant) | level 2; a transaction is tagged here |
| `transactions` | every income/expense entry | the core data; everything else describes these |
| `budgets` | spending limits | rules applied *over* transactions |

### Key design decisions (these are the interesting part)

#### Decision 1: Money is stored as **integer cents**, not decimals
`$12.34` is stored as the integer `1234`, not the float `12.34`.

**Why:** floating-point numbers can't represent some decimals exactly. The
classic example: `0.1 + 0.2 === 0.30000000000000004` in basically every
language. For money, those tiny errors accumulate across thousands of sums and
you get wrong totals. Storing whole cents (integers) sidesteps it entirely —
integers are exact. We divide by 100 only when *displaying*.

**This is a real-world finance convention**, not a quirk. Stripe, banks, etc. all
store minor units.

**Trade-off:** every read/write has to remember the ×100 / ÷100. We isolate that
in formatting helpers so it's not scattered everywhere.

#### Decision 2: A wallet's balance is **derived, not stored**
There is no `balance` column on `wallets`. The balance is computed:
`initialBalance + SUM(income) − SUM(expense)`.

**Why:** if we stored a `balance` number, *every* insert/edit/delete of a
transaction would have to update it too. Miss one path (an error, a crash
mid-write) and the stored balance silently disagrees with the transactions.
That's a "source of truth" bug — now you have two numbers that should match but
don't, and no way to know which is right. Deriving it means there's **one** source
of truth (the transactions) and the balance is *always* correct by construction.

**Trade-off:** you run a `SUM` query to get a balance instead of reading a field.
In SQLite that's cheap (milliseconds even with lots of rows), and we can add an
index to make it faster. This is the right default; you'd only cache a stored
balance if profiling proved the SUM was too slow (it won't be, for a personal
budgeting app).

This is a recurring principle: **don't store what you can derive.** Derived data
can't drift.

#### Decision 3: Two category tables, not a self-referencing tree
We have `categories` and `subcategories` as two tables. We *could* have made one
table that references itself (a row's `parent_id` points to another row in the
same table) to allow infinite nesting.

**Why we didn't:** you said you want exactly **two levels** (Food → Groceries).
Two fixed tables are simpler to query, simpler to render, and impossible to mess
up (you can't accidentally create a 5-deep chain). A self-referencing tree is
more flexible but needs recursive queries and more careful UI.

**Trade-off:** if you later want 3+ levels, you'd have to migrate to the
self-referencing design. We judged that unlikely enough to favor the simpler
model now. (This is a classic YAGNI call — "You Aren't Gonna Need It".)

#### Decision 4: `amount` + `direction` instead of signed numbers
A transaction stores a **positive** `amount` (e.g. `1234`) plus a `direction`
that's either `"expense"` or `"income"`. We do *not* store `-1234` for expenses.

**Why:** "total spent this month" becomes
`SUM(amount) WHERE direction = 'expense'` — clean and unambiguous. With signed
numbers you'd write `SUM(amount) WHERE amount < 0` and then negate, and you have
to be careful everywhere about signs. Separating magnitude from direction makes
the intent explicit and the queries simpler.

**Trade-off:** two columns instead of one. Minor.

#### Decision 5: Deleting a subcategory **keeps** the transactions
The foreign key from `transactions.subcategory_id` uses `ON DELETE SET NULL`.
When you delete the "Groceries" subcategory, transactions that used it don't get
deleted — their `subcategory_id` becomes `NULL` (uncategorized).

**Why:** the transaction *happened*. The money moved. Losing financial history
because you reorganized your categories would be terrible. We preserve the record
and just drop the label.

Compare with the wallet FK, which uses `ON DELETE CASCADE`: if you delete a
wallet, its transactions *are* deleted — because a transaction with no wallet is
meaningless (where did the money come from?). **The delete behavior encodes what
the relationship means.**

#### Decision 6: One flexible `budgets` table for all budget types
You wanted per-category, per-wallet, custom-period, and overall-cap budgets. We
have **one** table with nullable `category_id` and `wallet_id`:

- `category_id` set, `wallet_id` null → category budget
- `wallet_id` set, `category_id` null → wallet budget
- both null → overall cap
- `period` column → week/month/year/custom

**Why:** the alternative is 3–4 nearly-identical tables. One table with nullable
scope columns is less duplication.

**Trade-off — and this is an honest weakness:** the database can't *enforce* "only
one of category_id/wallet_id is set." Nothing in SQLite stops a bad row with
both set. We enforce that rule in *application code* instead. A stricter design
would add a `CHECK` constraint. We accept the looser version for simplicity, but
**you should know this is where a bug could hide** if the app logic is wrong.

### Go learn this properly
- Foreign keys & ON DELETE: https://www.sqlite.org/foreignkeys.html
- Why money isn't a float: search "floating point money is bad" (the 0.1+0.2 demo)
- YAGNI / over-engineering: Martin Fowler's "Yagni" article

---

## 5. Migrations — `drizzle/` and `drizzle-kit generate`

### The problem migrations solve
Your schema changes over time (add a column, a new table). But users already have
a `budget.db` file with the *old* shape and real data in it. You can't just
"redefine" the tables — you'd lose their data. You need a way to **evolve** an
existing database step by step. That's a **migration**.

### How it works here
1. You edit `db/schema.ts` (the desired shape).
2. You run `npm run db:generate` (which runs `drizzle-kit generate`).
3. Drizzle **diffs** your new schema against the previous snapshot and writes a
   new SQL file in `drizzle/` describing exactly what changed (the `CREATE TABLE`
   / `ALTER TABLE` statements).
4. At app startup, a migration runner applies any not-yet-applied migration files
   to the user's database, in order.

The `drizzle/` folder right now:
- `0000_massive_speedball.sql` — the human-readable SQL of our first migration
  (creates all 5 tables). The number `0000` is the order; the name is random and
  cosmetic.
- `migrations.js` — the bundled version the app actually imports (Expo can't read
  raw `.sql` files at runtime, so drizzle-kit packages them into JS).
- `meta/` — snapshots Drizzle uses to compute the *next* diff. Don't hand-edit.

### Editing or removing a migration
The rule hinges on **whether the migration has shipped to real users**:

- **Not shipped yet (our situation):** migrations are scratch work. Just edit
  `db/schema.ts`, delete the whole `drizzle/` folder (`rm -rf drizzle/`), and
  re-run `npm run db:generate` for a clean regenerate. If the app already created
  a `budget.db` on your simulator, delete the app/DB so it rebuilds. Safe because
  no real data exists.
  - ⚠️ Don't hand-delete a single `.sql` file while leaving `meta/` behind —
    Drizzle diffs against those snapshots, so they'd get out of sync and the next
    `generate` produces a broken diff. Nuke the whole folder instead.

- **Already shipped:** you do **not** remove a migration. Users already ran it.
  Instead you add a *new* migration that reverses the change (e.g. an
  `ALTER TABLE ... DROP COLUMN`). History stays append-only — exactly like git
  commits on a shared branch: once pushed, you don't rewrite history, you add a
  new commit that undoes the bad one.

### Why this matters
Migrations are how real apps ship database changes without nuking user data. The
first migration just builds the tables. The tenth might add an `icon` column to
budgets. Each user's app applies whichever ones they haven't run yet.

### Go learn this properly
- Drizzle migrations: https://orm.drizzle.team/docs/migrations
- Concept (framework-agnostic): search "database schema migrations explained"

---

## 6. What's NOT built yet (and why we stopped here)

You asked to review the schema before going further. So right now there is:
- ✅ the schema (`db/schema.ts`)
- ✅ the migration files (`drizzle/`)
- ✅ the tooling config (`drizzle.config.ts`, package scripts)

There is **not yet**:
- ❌ a `db/client.ts` that opens the DB and runs migrations on startup
- ❌ a seed (the default categories/subcategories, sample wallets)
- ❌ query functions the UI calls (`getTransactionsPage`, `addTransaction`, stats)
- ❌ any UI (add-transaction form, stats tab)

Nothing touches the running app yet. The database file isn't even created until
the client code runs. This is a safe checkpoint to learn from and to change the
schema cheaply (no real data exists to migrate).

---

## 7. A suggested learning path (in order)

If you want to genuinely own this, do these in sequence. Total maybe a weekend.

1. **SQL fundamentals** — https://sqlbolt.com (interactive). Non-negotiable; SQL
   is the actual skill under everything here. Learn SELECT, WHERE, JOIN, GROUP
   BY, ORDER BY, LIMIT/OFFSET.
2. **Relational modeling** — read about tables, primary keys, foreign keys, and
   "normalization" (why we split categories/subcategories/transactions instead of
   one giant table).
3. **Why money is integers** — read one article on floating-point money. It'll
   stick because the 0.1+0.2 demo is memorable.
4. **expo-sqlite** — skim the versioned Expo docs; run their tiny example.
5. **Drizzle** — do the official Expo quickstart; it mirrors what's in this repo.
6. **Migrations** — read the Drizzle migrations page; then change a column in
   `schema.ts`, run `npm run db:generate`, and *read the diff it produces*. That
   single exercise teaches migrations better than any article.

### A great exercise to prove you understand it
Without AI: add a `tags` column to `transactions` (a comma-separated string),
regenerate the migration, and read the SQL it produced. If you can explain what
the generated migration does and why, you understand the system.

---

## 8. Glossary (quick reference)

- **Schema** — the defined shape of your tables (columns, types, relationships).
- **Table / row / column** — spreadsheet-like: table = sheet, row = record,
  column = field.
- **Primary key** — the column that uniquely identifies a row (our `id`).
- **Foreign key** — a column pointing at another table's primary key (the
  "relation").
- **ON DELETE CASCADE / SET NULL** — what happens to child rows when the parent is
  deleted (delete them / null-out the link).
- **ORM** — library mapping rows ↔ objects, generating SQL for you (Drizzle).
- **Migration** — a versioned script that evolves an existing database's shape.
- **Minor units** — the smallest currency unit (cents); how we store money.
- **Derived data** — values computed from other data (wallet balance) rather than
  stored.
- **YAGNI** — "You Aren't Gonna Need It"; don't build flexibility you don't need
  yet (why we chose 2 fixed category levels).
```
