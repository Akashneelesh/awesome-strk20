# STRK[20] — Request for Startups (RFPs)

_Source: https://strk20.starknet.io/rfp — scraped 2026-07-06_

These are problems the STRK[20] team wants startups to tackle on their standard for compliant, programmable privacy. 12 ideas total.

## Contents

1. [Encrypted on-chain messaging via the privacy pool](https://strk20.starknet.io/rfp/private-messaging) — _Social & Communications_
2. [Provably fair on-chain poker where cheating is mathematically impossible](https://strk20.starknet.io/rfp/private-poker) — _Gaming_
3. [Trustless, atomic, private OTC settlement for large block trades](https://strk20.starknet.io/rfp/private-otc-settlement) — _Markets & Trading_
4. [Bonding-curve token launches with hidden buyers, visible price action](https://strk20.starknet.io/rfp/private-pumpfun) — _Markets & Trading_
5. [Anonymous whistleblower platform with proof-of-authorship](https://strk20.starknet.io/rfp/anonymous-whistleblower) — _Social & Communications_
6. [One-click privacy from any chain - Starknet as the privacy layer of crypto](https://strk20.starknet.io/rfp/cross-chain-privacy-hub) — _Infrastructure_
7. [Prediction markets with visible odds and invisible bettors](https://strk20.starknet.io/rfp/private-prediction-market) — _Markets & Trading_
8. [Sealed-bid auctions where the bids are actually sealed](https://strk20.starknet.io/rfp/sealed-bid-auctions) — _Markets & Trading_
9. [On-chain Among Us with provably fair roles and anonymous votes](https://strk20.starknet.io/rfp/social-deduction-game) — _Gaming_
10. [An Umbra-style privacy wallet for Starknet](https://strk20.starknet.io/rfp/privacy-wallet) — _Infrastructure_
11. [Private payroll and treasury disbursement at company scale](https://strk20.starknet.io/rfp/private-payroll) — _Payments & Money_
12. [Private subscriptions and creator monetization with Web2-grade UX](https://strk20.starknet.io/rfp/private-subscriptions) — _Payments & Money_

---

# Encrypted on-chain messaging via the privacy pool

A private messaging layer built on the existing privacy pool - sender anonymity, encrypted payloads, persistent channels. No modifications to the pool contract, no trusted server, no metadata.

## What this enables

- →**Encrypted on-chain mail** between any two privacy-pool participants - addresses never appear on-chain, messages decrypt only on the recipient's device.
- →**Payment memos** - attach a message to a private transfer in the same transaction. The first credible "remittance with note" primitive on a public chain.
- →**Escrow negotiation** - parties coordinate terms privately before executing a transfer, without ever leaking the relationship to observers.
- →**A reusable substrate** for any application that needs metadata-resistant messaging - anonymous tips, dissident comms, professional escrow.

## What you build

A helper contract callable via `InvokeExternal` that appends encrypted message payloads to per-channel storage. An off-chain discovery indexer that returns decrypted messages for a given viewing key. SDK methods (`sendMessage`, `discoverMessages`) that reuse the same ECDH channel-key derivation the pool already uses for note encryption.

## Why it ships

The privacy pool already gives you everything hard about secure messaging: key agreement via ECDH, encrypted persistent channels, sender anonymity via `InvokeExternal` (the pool is `msg.sender`, not the user). The work here is the helper contract, the indexer, and an SDK extension. No protocol changes required.

## Hidden vs visible

| Element | Hidden | Visible |
| --- | --- | --- |
| Sender identity | Yes - pool is the `msg.sender` | |
| Recipient identity | Yes - only resolvable via the recipient's viewing key | |
| Message content | Yes - encrypted with the channel key | |
| That a message was sent | Partially - an observer sees a pool transaction occurred | Block timestamp |

**URL:** https://strk20.starknet.io/rfp/private-messaging · **Category:** Social & Communications

---

# Provably fair on-chain poker where cheating is mathematically impossible

A fully on-chain poker game where players' hands are cryptographically private, dealing is STARK-proven fair, and betting settles through the privacy pool. No trusted server, no admin who can peek at cards.

## What this enables

- →**Provably fair online poker.** Every existing platform asks players to trust a black-box RNG. This replaces trust with STARK proofs of correct dealing. Every hand is independently verifiable.
- →**Cryptographic cash games.** Buy in by shielding USDC, play through paymaster-submitted actions, cash out to any address - your stack size, session history, and lifetime results are private unless you choose to disclose.
- →**Tournament infrastructure** - guaranteed prize pools, blind structures, table balancing. Entry fees and payouts as private transfers; organizers verify participants via viewing keys.
- →**A platform for any hidden-information game.** The card-as-encrypted-note pattern generalizes to Battleship, Mafia, sealed-bid auctions, and anything else with hidden state. Poker is the proof of concept; the primitives are reusable.

## What you build

A `PokerGame` contract implementing `privacy_invoke` for deal/bet/fold/reveal/settle. Cards are encrypted STRK20 notes that decrypt only with the player's channel key. Ship with the trusted-dealer shuffle first (STARK-proven from a committed seed - strictly better than every existing platform). V2 explores Noir + Garaga mental poker for heads-up games where the proving overhead is tolerable.

## The "only on Starknet" showcase

Encrypted notes as cards, channels as player relationships, session keys for gameplay (sign in once, play for hours, scoped permissions), paymaster for gasless UX, STARK proofs for dealing fairness. Every core primitive of STRK20 works together in one application that literally cannot exist on any other chain.

## Hidden vs visible

| Element | Hidden | Visible |
| --- | --- | --- |
| Player identities | Yes - paymaster submits all tx | |
| Hole cards | Yes - encrypted notes, only the holder decrypts | |
| Bet amounts | | Yes - poker bets are public by design |
| Stack sizes, session history | Yes - held as private notes | |
| Showdown reveals | | Yes - selective reveal of channel keys at hand end |

**URL:** https://strk20.starknet.io/rfp/private-poker · **Category:** Gaming

---

# Trustless, atomic, private OTC settlement for large block trades

Two counterparties agree off-chain, settle on-chain through the privacy pool: no intermediary holds funds, no counterparty risk, and neither party's identity is linked to the trade. 5–15bps per side undercuts every desk in the market.

## What this enables

- →**Trustless large block trading.** FTX and Genesis were both OTC desks that went bankrupt with client funds. This removes the intermediary entirely - atomic settlement via a verifiable Cairo contract, no admin keys.
- →**Privacy that institutions can actually use.** Both parties generate viewing-key trade confirmations for their compliance teams. The auditing entity can trace specific trades under legal process. Privacy through cryptography, not through opacity.
- →**Fee compression for the OTC market.** Traditional desks charge 10–50bps for matching, custody, and settlement. STRK20 OTC automates the last two. Fees collapse to 5–15bps - the cost of matching alone.
- →**Channel-based counterparty relationships.** A market maker with 50 regular counterparties has 50 encrypted, persistent channels. Subsequent trades are frictionless: no new on-chain setup, no re-KYC, no address leakage.

## What you build

An `OTCSettlement` helper contract with a two-leg fill pattern: seller fills leg A, buyer fills leg B in the matching transaction, settlement is atomic on leg B (verify, fee, distribute via `open_note_deposit`, mark settled). Timeout-and-reclaim for the cancel path. Counterparty discovery is a separate layer - start with off-chain matching (Telegram/Discord OTC groups), extend to on-chain encrypted intent boards or automated RFQ later.

## Hidden vs visible

| Element | Hidden | Visible |
| --- | --- | --- |
| Both parties' identities | Yes - paymaster submits, no address link | |
| The relationship between them | Yes - channels are encrypted | |
| Trade amounts, token pair | | Both parties already know - open notes are plaintext |
| That an OTC trade occurred | | Yes - deposits to and distributions from the helper |
| Compliance history | Selectively - via each party's own viewing key | Not public |

## Why it ships

The privacy pool already provides the three things traditional OTC desks charge for: privacy (cryptographic, not opacity-based), settlement (atomic, no human in the loop), and compliance (selective disclosure via viewing keys). The desk's value collapses to matching - everything else is better done by the protocol.

**URL:** https://strk20.starknet.io/rfp/private-otc-settlement · **Category:** Markets & Trading

---

# Bonding-curve token launches with hidden buyers, visible price action

A Pump.fun-style launchpad where bonding-curve mechanics, trade sizes, and the social feed stay fully visible - but no observer can attribute any trade to any wallet. Whales buy without triggering copy-trade cascades; devs sell without panic dumps.

## What this enables

- →**Whale-safe token launches.** A 50K USDC buy is visible. The price impact is visible. The buyer is not. No Nansen alert. No "smart money" notification. No copy-trade cascade.
- →**Dev-safe token creation.** Creators launch without their wallet becoming a permanent surveillance target. Sells show on the curve (price drops); attribution to the dev wallet does not.
- →**Anonymous participation across launches.** Users participate in dozens of launches without building a trackable on-chain profile. No wallet-level history for analytics to aggregate.
- →**Post-graduation privacy continuity.** When a token graduates to Ekubo, the existing swap helper keeps trading private. Full lifecycle anonymity - no other chain offers this.

## What you build

A `BondingCurveFactory` deploying per-token curves. Each curve is a `privacy_invoke` helper handling buy / sell / graduate. Buyers route USDC notes through the pool, the curve computes tokens-out, returns them as an `OpenNoteDeposit`. At market-cap threshold, anyone calls `graduate` and liquidity migrates to Ekubo with the curve's final price. The social feed reads public events (amounts, timestamps, price) - just no "who."

## What it doesn't solve

Sniping. Bots that monitor for new contract deployments still work - they don't need to know who you are to front-run. Anti-snipe (launch delay, commit-reveal first block, rate limits, graduated fees) is layered on top as optional modules.

## The revenue argument

Pump.fun does $25–31M/month in fees even in bear markets. A Starknet version capturing 1% of the memecoin launch market is $250–310K/month. The privacy angle attracts the segment most willing to pay premium fees for anonymity - whales, alpha hunters, sensitive creators.

## Hidden vs visible

| Element | Hidden | Visible |
| --- | --- | --- |
| Buyer / seller identity | Yes - paymaster submits all tx | |
| Trade amounts | | Yes - open notes are plaintext |
| Price, market cap, supply | | Yes - bonding curve state is public |
| Dev token holdings | Yes - encrypted notes in the pool | |
| Total volume, trade history | | Yes (aggregate) - but not attributable |

**URL:** https://strk20.starknet.io/rfp/private-pumpfun · **Category:** Markets & Trading

---

# Anonymous whistleblower platform with proof-of-authorship

Anyone can submit anonymous reports to registered organizations with cryptographic guarantees that the reporter's identity cannot be discovered - and later prove authorship for rewards or legal protection without disclosing their identity. Math, not policy.

## What this enables

- →**Whistleblowing without infrastructure.** SecureDrop costs $10K–50K per organization to operate (dedicated servers, Tor hidden services, air-gapped admin machines). This is one shared smart contract. Any DAO, small newsroom, nonprofit, or compliance department can accept anonymous tips - not just the few who can afford SecureDrop.
- →**Proof of authorship that protects first.** Whistleblower protection laws (Dodd-Frank, EU Directive 2019/1937) currently require identifying yourself to claim protection. STRK20 lets reporters prove authorship cryptographically without revealing their identity until they choose to. Novel: no existing system offers both.
- →**Reward collection without identity exposure.** The SEC has paid $1.8B in whistleblower rewards since 2012; every recipient had to identify themselves. STRK20 rewards arrive as private transfers in the existing channel. Authorship proves itself; identity stays hidden.
- →**Dead man's switch for sensitive disclosures.** Time-locked public disclosure: "I've submitted evidence. If I'm silenced, it publishes automatically." Whistleblowing becomes protective rather than exposing.
- →**Anonymous source-journalist comms.** Persistent encrypted channels for ongoing reporting - a meaningful upgrade over Signal (requires phone numbers), SecureDrop (Tor, server state), and email (leaks everywhere).

## What you build

A registry contract for organizations to publish their address + public key. A submission flow that creates fresh recipient addresses, opens channels via `OpenChannel`, encrypts report content to IPFS/Arweave, and references the encrypted payload in an on-chain note. A discovery flow for organizations to find reports via their viewing key. An authorship-proof primitive (channel-key disclosure or Cairo STARK proof) for selective reveal to lawyers, reward committees, or courts.

## vs SecureDrop

| Property | SecureDrop | STRK20 Whistleblower |
| --- | --- | --- |
| Infrastructure | Per-org servers, Tor, air-gapped machines | One shared smart contract |
| Anonymity mechanism | Tor (network-level) | Privacy pool + paymaster (cryptographic) |
| Proof of submission | None | STARK proof anytime, selective |
| Follow-up communication | Codename-based, stateful server | Persistent encrypted channel |
| Reward payout | Off-chain, identity disclosure required | Private transfer in the channel |
| Compromise resistance | Server compromise leaks metadata | No server. Contract state is encrypted. |

**URL:** https://strk20.starknet.io/rfp/anonymous-whistleblower · **Category:** Social & Communications

---

# One-click privacy from any chain - Starknet as the privacy layer of crypto

Any user on Ethereum, Base, Arbitrum, or Solana gets one-click access to STRK20 privacy - without learning Starknet, installing a new wallet, or holding STRK. Bridge in, hold private, withdraw to any chain with zero on-chain link.

## What this enables

- →**Starknet as the privacy layer of crypto.** Users come from every chain, pool their anonymity set, leave to any chain. The larger the pool gets, the stronger every individual's privacy. Network effects compound - more users → stronger privacy → more users.
- →**Privacy for non-Starknet users.** The vast majority of crypto users are on Ethereum, Solana, Base, Arbitrum. They don't want to learn a new chain. This abstracts all of it: connect existing wallet, get privacy, leave to any chain. Starknet is the engine, not the destination.
- →**Cross-chain link breaking.** Deposit on chain A, withdraw on chain B, no on-chain connection. Useful for portfolio restructuring, post-CEX-withdrawal privacy, multi-chain DeFi privacy, fresh starts for surveilled wallets.
- →**Compliance-compatible.** Unlike Tornado Cash (OFAC-sanctioned), this has a compliance path: viewing-key registration, auditable trace under legal process, self-disclosure for tax reporting. Confidentiality from public surveillance - not sanction evasion.

## The growth lever

Starknet has ~20K DAU. Ethereum has ~400K. Base has ~2M. Solana has ~1.5M. The strongest path to a meaningful anonymity set isn't growing Starknet's user base 10× - it's tapping the existing users on other chains. Cross-chain privacy access does both at once: brings users and their assets into the pool, generates bridge + pool fees, grows the anonymity set.

## What you build

A `PrivacyHub` helper contract that orchestrates bridge → shield → unshield → bridge. Source-chain UX wraps existing bridges (StarkGate, LayerSwap, Orbiter). Deterministic Starknet account generation from any chain's wallet (already shipped via `earn-contracts` for cross-chain yield - reused here for privacy onboarding). The user signs with MetaMask / Phantom; the rest is automated.

## User mental model

> "I have 10 ETH on Arbitrum. I want to send 5 ETH to a fresh address without anyone linking the two."

1. →Connect Arbitrum wallet
2. →Select 10 ETH → "Make Private"
3. →Wait ~2 minutes
4. →"10 ETH (private)" in dashboard
5. →Later: "Withdraw" → enter a Base address → receive ETH on Base, no link to the source

The user never thinks about Starknet.

**URL:** https://strk20.starknet.io/rfp/cross-chain-privacy-hub · **Category:** Infrastructure

---

# Prediction markets with visible odds and invisible bettors

Bet sizes and odds stay fully visible - the information aggregation works. Bettor identities are completely hidden. Markets stay informationally efficient while the identity-based manipulation that plagues Polymarket disappears.

## What this enables

- →**Informationally efficient markets without identity leakage.** Polymarket's accuracy comes from visible bet flow driving accurate odds. The same visibility creates whale tracking, herding, and bettor pressure. Academic research shows anonymous betting produces _more_ accurate forecasts - bandwagoning is replaced with independent information aggregation.
- →**Institutional prediction markets.** Corporations want internal forecasting markets (project completion, strategic decisions, sales targets) but can't because positions become political. An executive betting against their own division's timeline is a career risk. Anonymous betting unlocks the use case entirely.
- →**Political and sensitive markets, less regulatory exposure.** France blocked Polymarket. The CFTC has taken enforcement actions. Visible large positions on political outcomes create narratives that influence the outcomes themselves. Anonymous betting separates information aggregation from attribution.
- →**Cross-market privacy for professional bettors.** Polymarket lets sophisticated observers build wallet-level profiles: hit rate, sector specialization, holding patterns. Professional edge gets copied. STRK20 prevents the profiling.

## What you build

A `PredictionMarket` helper with per-question state (outcomes, resolution source, deadline, per-outcome volume) and `privacy_invoke` for bet / claim. Bets are open notes to the market contract (amounts public, identity hidden via paymaster). Resolution writes the winning outcome; winners claim payouts as private transfers. Per-market oracle binding (Pragma for prices, designated resolver or DAO vote for non-price outcomes).

## Why this works on Starknet specifically

Compliance-first privacy (viewing keys make it auditable), DeFi composability in the pool (open notes + `InvokeExternal`), production paymaster + session keys. Other privacy chains lack at least one of these - and the lack of any one breaks the institutional use case.

## Hidden vs visible

| Element | Hidden | Visible |
| --- | --- | --- |
| Bettor identity | Yes - paymaster submits all tx | |
| Bet amounts | | Yes - open notes, drives accurate odds |
| Current odds, per-outcome volume | | Yes - public market state |
| Resolution | | Yes - verifiable from oracle / resolver |
| Bettor's cross-market profile | Yes - no wallet-level history accumulates | |

**URL:** https://strk20.starknet.io/rfp/private-prediction-market · **Category:** Markets & Trading

---

# Sealed-bid auctions where the bids are actually sealed

Bids are encrypted STRK20 notes - invisible to everyone, including the auctioneer, until reveal. First-price, second-price Vickrey, and multi-unit auctions, all with cryptographic bid sealing that's impossible on any transparent chain.

## What this enables

- →**Economically optimal auctions on-chain.** Vickrey (second-price sealed-bid) is the gold standard of auction theory - bidding your true value is dominant strategy, allocations are efficient, revenue is fair. Known since 1961 but never deployable on-chain because sealed bids were impossible without a trusted auctioneer. STRK20 makes them native.
- →**NFT auctions without sniping or manipulation.** Bots sniping last-second bids? Irrelevant when all bids are submitted before the deadline. Wash bidding? Now requires actually locking funds _and_ being the second-highest bidder. Whale intimidation? Impossible - nobody sees anyone else's bid.
- →**DAO grant allocation that ends anchoring.** Projects submit sealed funding requests; the DAO reveals simultaneously and funds from the lowest ask. No anchoring on Project A's number when Project B writes theirs. No social pressure, no gaming.
- →**Protocol parameter auctions.** Block space, sequencer priority, MEV-style auctions allocated by sealed-bid Vickrey instead of speed-based first-come-first-served. The fastest bot stops winning; the highest-value buyer does.
- →**Institutional M&A and RWA.** Real estate, business acquisitions, art - all conducted via sealed-bid auctions in traditional finance. Bringing them on-chain requires actually-sealed bids, not commit-reveal with griefing risk.

## What you build

An auction protocol with three phases: listing (auctioneer creates parameters), bidding (bidders submit encrypted notes - real escrowed funds, not just commitments), reveal (selective disclosure of bid amounts via viewing key material - revealed amounts must match the encrypted notes, or the bid is forfeit). Force-reveal via threshold auditing if a bidder goes offline. Support first-price, Vickrey, and multi-unit variants on the same contract.

## Why this isn't just commit-reveal

| Approach | Problem |
| --- | --- |
| Commit-reveal | Bidders grief by not revealing. Timing leaks info. Gas friction. |
| Timelock encryption | Trusted timelock servers. Approximate decryption time. |
| Threshold MPC | Committee can collude. Setup ceremony is complex. |
| Trusted auctioneer | Server sees everything. No improvement over off-chain. |
| **STRK20 encrypted notes** | **Real locked funds, no trusted party, no committee, no timing assumption.** |

**URL:** https://strk20.starknet.io/rfp/sealed-bid-auctions · **Category:** Markets & Trading

---

# On-chain Among Us with provably fair roles and anonymous votes

A fully on-chain social deduction game - hidden roles as encrypted notes, night actions as private transfers, voting as anonymous channel transfers. No server can leak roles, no admin can peek, vote tallies are provably correct.

## What this enables

- →**Provably fair social deduction.** Every existing Mafia / Werewolf / Among Us game has the same trust problem: the server knows everything. Role assignment, night actions, vote counts - all opaque. STRK20 replaces the server with a smart contract that can't cheat, can't be bribed, and can't play favorites.
- →**Anonymous voting that changes the metagame.** In every existing social deduction game, voting is public or semi-public - which produces degenerate strategies (retaliation, bandwagoning, anchoring by vocal players). Anonymous voting eliminates all of them. The game becomes purer: it shifts from "manipulate voting behavior" to "evaluate evidence."
- →**Staked competitive play.** A new category: competitive social deduction with real stakes and cryptographic integrity. Buy in with shielded STRK20, play with provable fairness, win on skill, receive winnings privately. Doesn't exist anywhere today.
- →**A platform for the whole genre.** Role assignment + private actions + anonymous voting generalizes - Secret Hitler, Avalon, Blood on the Clocktower, Coup, One Night Werewolf. The Phase 1 contract is a platform; each variant is a different configuration.

## What you build

A game contract managing lobbies, role assignment (STARK-proven from committed seed), turn progression, and resolution. Roles are encrypted STRK20 notes - only the holder decrypts. Night actions (impostor "kills," seer "checks") are private transfers in player-to-game channels. Emergency voting is anonymous channel transfers - vote tally computed publicly, votes themselves unattributable. Session keys for scoped per-game permissions; paymaster so players never sign or pay gas during a round.

## Why this is the killer app argument

Privacy tech needs applications that people actually want to use, not just power-user tools. Social deduction is:

- →**Massively popular** - Among Us peaked at 500M MAU.
- →**Naturally multiplayer** - 5–15 players per round, organic network effects.
- →**Session-based** - 15 minutes, low commitment, high engagement.
- →**Improved by privacy**, not just compatible with it - anonymous voting is a genuine gameplay improvement, not a feature bolted on.

**URL:** https://strk20.starknet.io/rfp/social-deduction-game · **Category:** Gaming

---

# An Umbra-style privacy wallet for Starknet

A wallet that delivers the Umbra UX - publish once, receive privately, spend freely - fully powered by the existing STRK20 privacy pool. No protocol changes. The hard parts are already shipped; what's missing is the UI.

## What this enables

- →**Umbra-grade UX on a stronger foundation.** Umbra on Ethereum hides the recipient behind a one-time stealth address. STRK20 hides the recipient, the sender, the amount, _and_ the token type - all inside encrypted pool storage. Stronger privacy by default; better UX with the right wallet on top.
- →**A real consumer entry point to STRK20.** Right now the privacy pool is accessed via SDK calls. A privacy-first wallet is the user-facing product that brings the rest.
- →**One-key registration.** Umbra requires a 2-key stealth meta-address. STRK20 needs one viewing-key registration. Smaller surface, simpler onboarding.

## Why STRK20 beats Umbra structurally

| Umbra concept | STRK20 equivalent | Advantage |
| --- | --- | --- |
| Stealth meta-address (2 public keys) | Registered viewing key | One key, on-chain, simpler |
| Per-payment stealth address | Per-channel encrypted notes | No visible on-chain address at all |
| Announcement events for scanning | Discovery service | Off-chain scan - no public event trail |
| View-tag filtering | Full ECDH decryption | Discovery handles compute; no shortcuts |
| Relayer for gas-free withdrawals | Pool-mediated withdrawals | Pool is the caller - no separate relayer |
| Anonymity set = stealth users | Anonymity set = all pool participants | Shared pool with transfers and apps, not stealth-only |

## What you build

A Starknet wallet (browser + mobile) that:

- →Generates and registers viewing keys on first use.
- →Lets the user publish a privacy-pool receive address that anyone can pay to.
- →Runs the discovery service against the user's viewing key to surface incoming notes.
- →Handles sends as `Withdraw` / `CreateEncNote` through the pool with paymaster-sponsored gas.
- →Maintains a clean, "looks like a wallet, behaves like privacy" UI - the discovery, encryption, and proof-construction is all under the hood.

No new contracts. No protocol changes. The work is product, UX, and SDK integration.

## Why it ships

Everything cryptographic is already in production: the pool, channels, the discovery service, the SDK. What's missing is the consumer surface - a wallet that makes private receive-and-spend feel as easy as Venmo. Whoever builds it owns the default entry point to STRK20 for normal users.

**URL:** https://strk20.starknet.io/rfp/privacy-wallet · **Category:** Infrastructure

---

# Private payroll and treasury disbursement at company scale

A payroll protocol where per-recipient amounts stay private from each other and from the public, but the payer can prove aggregate spend to auditors and each recipient can prove income for tax filings. The compliance model traditional payroll uses, brought onchain without a centralized intermediary.

## What this enables

- →**Onchain companies that can compete for senior talent.** The single largest barrier to crypto-native companies hiring senior engineers and execs is salary visibility. Today a candidate's choice is "compensation public on the internet" or "take the Web2 offer." STRK20 closes the gap - onchain payroll handled exactly as any traditional employer handles it.
- →**Vesting without front-running.** Token vesting unlocks are the most reliably gamed events in crypto. Markets price in the dump weeks ahead. Founders get accused of dumping before they've sold anything. Private vesting lands tokens in encrypted notes; the schedule is enforced on-chain but the amounts and timing of recipient sells aren't public.
- →**DAO treasury confidentiality with public accountability.** Aggregate spend is visible ($847K to 73 contributors this quarter, on-chain verifiable). Per-recipient breakdown is encrypted. A governance committee with viewing-key access can verify the split. First treasury model that doesn't force a choice between public accountability and internal cohesion.
- →**Contractor and grant networks without recipient doxxing.** Crypto gig platforms pay thousands of contributors in public transactions. Top earners get profiled, recruiters scrape leaderboards, phishers target high-value addresses. STRK20 keeps the rails public-accountable while taking the contributor base off the surveillance target list.
- →**Compliance that tax authorities already understand.** Confidential from the public, fully disclosed to the tax authority - the W-2 / P60 / T4 model. Each recipient generates a viewing-key-derived income statement; the payer generates the full payroll book. Cryptographic proof of completeness; no fabrication, no omission.

## What you build

A `Payroll` helper contract managing recurring (payer, recipient) channels. Batched disbursement transactions (one tx, 50 recipients). Vesting schedules with on-chain enforcement and private amounts. Termination as a recorded-on-chain event with no public disclosure. Admin tooling (session-key scoped to a payroll cycle's budget) and the recipient discovery experience (paymaster-sponsored - no recipient signature ever required).

## Why this isn't Sablier or Vesting.so

Both put schedules on public ledgers. Stream rate equals salary divided by duration - the math is trivial; zero privacy improvement. Vesting.so publishes cliff dates and amounts; markets dump ahead of every unlock. STRK20 inherits the channel + viewing-key model: the schedule is on-chain and enforced, but its parameters are encrypted to the parties and the auditing entity.

## Why this isn't Deel-style centralized payroll

Centralized payroll services solve privacy by being the centralized intermediary. They see everything, hold the relationship, can be subpoenaed, hacked, or shut down. STRK20 splits the trust: cryptographic on the rails, cryptographic on the compliance disclosure. No intermediary holds the data.

**URL:** https://strk20.starknet.io/rfp/private-payroll · **Category:** Payments & Money

---

# Private subscriptions and creator monetization with Web2-grade UX

Recurring private payments from subscribers to creators - gas-sponsored, set-and-forget, with subscriber identity cryptographically hidden. Tier-gated access via STARK proofs, not wallet scanning. The onchain Patreon that finally works.

## What this enables

- →**Sensitive-content creator economies, onchain for the first time.** OnlyFans alone processed $6.6B in 2023 with a subscriber base that depends on absolute privacy from spouses, employers, family. No fraction of this market moves to a public-ledger subscription system. STRK20 opens the entire category - sex work, drug-policy advocacy, mental health, dissident journalism, sex education in restrictive jurisdictions.
- →**"Set and forget" UX that matches Web2.** Session keys (one-time authorization), keepers (automatic charging), paymaster (no gas surprises), natural expiry (graceful end-of-subscription). First onchain primitive that actually resembles Web2 subscription UX, with the added property that the authorization is auditable, time-bounded, and unilaterally revocable by the subscriber.
- →**Creator confidentiality from competitors.** Every existing onchain creator platform exposes per-creator revenue. Rivals benchmark and copy pricing; would-be competitors target high-revenue creators; sponsors negotiate from informational asymmetry. STRK20 puts creator analytics behind the viewing key - same posture as Patreon and OnlyFans.
- →**Tier-gated access without surveillance.** Today, "is this user a $50/mo subscriber?" requires scanning the creator's wallet - a public surveillance act that doxes both parties. Token-gating replaces scanning with a public token-holdings list (same surveillance, different form). STRK20 replaces both with a STARK proof: "I have an active $50/mo subscription to creator C, expiring after D." Discord bot, Telegram gate, or software license verifies the proof and learns nothing else.
- →**Compliance with FTC "click to cancel" and equivalents.** Cancellation is a single session-key revocation. The helper records it. The creator cannot continue charging - structurally compliant by design, meaningfully easier than the Web2 platforms repeatedly hit with FTC enforcement.

## What you build

A `Subscriptions` helper contract managing (subscriber, creator) channels, session-key-authorized recurring charges, keeper-driven charge execution, and cancellation via revocation. A creator-side dashboard (active subscribers, MRR, churn, LTV - all derived from the creator's viewing key, all private to them). A tier-proof verifier library that Discord/Telegram/SaaS gates can drop in. Optional public aggregate counters (total subscriber count, opt-in MRR) for creators who want to show traction without exposing per-tier breakdown.

## Why prior onchain subscriptions died

Mirror, Paragraph, Lens, Solana Pay subscriptions, Unlock Protocol, Sablier-as-subscriptions - all credible attempts, all stalled. Every one forced a trade between subscriber privacy, clean cancellation UX, and creator verifiability. Streaming contracts approximate auto-charge but break on cancellation. Token-gated memberships work for access but dox membership. Session keys + channels resolve the trade - first time the structural pieces line up.

**URL:** https://strk20.starknet.io/rfp/private-subscriptions · **Category:** Payments & Money

---
