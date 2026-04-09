# Anonymous Airdrop App — Design Spec

## Summary

A standalone web app for distributing ERC-20 tokens privately via the Starknet Privacy SDK. An admin loads a recipient list, executes a one-click airdrop (deposit into pool + batch private transfers), and recipients discover and withdraw their tokens. The admin-to-recipient link is cryptographically hidden inside the privacy pool.

## Decisions

| Decision | Choice |
|---|---|
| Distribution model | Admin-push (admin sends, claimants discover + withdraw) |
| Recipient list source | Pre-loaded from config + editable in UI |
| Token support | Single token (configurable) |
| App structure | One app, two views (admin panel + claimant panel) |
| Execution model | One-click (deposit + transfers automated) |
| Batching strategy | Smart batching (batch where possible, fallback to individual) |
| Channel management | Automatic via SDK `autoSetup: true` |
| Architecture | Standalone app in `apps/airdrop/`, copies minimal boilerplate from demo |

## Project Structure

```
apps/airdrop/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env
├── .env.example
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── config.ts
    ├── starknet.ts
    ├── proof-provider.ts
    │
    ├── components/
    │   ├── AdminPanel.tsx
    │   ├── ClaimantPanel.tsx
    │   ├── RecipientList.tsx
    │   ├── AirdropProgress.tsx
    │   └── StatusBar.tsx
    │
    └── hooks/
        ├── useAirdrop.ts
        ├── useClaimant.ts
        └── useAccounts.ts
```

### Dependencies

- `react`, `react-dom` (^19.1.0)
- `starknet` (same fork as demo: `github:starkware-libs/starknet.js#PRIVACY-0.14.2-RC.2`)
- `starknet-sdk` (`file:../../sdk`)
- `vite`, `@vitejs/plugin-react`, `typescript` (dev)

### Shared Boilerplate (Copied from Demo)

Three files adapted from `demo/src/`:
- `starknet.ts` — `createProvider`, `createAccount`, `createTransfers`, `getErc20Balance`
- `config.ts` — env var parsing, accounts JSON parsing
- `proof-provider.ts` — proving service wrapper

These are copied, not shared as a library. The duplication is ~100 lines and avoids coupling to the demo.

## App Routing

`App.tsx` detects whether the connected account has the `admin: true` flag in the accounts config. If admin, render `AdminPanel`. Otherwise, render `ClaimantPanel`. Account switching via a selector (same pattern as demo's `useAccounts`).

## Admin Flow

### useAirdrop Hook

Manages the full airdrop lifecycle: approve → deposit → wait for maturity → batch transfer.

**State:**

```typescript
type RecipientEntry = {
  address: string;
  amount: bigint;
  status: "pending" | "proving" | "submitted" | "confirmed" | "done" | "failed";
  error?: string;
};

type AirdropState =
  | { phase: "idle" }
  | { phase: "approving" }
  | { phase: "depositing" }
  | { phase: "waiting_maturity"; blocksRemaining: number }
  | { phase: "transferring"; mode: "batch" | "individual"; progress: number }
  | { phase: "complete"; succeeded: number; failed: number };
```

**Step 1: Approve.** Single `ERC-20.approve(pool, totalAmount)` call. `totalAmount` = sum of all recipient amounts.

**Step 2: Deposit.** Single SDK call:

```typescript
transfers.build({ autoRegister: true, autoSetup: true })
  .with(token, t => t.deposit({ amount: totalAmount, recipient: adminAddress }))
  .execute({ provingBlockId })
```

This is public on-chain — observers see admin deposited X tokens into the pool.

**Step 3: Wait for note maturity.** Poll `getBlockNumber()` until 10 blocks have passed since the deposit. Display countdown in UI.

**Step 4: Smart batch transfer.** Try batch first:

```typescript
const builder = transfers.build({
  autoSetup: true,
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "all",
});
builder.surplusTo(adminAddress);
builder.with(token, t => {
  for (const { address, amount } of recipients) {
    t.transfer({ recipient: address, amount });
  }
});
await builder.execute({ provingBlockId });
```

If batch fails (proof too large, timeout, or any error), fall back to one-at-a-time:

```typescript
for (const { address, amount } of remainingRecipients) {
  try {
    await transfers.build({
      autoSetup: true,
      autoDiscover: { notes: "refresh", channels: "refresh" },
      autoSelectNotes: "naive",
    })
      .surplusTo(adminAddress)
      .with(token, t => t.transfer({ recipient: address, amount }))
      .execute({ provingBlockId });
    updateStatus(address, "done");
  } catch (error) {
    updateStatus(address, "failed", error.message);
  }
}
```

All transfers happen inside the pool — no ERC-20 calls, fully anonymous. Observers see encrypted channels, notes, and nullifiers but cannot determine recipients, amounts, or the link to the deposit.

### Recipient List Management

**RecipientList component** — an editable table with columns: Address, Amount, Status.

**Input methods:**
- Add row: paste address, type amount
- Edit row: click to modify
- Delete row: remove recipient
- Paste CSV: bulk-paste `address,amount` lines

**Pre-loaded from config:** `.env` contains `VITE_AIRDROP_RECIPIENTS` as a JSON array:

```json
[{"address": "0x041c9d...", "amount": "500"}, {"address": "0x05499b...", "amount": "300"}]
```

**Validation (before Airdrop button enables):**
- All addresses are valid Starknet addresses (0x-prefixed, correct length)
- All amounts are positive integers
- Total amount does not exceed admin's public ERC-20 balance
- No duplicate addresses

### AirdropProgress Component

Renders real-time status during execution:
- Current phase (approving / depositing / waiting / transferring / complete)
- Per-recipient status in the table (pending → proving → confirmed → done / failed)
- Maturity countdown ("Waiting for note maturity: 7 blocks remaining...")
- Summary on completion: "N succeeded, M failed" with retry option for failed entries

## Claimant Flow

### useClaimant Hook

Two operations: discover and withdraw.

**Discover:**

```typescript
const { notes } = await transfers.discoverNotes({ tokens: [token] });
```

Returns unspent notes with decrypted amounts. The UI shows:
- Total private balance (sum of note amounts)
- Individual notes list

**Withdraw:**

```typescript
await transfers.build({
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "naive",
})
  .surplusTo(claimantAddress)
  .with(token, t => t.withdraw({ amount, recipient: claimantAddress }))
  .execute({ provingBlockId });
```

Claimant can withdraw all or a partial amount. Partial withdrawal creates a change note automatically.

### ClaimantPanel Component

- Private balance display
- Notes table (amount per note)
- Withdraw input (defaults to full balance) + Withdraw button
- Transaction status after withdrawal

## Error Handling

| Scenario | Behavior |
|---|---|
| Batch proof fails | Log error, switch to one-at-a-time mode, continue |
| Individual transfer fails | Mark recipient as `failed`, continue with remaining |
| Insufficient ERC-20 balance | Airdrop button disabled, show shortfall amount |
| Unregistered recipient | Warning shown but not a blocker — admin can still transfer; recipient must register before claiming |
| Discovery/proving service down | Airdrop button disabled, show service health message |
| Note maturity not reached | Block with countdown until 10 blocks pass |

## Privacy Properties

| Step | Visible on-chain | Hidden |
|---|---|---|
| Approve | Admin approved pool to spend X tokens | — |
| Deposit | Admin deposited X tokens into pool | Note owner, note amount (encrypted) |
| Transfer (inside pool) | Nullifiers published, encrypted channels/notes created | Recipient addresses, transfer amounts, token type, link to deposit |
| Withdraw (by claimant) | Claimant received Y tokens from pool | Which note was spent, who originally sent the tokens |

The admin→claimant link is broken by the privacy pool. Observers cannot trace a withdrawal back to the admin's deposit without the participants' viewing keys.

## Environment Variables

```bash
VITE_RPC_URL=http://34.170.198.113:9545/rpc/v0_10
VITE_PROVING_SERVICE_URL=http://34.29.249.119:3000
VITE_INDEXER_URL=http://35.192.48.142:8080
VITE_POOL_ADDRESS=0xd894af9ed2bdede33675049ae5285df000c44258a2250b84a9c3bed0d7c233
VITE_TOKEN_ADDRESS=0x45060889ad33e70531ae2683046bb9b0d7c8199fccd9acd544170a42b0a0fd0
VITE_FEE_TOKEN_ADDRESS=0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
VITE_CHAIN_ID=0x534e5f5345504f4c4941
VITE_PROOF_VALIDITY_BLOCKS=450
ACCOUNTS=[...same JSON as demo...]
VITE_AIRDROP_RECIPIENTS=[{"address":"0x041c9d...","amount":"500"},{"address":"0x05499b...","amount":"300"}]
```
