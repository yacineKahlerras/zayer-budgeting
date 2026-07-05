# Zayer Budgeting — Test Plan

This document is the contract for the app's automated test suite: what exists,
what must be verified, how the suite is layered, and where each behavior is
covered. The suite has three layers:

1. **Unit tests** — pure functions (formatting, CSV parsing, grouping).
2. **Integration tests** — the real data layer (Drizzle queries) running
   against a real in-memory SQLite database built from the actual migration
   files, so schema drift breaks tests.
3. **Component tests** — screens and shared UI rendered with
   `@testing-library/react-native`, driving real state + the real data layer.
4. **Device E2E** — Maestro flows tapping through the installed dev build on
   an emulator (`e2e/flows/*.yaml`).

## Requirements

- **R1. No production code changes for testability** unless a defect is found;
  tests adapt to the app, not vice-versa.
- **R2. Data-layer tests run the real migrations** (`drizzle/*.sql`) so the
  test schema can never drift from the shipped schema.
- **R3. Deterministic** — no reliance on wall-clock "today" except where the
  code itself uses it; those tests construct anchors explicitly.
- **R4. Money in minor units everywhere** — every assertion on amounts is in
  cents; display formatting is asserted separately.
- **R5. Fast** — the unit+integration+component suite must run in seconds via
  `npm test`; device E2E is a separate opt-in (`npm run e2e`).
- **R6. Every feature in the inventory below maps to at least one test**, and
  every known regression from development history gets a dedicated test:
  - stale-closure period swipe (stepped by month while on Day),
  - imported subcategory names duplicating as categories,
  - budgets with required `subcategoryId`/`period` fields,
  - last-wallet delete guard,
  - falsy/legacy rows (transaction with only `subcategoryId`).

## Feature inventory (what the app does)

### Data layer (`db/`)
- **Schema + migrations**: wallets, categories, subcategories, transactions,
  budgets; FKs: tx→wallet CASCADE, tx→subcategory SET NULL, tx→category SET
  NULL, subs→category CASCADE, budgets→category CASCADE,
  budgets→subcategory CASCADE.
- **First-run defaults** (`defaults.ts`): 1 wallet + 7 categories with subs;
  idempotent (only when no categories).
- **Repair** (`absorbDuplicateCategories`): a leaf category whose name matches
  another category's subcategory (same kind, case-insensitive) is absorbed —
  transactions + budgets retargeted, duplicate deleted; idempotent.
- **Wallets**: list (active, sorted), list with derived balances
  (initial + income − expense in one query), add (sortOrder appended), update,
  delete (cascades transactions; refuses deleting the last wallet), get.
- **Categories**: tree (optionally by kind, sorted, subs attached), add,
  rename (icon untouched), delete (subs cascade; transactions keep history via
  SET NULL), subcategory add/rename/delete.
- **Transactions**: add/update/delete/get; list page (newest first,
  LIMIT/OFFSET, display fallback title = title > sub name > category name >
  direction label; categoryName fallback "Uncategorized"; signed amounts);
  effective-category join (subcategory's parent wins over stored categoryId).
- **Stats**: `periodRange` day/week(Mon-start)/month/year; `getPeriodSummary`
  income/expense/net per wallet+window; `getCategoryBreakdown` expense-only,
  grouped by effective top-level category, uncategorized folded, sorted desc,
  zero-amount slices dropped.
- **Budgets**: input requires categoryId/subcategoryId/period/currency;
  `budgetPeriodLabel`; `listBudgetsWithProgress` — per-budget window
  (day/month/year + legacy week/custom), spend matched by wallet currency,
  category scope, subcategory scope; union-window single fetch; remaining can
  go negative; empty-budget early return.
- **Search**: case-insensitive LIKE over title/note/sub/category names,
  `%`/`_` stripped from the term, empty query = recent list, paginated.
- **Export rows**: every transaction joined with wallet/category/subcategory,
  newest first.
- **Import resolution**: `getOrCreateWallet` (name case-insensitive AND
  currency exact), `resolveImportCategory` (subcategory match first — same
  kind; then category match; else create).

### Utils (`utils/`)
- **format.ts**: `monthShort` (+out-of-range), `currencySymbol` (known map +
  `$` fallback), `formatCents` (grouping, 2 decimals, magnitude only),
  `toCents` (blank/garbage/negative → 0, rounding), `balancesByCurrency`
  (grouped, sorted by |balance| then code).
- **import.ts**: delimiter detection (`;` vs `,`), quoted-field splitting
  (embedded delimiter, escaped quotes), date parsing ("YYYY-MM-DD HH:MM:SS",
  date-only, ISO fallback, garbage → null), `toCentsAbs`, header alias
  resolution, `parseCsv` (skip unparsable rows, direction from type column
  with amount-sign fallback, wallet labels), `importRows` (wallet/category
  caching, subcategory tagging, insert count).
- **export.ts**: `csvField` quoting via `toCsv` output (commas, quotes,
  newlines), signed decimal amounts, header row, ISO dates.
- **group-transactions.ts**: day sections, month banners only on month
  change, order preserved.
- **category-icon.tsx**: known names map, unknown/null → Tag.

### Screens & components
- **Home**: balance header (name pill, derived balance, month in/out glance),
  wallet switcher dialog (opens with >1 wallets), transaction list grouped by
  day, FAB → add-transaction with preset wallet.
- **Add/edit transaction**: amount input (currency symbol, sanitizing),
  expense/income toggle (clears category selection), wallet row → wallet
  dialog (opens even with 1 wallet, switching updates currency), category
  picker (collapsed by default; summary shows selection; expand; category
  select opens its subs; sub refine/toggle-off; direction switch resets;
  edit mode opens expanded pre-selected), More options (title, memo, date
  picker, prefilled in edit), save validation (amount > 0, wallet required),
  create vs update vs delete.
- **Stats**: single-wallet scope via centered dialog; Day/Week/Month/Year
  segmented control (period switch snaps anchor to now); range label
  ("Today", "Jul 2026", week span, year); stepper chevrons page with slide
  animation; swipe left/right pages periods with animation, forward clamped
  at current period (rubber-band); summary card; breakdown views
  (bars/donut/ranked list) behind options modal; centered empty state.
- **Budgets list**: cards show most-specific scope name, meta line (parent
  category when subcategory-scoped · period · currency), progress bar color
  (accent → amber >85% → red over), "left"/"over" amounts, empty state.
- **Edit budget**: period Day/Month/Year (label "Daily/Monthly/Yearly
  limit"), currency chips above scope, scope picker (collapsed summary; rows
  with Overall first; category rows unfold subs; sub refine; edit opens
  expanded), save/update/delete.
- **Wallets tab + edit wallet**: list with balances; create (name required,
  currency chips incl. DZD…, starting balance), edit prefill, delete
  confirm + last-wallet error surfaced.
- **Categories + edit category**: manage list; create with staged subs
  (unique staged ids), edit (rename; sub add/remove persists immediately),
  delete warning.
- **Search**: query → filtered list, empty query recent.
- **Settings**: Categories / Import / Export / Sample data rows.
- **Import screen**: pick CSV → preview count + wallets → import → success
  alert; double-tap guard; honest re-import copy.

## Test matrix → file map

| Area | Cases | File |
|---|---|---|
| format.ts | 18 | `__tests__/unit/format.test.ts` |
| import parsing | 22 | `__tests__/unit/import-parse.test.ts` |
| export CSV | 8 | `__tests__/unit/export-csv.test.ts` |
| group-transactions | 6 | `__tests__/unit/group-transactions.test.ts` |
| category-icon | 3 | `__tests__/unit/category-icon.test.ts` |
| migrations/defaults/repair | 10 | `__tests__/db/bootstrap.test.ts` |
| wallets queries | 12 | `__tests__/db/wallets.test.ts` |
| categories queries | 10 | `__tests__/db/categories.test.ts` |
| transactions queries | 14 | `__tests__/db/transactions.test.ts` |
| stats queries | 16 | `__tests__/db/stats.test.ts` |
| budgets progress | 16 | `__tests__/db/budgets.test.ts` |
| search + export rows | 10 | `__tests__/db/search-export.test.ts` |
| import resolution + importRows | 12 | `__tests__/db/import.test.ts` |
| shared UI (chip, segmented, amount, delete-row, modal-header) | 12 | `__tests__/components/ui.test.tsx` |
| wallet picker dialog | 6 | `__tests__/components/wallet-picker.test.tsx` |
| add-transaction flow | 12 | `__tests__/components/add-transaction.test.tsx` |
| edit-budget flow | 10 | `__tests__/components/edit-budget.test.tsx` |
| stats helpers via screen | 6 | `__tests__/components/stats.test.tsx` |
| E2E device flows | 8 flows | `e2e/flows/*.yaml` |

## Phases

- **Phase 0 — Infrastructure**: jest-expo + RNTL + better-sqlite3; global
  mock of `@/db/client` to an in-memory DB built from the real migrations;
  mocks for expo/native modules; `npm test` script.
- **Phase 1 — Unit tests** (pure functions, no DB).
- **Phase 2 — Data-layer integration tests** (real SQLite).
- **Phase 3 — Component tests** (RNTL over real data layer).
- **Phase 4 — Device E2E** (Maestro flows against the dev build; documented
  runner; core flows executed on the emulator).
- **Phase 5 — Wrap-up**: full suite green, scripts, docs, commit.

## Running

```bash
npm test          # unit + integration + component (Jest)
npm run e2e       # Maestro device flows (emulator + Metro must be running)
npm run apk       # build a standalone release APK → dist/ (see below)
```

### Building the APK (`npm run apk`)

`scripts/build-apk.mjs` produces a standalone release APK (JS bundled in, no
Metro) at `dist/Zayer-<version>-release.apk`. It builds from a short path
(`C:\zb`) because `react-native-keyboard-controller`'s New-Arch C++ codegen
exceeds Windows' 260-char path limit in the real project dir.

- `npm run apk` — full build: sync source → `npm install` → `expo prebuild
  --clean` (regenerates the app icon + name from `app.json`) → gradle → copy
  to `dist/`.
- `npm run apk -- --fast` — skips `expo prebuild`. Use when only JS/TS
  changed; do NOT use after editing `app.json`, the icon, or `assets/`.
- `npm run apk -- --no-deps` — skips `npm install` in the build copy.

Requires Windows, JDK 17 (Android Studio's JBR), and the Android SDK/NDK. Edit
the `BUILD_DIR` / `JAVA_HOME` / `SDK_DIR` constants at the top of the script if
your machine differs. Signed with the debug keystore — fine for sideloading,
not for the Play Store.

See `e2e/README.md` for the Maestro CLI setup.

## Status

- Jest: **18 suites / 184 tests passing** (unit 45, data layer 97,
  components 42), ~15 s.
- Maestro: **8/8 flows passing** on the Pixel 7 emulator against the dev
  build (~10 min).
- Found by this suite and fixed: migrations 0001/0002 added
  `transactions.category_id` / `budgets.subcategory_id` without their
  `ON DELETE` actions, so deleting a category with categorized transactions
  (or a subcategory with scoped budgets) threw `FOREIGN KEY constraint
  failed` on device. Migration `0003_fix_fk_actions` rebuilds both tables
  with the schema-declared actions, preserving data.
