# Awesome STRK20 [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of resources, tools, and reference implementations for building private applications on Starknet with **STRK20** — the privacy pool that brings shielded balances, private transfers, and private DeFi to any ERC-20 on Starknet.

STRK20 is a note-based privacy pool (not a mixer): shielding deposits an ERC-20 into the pool as an encrypted note, and private transfers spend existing notes to create new ones. Every private transaction carries a STARK proof that Starknet verifies in-protocol. Inside the pool, sender, recipient, amounts, and token type are hidden; deposit and withdrawal amounts (the public ERC-20 legs) stay visible.

## Contents

- [Core Protocol](#core-protocol)
- [SDKs & Client Libraries](#sdks--client-libraries)
- [Wallet Integration](#wallet-integration)
- [Anonymizer & Helper Contracts](#anonymizer--helper-contracts)
- [Proof-of-Concept Apps](#proof-of-concept-apps)
- [App Ideas to Build](#app-ideas-to-build)
- [Guides & Docs](#guides--docs)
- [Wallets](#wallets)
- [Community](#community)
- [Contributing](#contributing)

## Core Protocol

*The privacy pool everything else builds on, plus the cryptography behind it.*

- [STRK20 site](https://strk20.starknet.io/) — The home of the Starknet privacy pool: what it is, who's building on it, and how to get started.
- [Scalable Compliant Privacy on Starknet (whitepaper)](https://eprint.iacr.org/2026/474) — The academic paper describing the protocol, its proof system, and its selective-disclosure model.
- [Canonical privacy pool contract](https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a) — The deployed pool contract on Starknet mainnet, viewable on Voyager.
- [Prover crate](https://github.com/starkware-libs/sequencer/tree/main/crates/starknet_transaction_prover) — Open-source prover for the privacy pool; lets advanced teams self-host proving instead of relying on hosted proving services.

## SDKs & Client Libraries

*Programmatic access to the pool for wallets and advanced integrators.*

- **Privacy SDK** — A TypeScript client (Apache 2.0) that wraps every step of working with STRK20 notes: registering a viewing key, opening channels and per-token subchannels, generating proofs with a configurable proving backend, and submitting proved transactions on-chain. It also exposes a fluent builder for multi-token, multi-action transactions and a discovery service for syncing notes and balances. The low-level route for wallets and advanced integrations; normal dapps should use the Privacy Wallet API instead. *(Public repository not yet available — link will be added when it opens.)*
- [starknet.js](https://github.com/starknet-io/starknet.js/releases/tag/v10.4.0) — v10.4.0 adds STRK20 support via `WalletAccountV6`, talking to the user's privacy-enabled wallet under the hood so the dapp never touches the viewing key.

## Wallet Integration

*The application-layer route most dapps should use: ask the user's privacy-enabled wallet to perform the private action via the Privacy Wallet API.*

- [Privacy Wallet API spec v0.10.3](https://github.com/starkware-libs/starknet-specs/releases/tag/v0.10.3) — The specification for the dapp ↔ wallet bridge that lets an app request shield, private-transfer, unshield, and swap actions without managing keys, notes, or proving.
- [get-starknet](https://github.com/starknet-io/get-starknet) — Wallet connection library; use v6.0.2 (install `@starknet-io/get-starknet-discovery@6.0.2` and `@starknet-io/get-starknet-wallet-standard@6.0.2` explicitly, since 6.x is on the npm `next` tag).
- [@starknet-io/types-js v0.10.3](https://www.npmjs.com/package/@starknet-io/types-js/v/0.10.3) — Shared TypeScript types for the Privacy Wallet API surface.
- [WalletAccount guide — STRK20 with get-starknet v6](https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6) — Step-by-step guide for wiring a dapp to a privacy-enabled wallet.
- [Philippe's Wallet-Account reference implementation](https://github.com/PhilippeR26/Starknet-WalletAccount) — A community reference implementation of the wallet-account flow.
- [Wallet Account demo](https://starknet-wallet-account.vercel.app/) — A live test dapp to sanity-check the wallet integration against.

## Anonymizer & Helper Contracts

*App-specific Cairo contracts that make private DeFi flows work. The pool calls your helper atomically through a single mandatory entrypoint, `privacy_invoke`.*

The usual flow: the pool withdraws, your helper does its work (swap, lend, escrow, or store), and the tokens are credited back as private notes. If anything reverts, the whole operation rolls back, so funds return to the pool and nothing is stranded. Production helper contracts are owned, reviewed, and audited by each builder — StarkWare reference examples are starting points, not a guarantee of production readiness.

- [Escrow helper contract](./pocs/escrow-helper) — A reference `privacy_invoke` Cairo helper (in this repo) that holds ERC-20 tokens against a Poseidon commitment hash, enabling deferred delivery to recipients who aren't registered in the pool yet.

## Proof-of-Concept Apps

*Reference applications built on top of the privacy pool. These are learning references, not production code — see the note below.*

- [Private Airdrop](./pocs/private-airdrop) — Distribute ERC-20 tokens privately: the sender deposits into the pool, transfers privately to a recipient list, and recipients discover and withdraw. The sender→recipient link is cryptographically hidden on-chain.
- [Private Escrow](./pocs/private-escrow) — Deferred token delivery to unregistered recipients. A sender deposits against a secret commitment hash through the pool; the recipient claims later with the shared secret, even if they weren't registered at deposit time. Pairs with the [escrow helper contract](./pocs/escrow-helper).
- [Polymarket Privacy](https://github.com/starkware-libs/polymarket-privacy) — Private swaps on Polymarket: USDC routes through the privacy pool and Circle CCTP via an anonymizer contract so the Polygon account that trades is unlinkable to the user's Starknet identity.
- [Private Payroll](https://github.com/starkware-industries/private-payroll) — Batch private salary payments through the pool, so recipients and amounts stay confidential.
- [Private KYC](https://github.com/starkware-industries/private-kyc) — Privacy-preserving KYC / selective disclosure on top of the pool.

> [!NOTE]
> Several of these PoCs depend on components that are not yet publicly released. The in-repo apps reference the Privacy SDK via `file:../../sdk`, and the escrow helper depends on the `privacy` Cairo library. Some linked repositories above (Polymarket Privacy, Private Payroll, Private KYC) are not yet public — the links will resolve once those repositories are opened. All are provided as **reference implementations** to read and learn from. Replace every placeholder in each `.env.example` with your own values; never commit real private keys.

## App Ideas to Build

*Starting points for lightweight apps on the privacy pool, ordered roughly by complexity. Full sketches with SDK snippets live in [`ideas/app-ideas.md`](./ideas/app-ideas.md).*

- **Privacy Savings Vault** — Deposit and withdraw only: "hide my balance." The simplest possible integration.
- **Private Tip Jar / Donation Box** — Visitors send private tokens to a recipient who periodically discovers and withdraws incoming notes.
- **Private Payroll Splitter** — Batch many private transfers into a single transaction; recipients never see each other's amounts.
- **Private Escrow** — Hold tokens against a secret until both parties confirm (see the PoC above).
- **Anonymous Airdrop Claimer** — Recipients claim a private distribution without linking to the source (see the PoC above).
- **Private Token Swap** — Route a swap through an anonymizer helper so the trader's address stays unlinked.

## Guides & Docs

*Where to read next.*

- [starknet.js docs](https://starknet-js.com/) — The client library docs, including the STRK20 / WalletAccount guides.
- [Whitepaper](https://eprint.iacr.org/2026/474) — Scalable Compliant Privacy on Starknet.

## Wallets

*Starknet wallets with privacy support.*

- [Ready](https://www.ready.co/) — In-wallet privacy live on mainnet; the current start path for the Privacy Wallet API alongside starknet.js v10.4.0.
- [Xverse](https://www.xverse.app/) — In-wallet privacy live on mainnet; dapp-facing Privacy Wallet API support is in progress.

## Community

- [Cairo CoreStars on Telegram](https://t.me/sncorestars) — The place to ask questions and get integration help (`@sncorestars`).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please keep entries public, accurate, and link-checked.
