# Privacy Escrow: Deferred Delivery for Unregistered Recipients

## Problem

The current privacy pool requires both sender and recipient to be registered before a private transfer can happen. The SDK needs the recipient's public viewing key (published during registration) to encrypt the channel and notes. If the recipient hasn't registered, the transfer fails with "missing channel context."

This creates a UX friction point: the sender must coordinate with the recipient to ensure they register before the transfer can be initiated.

## Desired Flow

```
Alice wants to send tokens to Bob, but Bob hasn't registered yet.

Current:  Alice waits → Bob registers → Alice sends → Bob claims
Desired:  Alice sends now → Bob registers later → tokens arrive automatically
```

## Options

### Option A: Public Escrow, Private Claim

1. Alice deposits tokens into an escrow contract, locked for Bob's address
2. Escrow holds tokens in public ERC-20 (not in the privacy pool)
3. Bob registers his viewing key in the pool whenever he's ready
4. Bob calls the escrow, which deposits into the pool and transfers to Bob atomically via `InvokeExternal`

**Flow:**
```
Alice → ERC-20.transfer(escrow, amount)
         Escrow stores: { recipient: Bob, amount: 500, token: STRK }
                              ... time passes ...
Bob registers in pool
Bob → Escrow.claim()
       Escrow → Pool.deposit(amount) + Pool.transfer(Bob, amount)
       (atomic via InvokeExternal)
```

**Pros:**
- Simple contract logic — just a mapping of recipient → locked tokens
- Bob can claim whenever he's ready
- Alice doesn't need to stay online

**Cons:**
- The escrow holding is **public** — observers see Alice locked X tokens for Bob's address
- Breaks the privacy model at the deposit stage (the link between Alice and Bob is visible)
- Requires a new escrow contract deployment

**Privacy impact:** Low. The escrow reveals the sender-recipient relationship publicly.

### Option B: Encrypted Escrow with Deferred Delivery

1. Alice deposits into the privacy pool and creates an **open note** held by an escrow contract
2. The escrow stores a commitment: `hash(secret) → note metadata`
3. Alice gives Bob the secret off-chain (via a link, QR code, messaging app, etc.)
4. When Bob registers and presents the secret, the escrow releases the note to Bob via a new private transfer

**Flow:**
```
Alice → Pool.deposit(amount)
         Pool creates open note owned by escrow contract
         Escrow stores: hash(secret) → { note_id, amount }
Alice sends secret to Bob off-chain (link, QR, etc.)
                              ... time passes ...
Bob registers in pool
Bob → Escrow.claim(secret)
       Escrow verifies hash(secret) matches stored commitment
       Escrow → Pool.transfer(Bob, amount) using the open note
       (atomic via InvokeExternal)
```

**Pros:**
- Preserves privacy — observers see an open note was created for the escrow but not who it's intended for
- The secret acts as a claim ticket, not tied to a specific address until claim time
- Bob's identity is only revealed when he claims (and even then, only inside the pool's encrypted state)
- Supports forwarding — Bob could give the secret to someone else to claim instead

**Cons:**
- More complex contract logic (commitment scheme, open note management)
- Requires careful handling of the secret (if intercepted, anyone can claim)
- The escrow contract needs to be a registered participant in the pool
- Open notes have different spending rules than encrypted notes

**Privacy impact:** High. The sender-recipient link is hidden until claim time. The secret-based claim adds an extra layer of unlinkability.

### Option C: Off-Chain Relay (No New Contract)

1. Alice's app maintains a "pending recipients" queue for unregistered addresses
2. A background watcher polls the pool contract or discovery service for new registrations
3. Once a pending recipient registers, the app automatically triggers the private transfer
4. No escrow contract needed — the transfer uses the standard SDK flow

**Flow:**
```
Alice adds Bob (unregistered) to airdrop list
App detects Bob is unregistered → adds to pending queue
App starts polling: "Is Bob registered yet?"
                              ... time passes ...
Bob registers in pool (via the Claim Airdrop UI or any other app)
App detects registration → automatically builds and submits transfer
Bob discovers and withdraws normally
```

**Pros:**
- No new contracts — works with the existing privacy pool
- Simple to implement — just a polling loop + the existing transfer logic
- Can be added to the airdrop app as a feature
- Full privacy preserved (standard private transfer once Bob is registered)

**Cons:**
- Alice (or her app/backend) must stay online until all pending recipients register
- If Alice closes the app before Bob registers, the transfer is lost (unless the pending queue is persisted)
- Requires a persistent backend service for reliable delivery
- Doesn't work for truly async scenarios where Alice may never come back online

**Privacy impact:** Full. Uses the standard private transfer flow — no escrow, no public holdings. The only observable event is the transfer happening shortly after Bob registers (timing correlation).

### Option D: Pool-Level Escrow (Committed Notes)

Instead of a separate escrow contract, the commitment scheme lives inside the privacy pool itself. This eliminates the external contract fingerprint and makes claims indistinguishable from normal pool operations.

1. Alice deposits into the pool and creates a **committed note** tied to `hash(secret)` — no recipient address stored
2. Alice shares the secret off-chain (link, QR code, messaging app)
3. When Bob registers, he presents the secret to the pool directly
4. The pool verifies the hash, creates an encrypted note in Bob's channel — looks like any other pool operation

**Flow:**
```
Alice → Pool.create_committed_note(amount, hash(secret))
         Pool stores: { commitment: hash(secret), note_id, amount }
         No recipient address anywhere on-chain
Alice sends secret to Bob off-chain (link, QR, etc.)
                              ... time passes ...
Bob registers in pool
Bob → Pool.claim_committed_note(secret)
       Pool verifies hash(secret) matches stored commitment
       Pool creates encrypted note in Bob's channel
       (internal state transition — no external contract call)
```

**What observers see:**
- Alice made a deposit (normal pool activity)
- Bob interacted with the pool (normal pool activity)
- No escrow contract interaction, no visible link between the two

**Pros:**
- Highest privacy — Bob's claim blends into the pool's anonymity set (deposits, transfers, withdrawals all look the same)
- No external contract call (`InvokeExternal`) needed — everything is internal state
- No separate escrow contract to deploy, register, or audit
- Forwardable — secret-based, not address-based

**Cons:**
- Requires modifying the core pool contract (new actions: `CreateCommittedNote`, `ClaimCommittedNote`)
- Higher audit surface — changes to the pool affect all users
- Pool upgrades must account for committed note state
- Same secret interception risk as Option B

**Privacy impact:** Highest. No external contract fingerprint. Claims are indistinguishable from normal pool operations. Sender-recipient link is never visible on-chain.

## Why This Is Needed

The current privacy pool requires both sender and recipient to be registered before any private transfer can happen. The sender's SDK needs the recipient's public viewing key (set during registration) to encrypt the channel and notes. Without it, the transfer simply fails.

This is a fundamental UX blocker: **you cannot send tokens to someone who hasn't joined the pool yet.** In practice, this means:

- Airdrops require all recipients to register first, defeating the purpose of surprise distributions
- Onboarding new users requires awkward coordination ("register first, then I'll send you tokens")
- Payment links, gift cards, and "send to anyone" flows are impossible
- The pool can only serve users who are already in it, limiting organic growth

The escrow mechanism solves this by decoupling the send from the receive. The sender locks funds now, and the recipient claims them whenever they register — without the sender needing to stay online or coordinate timing. This is the primitive that turns the privacy pool from a closed system (only existing members can transact) into an open one (anyone can receive, registration happens on their own schedule).

## Comparison

| | Option A | Option B | Option C | Option D |
|---|---|---|---|---|
| Privacy | Low | High | Full | Highest |
| Complexity | Medium | High | Low | High |
| New contracts | Yes (escrow) | Yes (escrow + commitments) | No | No (pool modification) |
| Alice online? | No | No | Yes (or backend) | No |
| Forwardable | No (locked to address) | Yes (secret-based) | No | Yes (secret-based) |
| Best for | Non-sensitive distributions | High-privacy deferred delivery | Quick integration into existing apps | Production-grade privacy with no external fingerprint |

## Recommendation

For the anonymous airdrop app, **Option C** is the fastest path — add a "pending queue" feature that watches for registrations and auto-sends. It requires no contract changes and preserves full privacy.

For a production-grade solution, **Option B** is the most interesting — it introduces a new primitive (secret-based deferred private delivery) that could be useful beyond airdrops: gift cards, payment links, onboarding flows where the recipient doesn't have a wallet yet.
