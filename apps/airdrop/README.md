# Anonymous Airdrop

A web app for distributing ERC-20 tokens privately on Starknet using the [Starknet Privacy SDK](https://github.com/starkware-libs/starknet-privacy). The sender deposits tokens into a privacy pool, transfers them privately to recipients, and recipients discover and withdraw their tokens. The sender-to-recipient link is cryptographically hidden on-chain.

## How It Works

```
PUBLIC                          PRIVATE (inside pool)                PUBLIC
------                          ----------------------               ------

1. Sender deposits tokens  -->  2. Private transfers to recipients   3. Recipients withdraw
   (visible on-chain)              (encrypted, unlinkable)              (visible on-chain)
```

- **Sender** loads a recipient list, clicks "Execute Airdrop", and the app handles: ERC-20 approve, deposit into pool, wait for note maturity, then transfer to each recipient.
- **Recipients** register their viewing key in the pool, then discover and withdraw their tokens.
- On-chain observers cannot link any withdrawal back to the sender's deposit.

## Prerequisites

- Node.js 20+
- Access to a Starknet RPC node, privacy pool contract, proving service, and discovery service
- The Starknet Privacy SDK must be built locally (this app links to it via `file:../../sdk`)

## Setup

### 1. Build the SDK

From the repo root:

```bash
cd sdk
npm install
npm run build
cd ..
```

### 2. Install airdrop app dependencies

```bash
cd apps/airdrop
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

| Variable | Description |
|---|---|
| `VITE_RPC_URL` | Starknet RPC endpoint |
| `VITE_PROVING_SERVICE_URL` | Proving service URL (generates STARK proofs) |
| `VITE_INDEXER_URL` | Discovery service URL (finds encrypted notes) |
| `VITE_POOL_ADDRESS` | Privacy pool contract address |
| `VITE_TOKEN_ADDRESS` | ERC-20 token to airdrop |
| `VITE_FEE_TOKEN_ADDRESS` | Fee token address (STRK) |
| `VITE_CHAIN_ID` | Starknet chain ID (hex-encoded) |
| `VITE_PROOF_VALIDITY_BLOCKS` | Proof validity window (default: 450) |
| `VITE_AIRDROP_RECIPIENTS` | Optional pre-loaded recipient list (JSON array) |

### 4. Load accounts

Accounts are loaded via a base64-encoded URL parameter. Generate a URL with your accounts:

```bash
node -e "
const accounts = [
  { name: 'Alice', address: '0x...', privateKey: '0x...', viewingKey: '0xA11CE' },
  { name: 'Bob', address: '0x...', privateKey: '0x...', viewingKey: '0xB0B' }
];
console.log('http://localhost:5173/?accounts=' + Buffer.from(JSON.stringify(accounts)).toString('base64'));
"
```

Open the generated URL in your browser. Accounts are saved to localStorage after the first load.

**Account fields:**

| Field | Description |
|---|---|
| `name` | Display name |
| `address` | Starknet account address |
| `privateKey` | Account private key (for signing transactions) |
| `viewingKey` | Privacy viewing key (for encrypting/decrypting notes). Must be non-zero. |
| `admin` | (Optional) `true` for the governance admin account (used for minting test tokens) |

### 5. Run the app

```bash
npm run dev
```

Open the URL shown in the terminal (default: `http://localhost:5173`).

## Usage

### Sending an Airdrop

1. Select an account with a valid viewing key and tokens
2. Click **Send Airdrop**
3. Edit the recipient list (or paste CSV in `address,amount` format)
4. Click **Execute Airdrop**

The app will:
- Check if you have enough private balance (deposits more if needed)
- Approve the pool to spend your tokens (if depositing)
- Deposit tokens into the privacy pool
- Wait for note maturity (10 blocks)
- Transfer privately to each recipient

If batch transfer fails, it falls back to individual transfers with a maturity wait between each.

### Claiming an Airdrop

1. Select your account
2. Click **Claim Airdrop**
3. If not registered, click **Register in Pool** (one-time, publishes your viewing key)
4. Your private balance and notes appear after discovery
5. Enter an amount and click **Withdraw** to move tokens back to your public wallet

### Pre-flight Checks

Before executing an airdrop, the app verifies:
- Sender is registered in the pool
- All recipients are registered (shows which ones aren't)
- Recipient addresses are valid and amounts are positive
- Total amount doesn't exceed sender's public ERC-20 balance

## Architecture

```
apps/airdrop/
  src/
    App.tsx                    # Root: account selector + mode toggle
    config.ts                  # Env var parsing, recipient config
    starknet.ts                # Provider, account, SDK factory helpers
    proof-provider.ts          # Mock proof provider for dev
    format.ts                  # Address truncation, chain ID formatting
    hooks/
      useAccounts.ts           # Account loading from URL params / localStorage
      useAirdrop.ts            # Core: approve -> deposit -> maturity -> transfer
      useClaimant.ts           # Note discovery + registration + withdrawal
    components/
      AdminPanel.tsx           # Recipient list + balance + execute button
      ClaimantPanel.tsx         # Registration + balance + withdraw
      RecipientList.tsx         # Editable table with CSV paste + validation
      AirdropProgress.tsx       # Phase display + per-recipient status
      StatusBar.tsx             # Transaction hash / error display
```

## Privacy Model

| Step | Visible on-chain | Hidden |
|---|---|---|
| Deposit | Who deposited, how much | Note contents (encrypted) |
| Transfer | Nullifiers, encrypted channels/notes | Recipients, amounts, token type, link to deposit |
| Withdraw | Who received, how much | Which note was spent, who originally sent the tokens |

The privacy depends on the **anonymity set** -- more users in the pool makes correlation between deposits and withdrawals harder.

## Testnet (Sepolia)

The `.env.example` is pre-configured for the Starknet Privacy testnet on Sepolia with:
- Pre-deployed pool contract
- Proving and discovery services
- Test accounts (Admin, Alice, Bob, Charlie)
- Test token (strkBTC)

## Built With

- [Starknet Privacy SDK](https://github.com/starkware-libs/starknet-privacy) -- private transfers on Starknet
- [starknet.js](https://github.com/starkware-libs/starknet.js) -- Starknet JavaScript library
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
