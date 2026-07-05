# Device E2E (Maestro)

YAML flows that drive the installed dev build on an Android emulator.

## Prerequisites

1. **Maestro CLI** — download `maestro.zip` from
   https://github.com/mobile-dev-inc/maestro/releases, extract, and put
   `maestro/bin` on your PATH. Needs Java 17+ (Android Studio's JBR works:
   set `JAVA_HOME` to `C:\Program Files\Android\Android Studio\jbr`).
2. **Emulator running** with the dev build installed
   (`com.yacinekahlerras.ZayerBudgeting`).
3. **Metro running**: `npx expo start --dev-client --port 8081`
   (the dev build loads its JS from Metro).
4. The flows assume the app has data (the BudgetBakers import): wallets
   `Cash·DZD`, `usd·USD`, `euro·EUR` and the default categories.

## Run

```bash
npm run e2e            # all flows
maestro test e2e/flows/02-add-transaction.yaml   # a single flow
```

Debug artifacts (screenshots, logs, per-command status) land in
`~/.maestro/tests/<timestamp>/` on failure.

## Flows

| Flow | What it proves |
|---|---|
| 01-home | App boots, balance header + transaction list render |
| 02-add-transaction | Full create: amount → collapsed category picker → subcategory → save → appears on home |
| 03-wallet-dialog | Wallet row opens the Switch-wallet dialog; switching updates row + currency |
| 04-stats | Day/Week/Month/Year filters, Today label, summary card, wallet dialog from the pill |
| 05-budgets | Create a yearly USD Housing budget through the collapsed scope picker; card + meta line |
| 06-search | Search finds transactions by category text |
| 07-wallets-tab | Wallets tab lists all wallets with currencies |
| 08-categories | Settings → Categories renders the tree (scrolls to Income) |

## Notes

- Flows dismiss the RN dev toast ("Open debugger to view warnings.") when
  present — it overlays the tab bar and would swallow taps.
- Point taps (FAB, gear, +) are percentage-based for a 1080×2400 portrait
  device profile (Pixel 7).
- Flows add real data to the dev database (a transaction, a budget) on every
  run; that is acceptable for the dev device profile they target.
