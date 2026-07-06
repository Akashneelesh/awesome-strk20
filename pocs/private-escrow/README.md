> [!NOTE]
> **Reference implementation.** This app depends on the Privacy SDK (referenced as `starknet-sdk: file:../../sdk`), which is not yet publicly released. It is provided to read and learn from; it will build once the SDK is public and linked. Replace every placeholder in `.env.example` with your own values, and never commit real private keys.

# Privacy Escrow

Privacy-preserving escrow for deferred token delivery to unregistered recipients, built on top of the Starknet privacy pool.

## Problem

Privacy pools require both sender and recipient to be registered before a transfer can happen. This blocks common use cases like airdrops, payment links, and onboarding new users who haven't opted into the pool yet.

## Solution

An escrow contract holds tokens against a secret commitment hash. The sender deposits through the privacy pool without naming a recipient. The recipient claims later using a shared secret, even if they weren't registered at deposit time.

## How It Works

**Deposit (sender):**

1. Alice generates a random secret and computes `commitment_hash = poseidon(ESCROW_COMMITMENT_TAG, secret)`
2. Alice builds a privacy pool transaction that withdraws tokens to the escrow and invokes the deposit with the commitment hash
3. The escrow stores the commitment; Alice shares the secret off-chain (link, QR, message)

**Claim (recipient):**

1. Eva receives the secret from Alice
2. Eva submits a privacy pool transaction that creates an open note and invokes the claim with the secret
3. The escrow verifies `poseidon(tag, secret)` matches the stored commitment, marks it claimed, and approves the pool to pull the tokens
4. The pool deposits the tokens into Eva's encrypted note

Eva now holds private tokens. No on-chain trace of ownership.

## Privacy Properties

| On-chain data | Reveals sender? | Reveals recipient? |
|---|---|---|
| NoteUsed (sender spends a note) | No (opaque nullifier) | N/A |
| Withdrawal (pool to escrow) | No (encrypted for auditor only) | N/A |
| Token transfer (pool to escrow) | No (pool contract is the sender) | N/A |
| Commitment hash in escrow | No (one-way Poseidon hash) | N/A |
| OpenNoteCreated (recipient note) | N/A | No (note ID cannot be reversed to owner) |
| DepositToOpenNote (escrow to note) | N/A | No (only shows escrow deposited into a note) |
| Token transfer (escrow to pool) | N/A | No (escrow and pool only) |
| The secret | Never on-chain | Never on-chain |

**Current leaks (fixable):**

- `sender_address` and gas payment reveal who submitted each transaction. Fix: use a relayer (outsideExecution pattern).
- Amount matching when there is only one deposit and one claim of the same amount. Fix: standardized denominations and more users.
- Timing correlation between deposit and claim. Fix: time delay.

## Dependencies

Privacy strength depends on:

- **Anonymity set size** -- more users depositing the same denominations
- **Time delay** -- longer gaps between deposit and claim
- **Relayer submission** -- hides sender_address and gas payer for both parties
- **Fixed denominations** -- prevents unique-amount matching

## Deployed Contracts (Sepolia)

| Contract | Address |
|---|---|
| Escrow | `0x01ad75c06ad9086bec4c24c967397c3fdbb32f8c11525bca82e425dc17d270cc` |
| Privacy Pool | `0xd894af9ed2bdede33675049ae5285df000c44258a2250b84a9c3bed0d7c233` |
| Escrow Class Hash | `0x4958e04ac1370b72b8f41e08f5784ee5e1b2db3bdd3dcc54cae50ce3b9b2c73` |

## Running Locally

```bash
# Build the SDK (escrow app depends on it)
cd sdk && npm ci && npm run build

# Install and run the escrow app
cd apps/escrow
cp .env.example .env   # then fill in contract addresses and accounts
npm install
npm run dev
```

The app requires a `.env` with: RPC URL, indexer URL, pool address, escrow address, token address, proving service URL, chain ID, and a JSON array of test accounts.

## Verified Example

Alice deposited 100 tokens into escrow (block 8603831). Eva, a brand-new unregistered account, claimed them (block 8603919). On-chain analysis confirms: no shared address in any pool or escrow event links Alice to Eva. The only correlation is amount matching and timing, both of which dissolve with more users and time delay.
