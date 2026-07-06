# Simple App Ideas Using the Starknet Privacy SDK

Ideas for lightweight applications built on top of the privacy pool SDK, ordered by complexity.

---

## 1. Privacy Savings Vault (Deposit & Withdraw Only)

**Complexity:** Minimal

User deposits tokens into the privacy pool and withdraws later. No transfers, no recipients — just "hide my balance."

- Deposit public ERC-20 tokens into the pool as encrypted notes
- View private balance via `discoverNotes()`
- Withdraw back to public when needed

**SDK calls needed:**

```typescript
// One-time registration
await transfers.build().register().execute();

// Deposit
await transfers.build({ autoSetup: true })
  .with(token, t => t.deposit({ amount: 100n, recipient: myAddress }))
  .execute();

// Check private balance
const { notes } = await transfers.discoverNotes({ tokens: [token] });

// Withdraw
await transfers.build({
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "naive",
})
  .surplusTo(myAddress)
  .with(token, t => t.withdraw({ amount: 50n, recipient: myAddress }))
  .execute();
```

---

## 2. Private Tip Jar / Donation Box

**Complexity:** Low

A single page where visitors send private tokens to a recipient. The recipient periodically checks for incoming notes and withdraws.

- Visitor enters an amount and hits "Send"
- SDK handles channel setup automatically (`autoSetup: true`)
- Recipient discovers incoming notes with their viewing key
- Donor identity is hidden from on-chain observers

**SDK usage:**

```typescript
// Donor sends a private tip
await transfers.build({
  autoRegister: true,
  autoSetup: true,
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "naive",
})
  .surplusTo(donorAddress)
  .with(token, t => t.transfer({ recipient: tipJarAddress, amount }))
  .execute();

// Recipient discovers tips
const { notes } = await transfers.discoverNotes({ tokens: [token] });

// Recipient withdraws
await transfers.build({
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "naive",
})
  .surplusTo(recipientAddress)
  .with(token, t => t.withdraw({ amount, recipient: recipientAddress }))
  .execute();
```

---

## 3. Private Payroll Splitter

**Complexity:** Low-Medium

Input a list of addresses and amounts, batch them into a single private transaction. Each recipient discovers and withdraws independently.

- Employer deposits tokens into the pool
- Uses the builder API to batch multiple `.transfer()` calls
- Channel setup is automatic per recipient
- Recipients never see each other's amounts

**SDK usage:**

```typescript
// Batch payroll in a single transaction
const builder = transfers.build({
  autoSetup: true,
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "all",
});

builder.surplusTo(employerAddress);
builder.with(token, t => {
  for (const { address, amount } of payroll) {
    t.transfer({ recipient: address, amount });
  }
});

await builder.execute();
```

---

## 4. Private Escrow

**Complexity:** Medium

Party A deposits tokens. Both parties confirm off-chain. Tokens transfer to Party B on confirmation.

- Party A deposits into the pool
- Off-chain agreement (could be a simple confirmation UI)
- Party A transfers to Party B, or refunds to self if cancelled
- Uses `createProofInvocation()` to prepare the transfer ahead of time, then `executeWithInvocation()` to finalize

**SDK usage:**

```typescript
// Step 1: Party A deposits
await transfers.build({ autoSetup: true })
  .with(token, t => t.deposit({ amount, recipient: partyAAddress }))
  .execute();

// Step 2: Prepare transfer (can be done before final confirmation)
const invocation = await transfers.createProofInvocation([
  /* transfer actions to Party B */
]);

// Step 3: Execute on confirmation
await transfers.executeWithInvocation(invocation);
```

---

## 5. Anonymous Airdrop Claimer

**Complexity:** Medium

Admin pre-loads the pool. Eligible addresses claim privately — only the admin and each individual recipient know who claimed.

- Admin deposits a lump sum into the pool
- Eligible users are given a claim link / allowlist
- Each claim is a private transfer from admin to claimant
- Claim amounts and recipient identities stay encrypted on-chain

**SDK usage:**

```typescript
// Admin deposits airdrop fund
await adminTransfers.build({ autoSetup: true })
  .with(token, t => t.deposit({ amount: totalAirdrop, recipient: adminAddress }))
  .execute();

// Each claimant triggers a transfer from admin
await adminTransfers.build({
  autoSetup: true,
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "naive",
})
  .surplusTo(adminAddress)
  .with(token, t => t.transfer({ recipient: claimantAddress, amount: claimAmount }))
  .execute();
```

---

## 6. Private Token Swap

**Complexity:** Medium-High

Uses `InvokeExternal` to call a DEX atomically within a private transaction. Withdraw token A, swap on-chain, deposit token B — all in one transaction.

- Single atomic operation via the builder
- Trade size and trader identity stay private
- Works with any DEX that exposes a swap function (Ekubo, JediSwap, etc.)

**SDK usage:**

```typescript
await transfers.build({
  autoSetup: true,
  autoDiscover: { notes: "refresh", channels: "refresh" },
  autoSelectNotes: "naive",
})
  .surplusTo(myAddress)
  .with(tokenA, t => t.withdraw({ amount: 100n, recipient: poolAddress }))
  .invoke(call => call.to(dexAddress).selector("swap").calldata([/* swap params */]))
  .with(tokenB, t => t.deposit({ amount: expectedOutput }))
  .execute();
```

---

## Testnet Environment

All apps above can be built against the existing testnet infrastructure:

| Service | URL |
|---------|-----|
| RPC | `https://YOUR_RPC_HOST/rpc/v0_10` |
| Proving Service | `https://YOUR_PROVING_HOST` |
| Discovery Service | `https://YOUR_INDEXER_HOST/` |
| Pool Contract | `0xd894af9ed2bdede33675049ae5285df000c44258a2250b84a9c3bed0d7c233` |
| Test Token (strkBTC) | `0x45060889ad33e70531ae2683046bb9b0d7c8199fccd9acd544170a42b0a0fd0` |
| Fee Token (STRK) | `0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |

Test accounts (Alice, Bob, Charlie) are pre-deployed on Sepolia testnet — see the project's environment documentation for keys and addresses.
