# Why the Privacy Pool Needs an Escrow Mechanism

## The Core Problem

The privacy pool currently requires both sender and recipient to be registered before any private transfer can happen. The sender's SDK needs the recipient's public viewing key (published during registration) to encrypt the channel and notes. If the recipient hasn't registered, the transfer fails — there's no way to encrypt data for someone whose key you don't have.

This means **you cannot send tokens to someone who hasn't joined the pool yet.**

## Why This Matters

### Breaks the "send to anyone" expectation

In normal token transfers (ERC-20), you can send to any address — the recipient doesn't need to do anything beforehand. The privacy pool introduces a hard prerequisite: the recipient must register first. This is a regression in usability that blocks adoption.

### Airdrops become coordination nightmares

A privacy-preserving airdrop should work like this: the sender distributes tokens, and recipients claim them on their own schedule. Instead, the current flow requires:

1. Announce the airdrop
2. Wait for every recipient to register in the pool
3. Only then can the sender execute the transfers
4. Recipients who register late get nothing unless the sender comes back

This defeats the purpose of airdrops — surprise, async, low-friction distribution.

### Onboarding creates a chicken-and-egg problem

To bring new users into the privacy pool, someone needs to send them tokens. But to send them tokens, they need to already be in the pool. The only workaround is:

1. New user registers in the pool (with no tokens)
2. Sender notices the registration
3. Sender executes the transfer

This requires real-time coordination between sender and recipient — the opposite of what a privacy system should enable.

### Payment links and gift flows are impossible

Common patterns in crypto UX — payment links, gift cards, QR-code transfers — all rely on the sender creating something claimable without knowing the recipient's identity or state. The current pool has no mechanism for this.

## What the Escrow Mechanism Enables

The escrow decouples the **send** from the **receive**:

```
Without escrow:  Alice waits → Bob registers → Alice sends → Bob claims
With escrow:     Alice sends now → Bob registers later → Bob claims
```

The sender locks funds with a commitment (a hash of a secret). The recipient claims by presenting the secret — whenever they register, on their own schedule, without the sender needing to be online.

### Concrete use cases unlocked

- **Airdrops to unregistered addresses** — distribute tokens now, recipients claim when ready
- **Onboarding new users** — send a claim link, recipient registers and claims in one flow
- **Payment links** — generate a link/QR that anyone can claim by joining the pool
- **Gift cards** — preload tokens into a claimable commitment, share the secret
- **Forwarding** — the secret is not tied to an address, so it can be passed to someone else

## Why Pool-Level (Option D) Over a Separate Escrow Contract

A separate escrow contract (Options A/B) introduces a privacy leak: observers can see that a user interacted with the escrow, which narrows the anonymity set. Even if the sender-recipient link is hidden, the escrow interaction itself is a fingerprint.

Building the commitment scheme directly into the pool (Option D) solves this:

| Concern | Separate escrow | Pool-level escrow |
|---|---|---|
| Claim visibility | Bob calls escrow contract — distinct on-chain action | Bob interacts with pool — same as every other user |
| Anonymity set | Only escrow users | All pool users (deposits, transfers, withdrawals) |
| External calls | Needs `InvokeExternal` to bridge escrow → pool | Internal state transition, no external call |
| Contract surface | New contract to deploy, register, and audit | Extends existing pool with two new actions |
| Fingerprinting | Escrow interactions are distinguishable | Claims are indistinguishable from normal pool operations |

The tradeoff is that pool-level requires modifying the core contract, which has a higher audit bar. But the privacy gain is significant — claims blend into the pool's existing activity instead of standing out as escrow operations.

## Summary

The escrow mechanism is the primitive that turns the privacy pool from a **closed system** (only existing members can transact with each other) into an **open system** (anyone can receive tokens, registration happens on their own schedule). Without it, the pool's growth is bottlenecked by the requirement that both parties must be registered before any value can flow between them.
