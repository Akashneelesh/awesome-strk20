# Anonymous Airdrop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone web app that lets an admin privately airdrop ERC-20 tokens to a list of recipients via the Starknet Privacy SDK, with a claimant view for discovering and withdrawing tokens.

**Architecture:** Vite + React + TypeScript app in `apps/airdrop/`. Imports the privacy SDK via `file:../../sdk`. Two views: admin panel (recipient list editor + one-click airdrop execution) and claimant panel (note discovery + withdrawal). Smart batching attempts one batch transaction, falls back to individual transfers on failure.

**Tech Stack:** React 19, TypeScript, Vite, starknet.js (privacy fork), starknet-sdk

---

## File Map

| File | Responsibility |
|---|---|
| `apps/airdrop/index.html` | HTML shell |
| `apps/airdrop/package.json` | Dependencies and scripts |
| `apps/airdrop/tsconfig.json` | TypeScript config |
| `apps/airdrop/vite.config.ts` | Vite config with SDK alias |
| `apps/airdrop/.env.example` | Documented env template |
| `apps/airdrop/src/main.tsx` | React entry point |
| `apps/airdrop/src/config.ts` | Env var parsing, account/recipient config types |
| `apps/airdrop/src/starknet.ts` | Provider, account, transfers, ERC-20 balance helpers |
| `apps/airdrop/src/proof-provider.ts` | NoValidateProofProvider for mock proving |
| `apps/airdrop/src/format.ts` | Address truncation, chain ID formatting |
| `apps/airdrop/src/App.tsx` | Root component: account selector + admin/claimant routing |
| `apps/airdrop/src/hooks/useAccounts.ts` | Account loading from URL params / localStorage |
| `apps/airdrop/src/hooks/useAirdrop.ts` | Admin airdrop lifecycle: approve → deposit → wait → batch transfer |
| `apps/airdrop/src/hooks/useClaimant.ts` | Claimant note discovery + withdrawal |
| `apps/airdrop/src/components/AdminPanel.tsx` | Admin view: recipient list + airdrop button + progress |
| `apps/airdrop/src/components/ClaimantPanel.tsx` | Claimant view: balance + notes + withdraw |
| `apps/airdrop/src/components/RecipientList.tsx` | Editable recipient table with validation |
| `apps/airdrop/src/components/AirdropProgress.tsx` | Phase display + per-recipient status during execution |
| `apps/airdrop/src/components/StatusBar.tsx` | Transaction hash / error display |

---

### Task 1: Project Scaffold

**Files:**
- Create: `apps/airdrop/index.html`
- Create: `apps/airdrop/package.json`
- Create: `apps/airdrop/tsconfig.json`
- Create: `apps/airdrop/vite.config.ts`
- Create: `apps/airdrop/.env.example`
- Create: `apps/airdrop/src/main.tsx`

- [ ] **Step 1: Create `apps/airdrop/package.json`**

```json
{
  "name": "anonymous-airdrop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "starknet": "github:starkware-libs/starknet.js#PRIVACY-0.14.2-RC.2",
    "starknet-sdk": "file:../../sdk"
  },
  "overrides": {
    "starknet": "$starknet",
    "rollup": ">=4.59.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.4",
    "@types/react-dom": "^19.1.5",
    "@vitejs/plugin-react": "^4.5.2",
    "typescript": "^5.9.3",
    "vite": "^6.3.5"
  }
}
```

- [ ] **Step 2: Create `apps/airdrop/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/airdrop/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const sdkDist = resolve(__dirname, "../../sdk/dist");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "starknet-sdk/dist/testing/mock-proving.js": resolve(
        sdkDist,
        "testing/mock-proving.js",
      ),
      "starknet-sdk/dist/internal/indexer-discovery.js": resolve(
        sdkDist,
        "internal/indexer-discovery.js",
      ),
    },
  },
});
```

- [ ] **Step 4: Create `apps/airdrop/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Anonymous Airdrop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/airdrop/.env.example`**

```bash
VITE_RPC_URL=http://34.170.198.113:9545/rpc/v0_10
VITE_PROVING_SERVICE_URL=http://34.29.249.119:3000
VITE_INDEXER_URL=http://35.192.48.142:8080
VITE_POOL_ADDRESS=0xd894af9ed2bdede33675049ae5285df000c44258a2250b84a9c3bed0d7c233
VITE_TOKEN_ADDRESS=0x45060889ad33e70531ae2683046bb9b0d7c8199fccd9acd544170a42b0a0fd0
VITE_FEE_TOKEN_ADDRESS=0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
VITE_CHAIN_ID=0x534e5f5345504f4c4941
VITE_PROOF_VALIDITY_BLOCKS=450
ACCOUNTS=[{"name":"Admin","address":"0x048baf3ed1f0a03840186bd95063f63824d93bafd456439bfe667533437d9c91","privateKey":"0x7021e74994902199b1fa41785e15ade56f3ba5d208818b620a3741e68845d94","viewingKey":"0x0","salt":"0xd6ed33c9490da390","admin":true},{"name":"Alice","address":"0x041c9dbe8ab9b414fa0ec4d22b7a41d80a3911b77a2c9c819ce949faa5edb9f9","privateKey":"0x254055e37555fd981daf35700e046e42980f4e041d7aaec4886c0c1a46a07","viewingKey":"0xA11CE","salt":"0x20c957f4e4971084"},{"name":"Bob","address":"0x05499b2112812a5437837750d27131f2de280531fb066a290269f77922fc3f97","privateKey":"0x13034027ffd68fc59cac2f7854d53eebcb7287f2dcd44231f2585967ad08f62","viewingKey":"0xB0B","salt":"0xb778e4dd8399c42f"},{"name":"Charlie","address":"0x7e5da3b8377dcd5aecff07fa660c7f933e7f3896dc994c03542304bba762877","privateKey":"0x35936ff2016465492ef9f69f8327e458b826d93ce1663cd6056f676c569f8ac","viewingKey":"0xC4A711E","salt":"0xb22ff9651e0e4cde"}]
VITE_AIRDROP_RECIPIENTS=[{"address":"0x041c9dbe8ab9b414fa0ec4d22b7a41d80a3911b77a2c9c819ce949faa5edb9f9","amount":"500"},{"address":"0x05499b2112812a5437837750d27131f2de280531fb066a290269f77922fc3f97","amount":"300"}]
```

- [ ] **Step 6: Create `apps/airdrop/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Install dependencies and verify build scaffold**

```bash
cd apps/airdrop && npm install
```

Expected: `node_modules/` created, no errors. The app won't build yet (no `App.tsx`), but dependencies resolve.

- [ ] **Step 8: Commit**

```bash
git add apps/airdrop/index.html apps/airdrop/package.json apps/airdrop/tsconfig.json apps/airdrop/vite.config.ts apps/airdrop/.env.example apps/airdrop/src/main.tsx apps/airdrop/package-lock.json
git commit -m "feat(airdrop): scaffold project with vite + react + sdk dependencies"
```

---

### Task 2: Config, Starknet Helpers, and Format Utilities

**Files:**
- Create: `apps/airdrop/src/config.ts`
- Create: `apps/airdrop/src/starknet.ts`
- Create: `apps/airdrop/src/proof-provider.ts`
- Create: `apps/airdrop/src/format.ts`

- [ ] **Step 1: Create `apps/airdrop/src/config.ts`**

Adapted from `demo/src/config.ts` with added `RecipientConfig` and `loadRecipients()`.

```typescript
import type { constants } from "starknet";

export type AccountConfig = {
  name: string;
  address: string;
  privateKey: string;
  viewingKey: string;
  admin?: boolean;
};

export type RecipientConfig = {
  address: string;
  amount: string;
};

export type AppConfig = {
  rpcUrl: string;
  indexerUrl: string;
  poolAddress: string;
  tokenAddress: string;
  feeTokenAddress: string;
  chainId: constants.StarknetChainId;
  provingServiceUrl?: string;
  proofValidityBlocks: string;
};

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value as string;
}

export function loadConfig(): AppConfig {
  return {
    rpcUrl: requireEnv("VITE_RPC_URL"),
    indexerUrl: requireEnv("VITE_INDEXER_URL"),
    poolAddress: requireEnv("VITE_POOL_ADDRESS"),
    tokenAddress: requireEnv("VITE_TOKEN_ADDRESS"),
    feeTokenAddress: requireEnv("VITE_FEE_TOKEN_ADDRESS"),
    chainId: requireEnv("VITE_CHAIN_ID") as constants.StarknetChainId,
    provingServiceUrl: import.meta.env.VITE_PROVING_SERVICE_URL as string | undefined,
    proofValidityBlocks: (import.meta.env.VITE_PROOF_VALIDITY_BLOCKS as string) || "450",
  };
}

export function loadRecipients(): RecipientConfig[] {
  const raw = import.meta.env.VITE_AIRDROP_RECIPIENTS as string | undefined;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecipientConfig =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.address === "string" &&
        typeof entry.amount === "string",
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Create `apps/airdrop/src/starknet.ts`**

Copied from `demo/src/starknet.ts` with imports adjusted.

```typescript
import { Account, RpcProvider } from "starknet";
import {
  createPrivateTransfers,
  ProvingServiceProofProvider,
  type PrivateTransfersInterface,
} from "starknet-sdk";
// @ts-expect-error — deep import into dist, not part of the declared exports
import { IndexerDiscoveryProvider } from "starknet-sdk/dist/internal/indexer-discovery.js";
import type { AppConfig, AccountConfig } from "./config.ts";
import { NoValidateProofProvider } from "./proof-provider.ts";

export function createProvider(rpcUrl: string): RpcProvider {
  return new RpcProvider({ nodeUrl: rpcUrl });
}

export function createAccount(
  provider: RpcProvider,
  address: string,
  privateKey: string,
): Account {
  return new Account({ provider, address, signer: privateKey, cairoVersion: "1" });
}

export function createTransfers(
  provider: RpcProvider,
  account: Account,
  accountConfig: AccountConfig,
  poolAddress: string,
  config: AppConfig,
): PrivateTransfersInterface {
  const discovery = new IndexerDiscoveryProvider(config.indexerUrl, poolAddress);
  const provingProvider = config.provingServiceUrl
    ? new ProvingServiceProofProvider(config.provingServiceUrl, config.chainId)
    : new NoValidateProofProvider(provider, config.chainId);
  return createPrivateTransfers({
    account,
    viewingKeyProvider: { getViewingKey: async () => BigInt(accountConfig.viewingKey) },
    provingProvider,
    discoveryProvider: discovery,
    poolContractAddress: poolAddress,
  });
}

export async function getErc20Balance(
  provider: RpcProvider,
  tokenAddress: string,
  ownerAddress: string,
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: "balance_of",
    calldata: [ownerAddress],
  });
  return BigInt(result[0]);
}
```

- [ ] **Step 3: Create `apps/airdrop/src/proof-provider.ts`**

Copied from `demo/src/proof-provider.ts`.

```typescript
import type { RpcProvider, constants } from "starknet";
// @ts-expect-error — deep import into dist, not part of the declared exports
import { CallMockProofProvider } from "starknet-sdk/dist/testing/mock-proving.js";
import type {
  Proof,
  ProofInvocation,
  ProofInvocationFactoryDetails,
  ProofProviderInterface,
} from "starknet-sdk";

export class NoValidateProofProvider implements ProofProviderInterface {
  private readonly delegate: CallMockProofProvider;

  constructor(
    private readonly provider: RpcProvider,
    chainId: constants.StarknetChainId,
  ) {
    this.delegate = new CallMockProofProvider(provider, chainId);
  }

  async getDefaultDetails(): Promise<ProofInvocationFactoryDetails> {
    return this.delegate.getDefaultDetails();
  }

  async prove(invocation: ProofInvocation): Promise<Proof> {
    const result = await this.provider.callContract({
      contractAddress: invocation.sender_address,
      entrypoint: "execute_view",
      calldata: invocation.calldata,
    });
    return { output: result, data: undefined!, proofFacts: [] };
  }
}
```

- [ ] **Step 4: Create `apps/airdrop/src/format.ts`**

```typescript
export function formatChainId(hex: string): string {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  let name = "";
  for (let offset = 0; offset < raw.length; offset += 2) {
    name += String.fromCharCode(parseInt(raw.slice(offset, offset + 2), 16));
  }
  return name;
}

export function truncateAddress(hex: string): string {
  const padded = hex.startsWith("0x") ? hex : `0x${hex}`;
  if (padded.length <= 14) return padded;
  return `${padded.slice(0, 10)}...${padded.slice(-4)}`;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/airdrop/src/config.ts apps/airdrop/src/starknet.ts apps/airdrop/src/proof-provider.ts apps/airdrop/src/format.ts
git commit -m "feat(airdrop): add config, starknet helpers, proof provider, and format utils"
```

---

### Task 3: Account Management Hook

**Files:**
- Create: `apps/airdrop/src/hooks/useAccounts.ts`

- [ ] **Step 1: Create `apps/airdrop/src/hooks/useAccounts.ts`**

Adapted from `demo/src/hooks/useAccounts.ts`. Same localStorage + URL param loading pattern.

```typescript
import { useState, useCallback } from "react";
import type { AccountConfig } from "../config.ts";

const ACCOUNTS_KEY = "airdrop_accounts";
const ACTIVE_INDEX_KEY = "airdrop_activeAccountIndex";
const QUERY_PARAM = "accounts";

function loadStoredAccounts(): AccountConfig[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AccountConfig[];
  } catch {
    return [];
  }
}

function firstNonAdminIndex(accounts: AccountConfig[]): number {
  const index = accounts.findIndex((a) => !a.admin);
  return index >= 0 ? index : 0;
}

function loadStoredIndex(accounts: AccountConfig[]): number {
  const fallback = firstNonAdminIndex(accounts);
  try {
    const saved = localStorage.getItem(ACTIVE_INDEX_KEY);
    if (saved === null) return fallback;
    const parsed = Number(saved);
    return parsed >= 0 && parsed < accounts.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseAccounts(raw: string): AccountConfig[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
  for (const entry of parsed) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.name !== "string" ||
      typeof entry.address !== "string" ||
      typeof entry.privateKey !== "string" ||
      typeof entry.viewingKey !== "string"
    ) {
      throw new Error("Each account must have name, address, privateKey, viewingKey");
    }
  }
  return parsed as AccountConfig[];
}

function saveAccounts(accounts: AccountConfig[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  localStorage.setItem(ACTIVE_INDEX_KEY, String(firstNonAdminIndex(accounts)));
}

function loadFromQueryParam(): AccountConfig[] | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(QUERY_PARAM);
    if (!encoded) return null;
    const json = atob(encoded);
    const accounts = parseAccounts(json);
    if (accounts.length === 0) return null;
    saveAccounts(accounts);
    params.delete(QUERY_PARAM);
    const cleanUrl =
      window.location.pathname +
      (params.size > 0 ? `?${params.toString()}` : "") +
      window.location.hash;
    window.history.replaceState(null, "", cleanUrl);
    return accounts;
  } catch {
    return null;
  }
}

export type UseAccountsResult = {
  accounts: AccountConfig[];
  activeIndex: number;
  activeAccount: AccountConfig | undefined;
  adminAccount: AccountConfig | undefined;
  setActiveIndex: (index: number) => void;
  importAccounts: (raw: string) => string | null;
};

export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState(
    () => loadFromQueryParam() ?? loadStoredAccounts(),
  );
  const [activeIndex, setActiveIndexState] = useState(() =>
    loadStoredIndex(accounts),
  );

  const setActiveIndex = useCallback((index: number) => {
    setActiveIndexState(index);
    try {
      localStorage.setItem(ACTIVE_INDEX_KEY, String(index));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const importAccounts = useCallback((raw: string): string | null => {
    try {
      const parsed = parseAccounts(raw);
      if (parsed.length === 0) return "No accounts in the list";
      saveAccounts(parsed);
      setAccounts(parsed);
      setActiveIndexState(firstNonAdminIndex(parsed));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  }, []);

  return {
    accounts,
    activeIndex,
    activeAccount: accounts[activeIndex],
    adminAccount: accounts.find((a) => a.admin),
    setActiveIndex,
    importAccounts,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/hooks/useAccounts.ts
git commit -m "feat(airdrop): add account management hook with URL param and localStorage support"
```

---

### Task 4: Airdrop Hook (Core Admin Logic)

**Files:**
- Create: `apps/airdrop/src/hooks/useAirdrop.ts`

- [ ] **Step 1: Create `apps/airdrop/src/hooks/useAirdrop.ts`**

This is the core hook. It manages the full airdrop lifecycle: approve → deposit → wait for note maturity → smart batch transfer with fallback.

```typescript
import { useState, useCallback, useRef } from "react";
import { Account, TransactionFinalityStatus, type RpcProvider } from "starknet";
import type { PrivateTransfersInterface } from "starknet-sdk";
import type { AppConfig } from "../config.ts";

const WAIT_OPTIONS = {
  successStates: [TransactionFinalityStatus.PRE_CONFIRMED],
  retryInterval: 100,
};

const NOTE_MATURITY_BLOCKS = 10;
const MATURITY_POLL_INTERVAL_MS = 2000;

export type RecipientEntry = {
  address: string;
  amount: bigint;
  status: "pending" | "proving" | "submitted" | "confirmed" | "done" | "failed";
  error?: string;
};

export type AirdropPhase =
  | { phase: "idle" }
  | { phase: "approving" }
  | { phase: "depositing" }
  | { phase: "waiting_maturity"; blocksRemaining: number }
  | { phase: "transferring"; mode: "batch" | "individual"; progress: number }
  | { phase: "complete"; succeeded: number; failed: number }
  | { phase: "error"; message: string };

export type UseAirdropResult = {
  airdropPhase: AirdropPhase;
  recipients: RecipientEntry[];
  executeAirdrop: (entries: Array<{ address: string; amount: bigint }>) => Promise<void>;
  reset: () => void;
};

export function useAirdrop(
  provider: RpcProvider | undefined,
  transfers: PrivateTransfersInterface | undefined,
  adminAddress: string | undefined,
  poolAddress: string,
  config: AppConfig,
  accounts: Array<{ address: string; privateKey: string; admin?: boolean }>,
): UseAirdropResult {
  const [airdropPhase, setPhase] = useState<AirdropPhase>({ phase: "idle" });
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const cancelledRef = useRef(false);

  const updateRecipientStatus = useCallback(
    (address: string, status: RecipientEntry["status"], error?: string) => {
      setRecipients((prev) =>
        prev.map((r) => (r.address === address ? { ...r, status, error } : r)),
      );
    },
    [],
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setPhase({ phase: "idle" });
    setRecipients([]);
  }, []);

  const executeAirdrop = useCallback(
    async (entries: Array<{ address: string; amount: bigint }>) => {
      if (!provider || !transfers || !adminAddress) {
        setPhase({ phase: "error", message: "Not ready: missing provider, transfers, or admin account" });
        return;
      }

      const adminConfig = accounts.find((a) => a.admin);
      if (!adminConfig) {
        setPhase({ phase: "error", message: "No admin account found" });
        return;
      }

      const adminAccount = new Account({
        provider,
        address: adminConfig.address,
        signer: adminConfig.privateKey,
        cairoVersion: "1",
      });

      cancelledRef.current = false;
      const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0n);

      setRecipients(entries.map(({ address, amount }) => ({
        address,
        amount,
        status: "pending" as const,
      })));

      try {
        // Step 1: Approve
        setPhase({ phase: "approving" });
        const approveCall = {
          contractAddress: config.tokenAddress,
          entrypoint: "approve",
          calldata: [poolAddress, totalAmount.toString(), "0"],
        };
        const approveTx = await adminAccount.execute(approveCall, { tip: 0n });
        await provider.waitForTransaction(approveTx.transaction_hash, WAIT_OPTIONS);

        if (cancelledRef.current) return;

        // Step 2: Deposit
        setPhase({ phase: "depositing" });
        const depositBlockId = (await provider.getBlockNumber()) - 10;
        const { callAndProof: depositResult } = await transfers
          .build({
            autoRegister: true,
            autoSetup: true,
            autoDiscover: { notes: "refresh", channels: "refresh" },
          })
          .with(config.tokenAddress, (t) =>
            t.deposit({ amount: totalAmount, recipient: adminAddress }),
          )
          .execute({ provingBlockId: depositBlockId });

        const depositProofDetails = depositResult.proof.proofFacts?.length
          ? { proofFacts: depositResult.proof.proofFacts, proof: depositResult.proof.data }
          : {};

        const depositTx = await adminAccount.execute(depositResult.call, {
          tip: 0n,
          ...depositProofDetails,
        });

        const depositReceipt = await provider.waitForTransaction(
          depositTx.transaction_hash,
          WAIT_OPTIONS,
        );
        if (!depositReceipt.isSuccess()) {
          throw new Error(`Deposit reverted: ${JSON.stringify(depositReceipt)}`);
        }

        const depositBlockNumber = depositReceipt.block_number ?? (await provider.getBlockNumber());

        if (cancelledRef.current) return;

        // Step 3: Wait for note maturity
        let currentBlock = await provider.getBlockNumber();
        let blocksRemaining = Math.max(0, depositBlockNumber + NOTE_MATURITY_BLOCKS - currentBlock);
        setPhase({ phase: "waiting_maturity", blocksRemaining });

        while (blocksRemaining > 0) {
          if (cancelledRef.current) return;
          await new Promise((resolve) => setTimeout(resolve, MATURITY_POLL_INTERVAL_MS));
          currentBlock = await provider.getBlockNumber();
          blocksRemaining = Math.max(0, depositBlockNumber + NOTE_MATURITY_BLOCKS - currentBlock);
          setPhase({ phase: "waiting_maturity", blocksRemaining });
        }

        if (cancelledRef.current) return;

        // Step 4: Smart batch transfer
        let batchSucceeded = false;
        setPhase({ phase: "transferring", mode: "batch", progress: 0 });

        try {
          setRecipients((prev) => prev.map((r) => ({ ...r, status: "proving" as const })));

          const provingBlockId = (await provider.getBlockNumber()) - 10;
          const builder = transfers.build({
            autoSetup: true,
            autoDiscover: { notes: "refresh", channels: "refresh" },
            autoSelectNotes: "all",
          });
          builder.surplusTo(adminAddress);
          builder.with(config.tokenAddress, (t) => {
            for (const { address, amount } of entries) {
              t.transfer({ recipient: address, amount });
            }
          });

          const { callAndProof: batchResult } = await builder.execute({ provingBlockId });

          setRecipients((prev) => prev.map((r) => ({ ...r, status: "submitted" as const })));

          const batchProofDetails = batchResult.proof.proofFacts?.length
            ? { proofFacts: batchResult.proof.proofFacts, proof: batchResult.proof.data }
            : {};

          const batchTx = await adminAccount.execute(batchResult.call, {
            tip: 0n,
            ...batchProofDetails,
          });

          const batchReceipt = await provider.waitForTransaction(
            batchTx.transaction_hash,
            WAIT_OPTIONS,
          );
          if (!batchReceipt.isSuccess()) {
            throw new Error(`Batch transfer reverted`);
          }

          setRecipients((prev) => prev.map((r) => ({ ...r, status: "done" as const })));
          batchSucceeded = true;
        } catch (batchError) {
          console.warn("Batch transfer failed, falling back to individual transfers:", batchError);
          setRecipients((prev) => prev.map((r) => ({ ...r, status: "pending" as const })));
        }

        // Fallback: individual transfers
        if (!batchSucceeded) {
          setPhase({ phase: "transferring", mode: "individual", progress: 0 });
          let completed = 0;

          for (const { address, amount } of entries) {
            if (cancelledRef.current) return;

            updateRecipientStatus(address, "proving");
            try {
              const provingBlockId = (await provider.getBlockNumber()) - 10;
              const { callAndProof: transferResult } = await transfers
                .build({
                  autoSetup: true,
                  autoDiscover: { notes: "refresh", channels: "refresh" },
                  autoSelectNotes: "naive",
                })
                .surplusTo(adminAddress)
                .with(config.tokenAddress, (t) =>
                  t.transfer({ recipient: address, amount }),
                )
                .execute({ provingBlockId });

              updateRecipientStatus(address, "submitted");

              const transferProofDetails = transferResult.proof.proofFacts?.length
                ? { proofFacts: transferResult.proof.proofFacts, proof: transferResult.proof.data }
                : {};

              const transferTx = await adminAccount.execute(transferResult.call, {
                tip: 0n,
                ...transferProofDetails,
              });

              const transferReceipt = await provider.waitForTransaction(
                transferTx.transaction_hash,
                WAIT_OPTIONS,
              );
              if (!transferReceipt.isSuccess()) {
                throw new Error("Transfer reverted");
              }

              updateRecipientStatus(address, "done");
            } catch (transferError) {
              const message = transferError instanceof Error ? transferError.message : String(transferError);
              updateRecipientStatus(address, "failed", message);
            }

            completed++;
            setPhase({ phase: "transferring", mode: "individual", progress: completed });
          }
        }

        // Summary
        setRecipients((prev) => {
          const succeeded = prev.filter((r) => r.status === "done").length;
          const failed = prev.filter((r) => r.status === "failed").length;
          setPhase({ phase: "complete", succeeded, failed });
          return prev;
        });
      } catch (topLevelError) {
        const message = topLevelError instanceof Error ? topLevelError.message : String(topLevelError);
        setPhase({ phase: "error", message });
      }
    },
    [provider, transfers, adminAddress, poolAddress, config, accounts, updateRecipientStatus],
  );

  return { airdropPhase, recipients, executeAirdrop, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/hooks/useAirdrop.ts
git commit -m "feat(airdrop): add useAirdrop hook with approve, deposit, maturity wait, and smart batch transfer"
```

---

### Task 5: Claimant Hook

**Files:**
- Create: `apps/airdrop/src/hooks/useClaimant.ts`

- [ ] **Step 1: Create `apps/airdrop/src/hooks/useClaimant.ts`**

```typescript
import { useState, useCallback } from "react";
import { Account, TransactionFinalityStatus, type RpcProvider } from "starknet";
import type { PrivateTransfersInterface, Note } from "starknet-sdk";
import type { AppConfig } from "../config.ts";

const WAIT_OPTIONS = {
  successStates: [TransactionFinalityStatus.PRE_CONFIRMED],
  retryInterval: 100,
};

export type ClaimantState = {
  notes: Note[];
  totalBalance: bigint;
  discovering: boolean;
  withdrawing: boolean;
  lastError: string | null;
  lastTxHash: string | null;
};

export type UseClaimantResult = {
  state: ClaimantState;
  discover: () => Promise<void>;
  withdraw: (amount: bigint) => Promise<void>;
};

export function useClaimant(
  provider: RpcProvider | undefined,
  transfers: PrivateTransfersInterface | undefined,
  activeAddress: string | undefined,
  poolAddress: string,
  config: AppConfig,
  accounts: Array<{ address: string; privateKey: string }>,
): UseClaimantResult {
  const [state, setState] = useState<ClaimantState>({
    notes: [],
    totalBalance: 0n,
    discovering: false,
    withdrawing: false,
    lastError: null,
    lastTxHash: null,
  });

  const discover = useCallback(async () => {
    if (!transfers) return;
    setState((prev) => ({ ...prev, discovering: true, lastError: null }));

    try {
      const { notes } = await transfers.discoverNotes({ tokens: [config.tokenAddress] });
      const totalBalance = notes.reduce((sum, note) => sum + (note.amount ?? 0n), 0n);
      setState((prev) => ({ ...prev, notes, totalBalance, discovering: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, discovering: false, lastError: `Discovery failed: ${message}` }));
    }
  }, [transfers, config.tokenAddress]);

  const withdraw = useCallback(
    async (amount: bigint) => {
      if (!provider || !transfers || !activeAddress) return;

      const accountConfig = accounts.find((a) => a.address === activeAddress);
      if (!accountConfig) return;

      const userAccount = new Account({
        provider,
        address: accountConfig.address,
        signer: accountConfig.privateKey,
        cairoVersion: "1",
      });

      setState((prev) => ({ ...prev, withdrawing: true, lastError: null, lastTxHash: null }));

      try {
        const provingBlockId = (await provider.getBlockNumber()) - 10;
        const { callAndProof } = await transfers
          .build({
            autoDiscover: { notes: "refresh", channels: "refresh" },
            autoSelectNotes: "naive",
          })
          .surplusTo(activeAddress)
          .with(config.tokenAddress, (t) =>
            t.withdraw({ amount, recipient: activeAddress }),
          )
          .execute({ provingBlockId });

        const proofDetails = callAndProof.proof.proofFacts?.length
          ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
          : {};

        const tx = await userAccount.execute(callAndProof.call, {
          tip: 0n,
          ...proofDetails,
        });

        const receipt = await provider.waitForTransaction(tx.transaction_hash, WAIT_OPTIONS);
        if (!receipt.isSuccess()) {
          throw new Error(`Withdrawal reverted: ${JSON.stringify(receipt)}`);
        }

        setState((prev) => ({
          ...prev,
          withdrawing: false,
          lastTxHash: tx.transaction_hash,
        }));

        // Re-discover notes after withdrawal
        await discover();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          withdrawing: false,
          lastError: `Withdrawal failed: ${message}`,
        }));
      }
    },
    [provider, transfers, activeAddress, config.tokenAddress, accounts, discover],
  );

  return { state, discover, withdraw };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/hooks/useClaimant.ts
git commit -m "feat(airdrop): add useClaimant hook with note discovery and withdrawal"
```

---

### Task 6: RecipientList Component

**Files:**
- Create: `apps/airdrop/src/components/RecipientList.tsx`

- [ ] **Step 1: Create `apps/airdrop/src/components/RecipientList.tsx`**

Editable table with add/edit/delete rows, CSV paste, and validation.

```tsx
import { useState, useCallback } from "react";
import { truncateAddress } from "../format.ts";

export type RecipientRow = {
  address: string;
  amount: string;
};

type RecipientListProps = {
  rows: RecipientRow[];
  onChange: (rows: RecipientRow[]) => void;
  disabled: boolean;
  adminBalance: bigint | null;
};

function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(address);
}

function isValidAmount(amount: string): boolean {
  try {
    return BigInt(amount) > 0n;
  } catch {
    return false;
  }
}

function findValidationErrors(
  rows: RecipientRow[],
  adminBalance: bigint | null,
): string[] {
  const errors: string[] = [];
  const addresses = new Set<string>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!isValidAddress(row.address)) {
      errors.push(`Row ${rowIndex + 1}: invalid address`);
    }
    if (!isValidAmount(row.amount)) {
      errors.push(`Row ${rowIndex + 1}: amount must be a positive integer`);
    }
    const normalizedAddress = row.address.toLowerCase();
    if (addresses.has(normalizedAddress)) {
      errors.push(`Row ${rowIndex + 1}: duplicate address`);
    }
    addresses.add(normalizedAddress);
  }

  if (adminBalance !== null && rows.length > 0) {
    const total = rows.reduce((sum, row) => {
      try {
        return sum + BigInt(row.amount);
      } catch {
        return sum;
      }
    }, 0n);
    if (total > adminBalance) {
      errors.push(`Total (${total}) exceeds balance (${adminBalance})`);
    }
  }

  return errors;
}

export function RecipientList({ rows, onChange, disabled, adminBalance }: RecipientListProps) {
  const [csvInput, setCsvInput] = useState("");
  const errors = findValidationErrors(rows, adminBalance);

  const updateRow = useCallback(
    (index: number, field: keyof RecipientRow, value: string) => {
      const updated = [...rows];
      updated[index] = { ...updated[index], [field]: value };
      onChange(updated);
    },
    [rows, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...rows, { address: "", amount: "" }]);
  }, [rows, onChange]);

  const removeRow = useCallback(
    (index: number) => {
      onChange(rows.filter((_, rowIndex) => rowIndex !== index));
    },
    [rows, onChange],
  );

  const handleCsvPaste = useCallback(() => {
    const lines = csvInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsed: RecipientRow[] = lines
      .map((line) => {
        const [address, amount] = line.split(",").map((part) => part.trim());
        return address && amount ? { address, amount } : null;
      })
      .filter((row): row is RecipientRow => row !== null);

    if (parsed.length > 0) {
      onChange([...rows, ...parsed]);
      setCsvInput("");
    }
  }, [csvInput, rows, onChange]);

  const totalAmount = rows.reduce((sum, row) => {
    try {
      return sum + BigInt(row.amount);
    } catch {
      return sum;
    }
  }, 0n);

  return (
    <div>
      <h3>Recipients</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Address</th>
            <th style={{ textAlign: "right" }}>Amount</th>
            <th style={{ width: "40px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                {disabled ? (
                  <code>{truncateAddress(row.address)}</code>
                ) : (
                  <input
                    type="text"
                    value={row.address}
                    onChange={(event) => updateRow(index, "address", event.target.value)}
                    placeholder="0x..."
                    style={{ width: "100%", fontFamily: "monospace" }}
                  />
                )}
              </td>
              <td>
                {disabled ? (
                  <code>{row.amount}</code>
                ) : (
                  <input
                    type="text"
                    value={row.amount}
                    onChange={(event) => updateRow(index, "amount", event.target.value)}
                    placeholder="0"
                    style={{ width: "100%", textAlign: "right" }}
                  />
                )}
              </td>
              <td>
                {!disabled && (
                  <button onClick={() => removeRow(index)} title="Remove">
                    x
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: "left" }}>
              <strong>Total: {rows.length} recipients</strong>
            </td>
            <td style={{ textAlign: "right" }}>
              <strong>{totalAmount.toString()}</strong>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {!disabled && (
        <div style={{ marginTop: "8px" }}>
          <button onClick={addRow}>+ Add Row</button>
          <details style={{ marginTop: "8px" }}>
            <summary>Paste CSV</summary>
            <textarea
              value={csvInput}
              onChange={(event) => setCsvInput(event.target.value)}
              placeholder={"0x1234...,500\n0x5678...,300"}
              rows={4}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
            <button onClick={handleCsvPaste}>Import CSV</button>
          </details>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ color: "red", marginTop: "8px" }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export { findValidationErrors };
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/components/RecipientList.tsx
git commit -m "feat(airdrop): add RecipientList component with inline editing, CSV paste, and validation"
```

---

### Task 7: AirdropProgress Component

**Files:**
- Create: `apps/airdrop/src/components/AirdropProgress.tsx`

- [ ] **Step 1: Create `apps/airdrop/src/components/AirdropProgress.tsx`**

```tsx
import type { AirdropPhase, RecipientEntry } from "../hooks/useAirdrop.ts";
import { truncateAddress } from "../format.ts";

type AirdropProgressProps = {
  phase: AirdropPhase;
  recipients: RecipientEntry[];
  onReset: () => void;
};

function phaseLabel(phase: AirdropPhase): string {
  switch (phase.phase) {
    case "idle":
      return "Ready";
    case "approving":
      return "Approving token spend...";
    case "depositing":
      return "Depositing into privacy pool...";
    case "waiting_maturity":
      return `Waiting for note maturity (${phase.blocksRemaining} blocks remaining)...`;
    case "transferring":
      if (phase.mode === "batch") return "Proving batch transfer...";
      return `Transferring individually (${phase.progress} done)...`;
    case "complete":
      return `Complete: ${phase.succeeded} succeeded, ${phase.failed} failed`;
    case "error":
      return `Error: ${phase.message}`;
  }
}

function statusBadge(status: RecipientEntry["status"]): string {
  switch (status) {
    case "pending":
      return "...";
    case "proving":
      return "Proving";
    case "submitted":
      return "Submitted";
    case "confirmed":
      return "Confirmed";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
  }
}

export function AirdropProgress({ phase, recipients, onReset }: AirdropProgressProps) {
  const isRunning =
    phase.phase !== "idle" && phase.phase !== "complete" && phase.phase !== "error";

  return (
    <div>
      <h3>Airdrop Progress</h3>
      <p>
        <strong>{phaseLabel(phase)}</strong>
      </p>

      {recipients.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Recipient</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((recipient) => (
              <tr key={recipient.address}>
                <td>
                  <code>{truncateAddress(recipient.address)}</code>
                </td>
                <td style={{ textAlign: "right" }}>{recipient.amount.toString()}</td>
                <td
                  style={{
                    textAlign: "center",
                    color: recipient.status === "failed" ? "red" : recipient.status === "done" ? "green" : "inherit",
                  }}
                >
                  {statusBadge(recipient.status)}
                  {recipient.error && <div style={{ fontSize: "0.8em" }}>{recipient.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isRunning && phase.phase !== "idle" && (
        <button onClick={onReset} style={{ marginTop: "8px" }}>
          Reset
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/components/AirdropProgress.tsx
git commit -m "feat(airdrop): add AirdropProgress component with phase display and per-recipient status"
```

---

### Task 8: StatusBar Component

**Files:**
- Create: `apps/airdrop/src/components/StatusBar.tsx`

- [ ] **Step 1: Create `apps/airdrop/src/components/StatusBar.tsx`**

```tsx
type StatusBarProps = {
  txHash: string | null;
  error: string | null;
};

export function StatusBar({ txHash, error }: StatusBarProps) {
  if (!txHash && !error) return null;

  return (
    <div
      style={{
        padding: "8px 12px",
        marginBottom: "12px",
        borderRadius: "4px",
        background: error ? "#fee" : "#efe",
        border: `1px solid ${error ? "#c00" : "#0a0"}`,
        fontFamily: "monospace",
        fontSize: "0.85em",
      }}
    >
      {error && <span style={{ color: "#c00" }}>{error}</span>}
      {txHash && (
        <span>
          Last tx: <code>{txHash}</code>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/components/StatusBar.tsx
git commit -m "feat(airdrop): add StatusBar component for transaction hash and error display"
```

---

### Task 9: AdminPanel Component

**Files:**
- Create: `apps/airdrop/src/components/AdminPanel.tsx`

- [ ] **Step 1: Create `apps/airdrop/src/components/AdminPanel.tsx`**

```tsx
import { useState, useEffect, useCallback } from "react";
import type { RpcProvider } from "starknet";
import type { PrivateTransfersInterface } from "starknet-sdk";
import type { AppConfig, RecipientConfig } from "../config.ts";
import { getErc20Balance } from "../starknet.ts";
import { useAirdrop } from "../hooks/useAirdrop.ts";
import { RecipientList, findValidationErrors, type RecipientRow } from "./RecipientList.tsx";
import { AirdropProgress } from "./AirdropProgress.tsx";

type AdminPanelProps = {
  provider: RpcProvider;
  transfers: PrivateTransfersInterface;
  adminAddress: string;
  poolAddress: string;
  config: AppConfig;
  accounts: Array<{ address: string; privateKey: string; admin?: boolean }>;
  initialRecipients: RecipientConfig[];
};

export function AdminPanel({
  provider,
  transfers,
  adminAddress,
  poolAddress,
  config,
  accounts,
  initialRecipients,
}: AdminPanelProps) {
  const [rows, setRows] = useState<RecipientRow[]>(
    initialRecipients.map((r) => ({ address: r.address, amount: r.amount })),
  );
  const [adminBalance, setAdminBalance] = useState<bigint | null>(null);

  const { airdropPhase, recipients, executeAirdrop, reset } = useAirdrop(
    provider,
    transfers,
    adminAddress,
    poolAddress,
    config,
    accounts,
  );

  useEffect(() => {
    getErc20Balance(provider, config.tokenAddress, adminAddress).then(setAdminBalance).catch(() => {});
  }, [provider, config.tokenAddress, adminAddress, airdropPhase]);

  const errors = findValidationErrors(rows, adminBalance);
  const isRunning = airdropPhase.phase !== "idle" && airdropPhase.phase !== "complete" && airdropPhase.phase !== "error";
  const canExecute = rows.length > 0 && errors.length === 0 && !isRunning;

  const handleExecute = useCallback(() => {
    const entries = rows.map((row) => ({
      address: row.address,
      amount: BigInt(row.amount),
    }));
    executeAirdrop(entries);
  }, [rows, executeAirdrop]);

  return (
    <div>
      <h2>Admin: Airdrop</h2>
      <p>
        Token: <code>{config.tokenAddress}</code>
      </p>
      <p>
        Balance: <code>{adminBalance !== null ? adminBalance.toString() : "loading..."}</code>
      </p>

      {airdropPhase.phase === "idle" ? (
        <>
          <RecipientList
            rows={rows}
            onChange={setRows}
            disabled={false}
            adminBalance={adminBalance}
          />
          <button
            onClick={handleExecute}
            disabled={!canExecute}
            style={{ marginTop: "12px", padding: "8px 24px", fontSize: "1em" }}
          >
            Execute Airdrop
          </button>
        </>
      ) : (
        <>
          <RecipientList rows={rows} onChange={setRows} disabled={true} adminBalance={adminBalance} />
          <AirdropProgress phase={airdropPhase} recipients={recipients} onReset={reset} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/components/AdminPanel.tsx
git commit -m "feat(airdrop): add AdminPanel with recipient list editing, balance check, and airdrop execution"
```

---

### Task 10: ClaimantPanel Component

**Files:**
- Create: `apps/airdrop/src/components/ClaimantPanel.tsx`

- [ ] **Step 1: Create `apps/airdrop/src/components/ClaimantPanel.tsx`**

```tsx
import { useState, useEffect } from "react";
import type { RpcProvider } from "starknet";
import type { PrivateTransfersInterface } from "starknet-sdk";
import type { AppConfig } from "../config.ts";
import { useClaimant } from "../hooks/useClaimant.ts";
import { StatusBar } from "./StatusBar.tsx";

type ClaimantPanelProps = {
  provider: RpcProvider;
  transfers: PrivateTransfersInterface;
  activeAddress: string;
  poolAddress: string;
  config: AppConfig;
  accounts: Array<{ address: string; privateKey: string }>;
};

export function ClaimantPanel({
  provider,
  transfers,
  activeAddress,
  poolAddress,
  config,
  accounts,
}: ClaimantPanelProps) {
  const { state, discover, withdraw } = useClaimant(
    provider,
    transfers,
    activeAddress,
    poolAddress,
    config,
    accounts,
  );

  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    discover();
  }, [discover]);

  useEffect(() => {
    if (state.totalBalance > 0n) {
      setWithdrawAmount(state.totalBalance.toString());
    }
  }, [state.totalBalance]);

  const canWithdraw =
    !state.withdrawing &&
    !state.discovering &&
    state.totalBalance > 0n &&
    withdrawAmount.length > 0;

  return (
    <div>
      <h2>Claim Airdrop</h2>

      <StatusBar txHash={state.lastTxHash} error={state.lastError} />

      <div style={{ marginBottom: "12px" }}>
        <strong>Private Balance: </strong>
        <code>{state.discovering ? "discovering..." : state.totalBalance.toString()}</code>
        <button onClick={discover} disabled={state.discovering} style={{ marginLeft: "8px" }}>
          Refresh
        </button>
      </div>

      {state.notes.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <h3>Notes ({state.notes.length})</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>#</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {state.notes.map((note, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td style={{ textAlign: "right" }}>
                    <code>{note.amount?.toString() ?? "?"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3>Withdraw</h3>
        <input
          type="text"
          value={withdrawAmount}
          onChange={(event) => setWithdrawAmount(event.target.value)}
          placeholder="Amount"
          style={{ width: "200px", marginRight: "8px" }}
        />
        <button
          onClick={() => withdraw(BigInt(withdrawAmount))}
          disabled={!canWithdraw}
        >
          {state.withdrawing ? "Withdrawing..." : "Withdraw"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/components/ClaimantPanel.tsx
git commit -m "feat(airdrop): add ClaimantPanel with note discovery, balance display, and withdrawal"
```

---

### Task 11: App Root Component (Admin/Claimant Routing)

**Files:**
- Create: `apps/airdrop/src/App.tsx`

- [ ] **Step 1: Create `apps/airdrop/src/App.tsx`**

```tsx
import { useMemo } from "react";
import { loadConfig, loadRecipients } from "./config.ts";
import { createProvider, createAccount, createTransfers } from "./starknet.ts";
import { formatChainId, truncateAddress } from "./format.ts";
import { useAccounts } from "./hooks/useAccounts.ts";
import { AdminPanel } from "./components/AdminPanel.tsx";
import { ClaimantPanel } from "./components/ClaimantPanel.tsx";

const config = loadConfig();
const initialRecipients = loadRecipients();

export function App() {
  const { accounts, activeIndex, activeAccount, adminAccount, setActiveIndex } =
    useAccounts();

  const provider = useMemo(() => createProvider(config.rpcUrl), []);

  const account = useMemo(() => {
    if (!activeAccount) return undefined;
    return createAccount(provider, activeAccount.address, activeAccount.privateKey);
  }, [provider, activeAccount]);

  const transfers = useMemo(() => {
    if (!account || !activeAccount) return undefined;
    return createTransfers(provider, account, activeAccount, config.poolAddress, config);
  }, [provider, account, activeAccount]);

  const isAdmin = activeAccount?.admin === true;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "monospace" }}>
      <h1>Anonymous Airdrop</h1>
      <p>
        Chain: <code>{formatChainId(config.chainId)}</code> | Pool:{" "}
        <code>{truncateAddress(config.poolAddress)}</code>
      </p>

      <div style={{ marginBottom: "16px" }}>
        <label>Account: </label>
        <select
          value={activeIndex}
          onChange={(event) => setActiveIndex(Number(event.target.value))}
        >
          {accounts.map((acc, index) => (
            <option key={acc.address} value={index}>
              {acc.name} {acc.admin ? "(Admin)" : ""} — {truncateAddress(acc.address)}
            </option>
          ))}
        </select>
      </div>

      {activeAccount && transfers && (
        isAdmin ? (
          <AdminPanel
            provider={provider}
            transfers={transfers}
            adminAddress={activeAccount.address}
            poolAddress={config.poolAddress}
            config={config}
            accounts={accounts}
            initialRecipients={initialRecipients}
          />
        ) : (
          <ClaimantPanel
            provider={provider}
            transfers={transfers}
            activeAddress={activeAccount.address}
            poolAddress={config.poolAddress}
            config={config}
            accounts={accounts}
          />
        )
      )}

      {!activeAccount && (
        <p>No accounts loaded. Add accounts via URL parameter or localStorage.</p>
      )}

      <footer style={{ marginTop: "40px", fontSize: "0.8em", color: "#888" }}>
        Anonymous Airdrop — Built with Starknet Privacy SDK
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/airdrop/src/App.tsx
git commit -m "feat(airdrop): add App root with account selector and admin/claimant view routing"
```

---

### Task 12: Environment File and Build Verification

**Files:**
- Create: `apps/airdrop/.env` (from `.env.example`)

- [ ] **Step 1: Copy `.env.example` to `.env`**

```bash
cd apps/airdrop && cp .env.example .env
```

- [ ] **Step 2: Ensure the SDK is built**

```bash
cd sdk && npm run build
```

Expected: SDK compiles to `sdk/dist/` without errors.

- [ ] **Step 3: Run TypeScript check**

```bash
cd apps/airdrop && npx tsc --noEmit
```

Expected: No type errors. If there are errors, fix them before proceeding.

- [ ] **Step 4: Run Vite dev server**

```bash
cd apps/airdrop && npm run dev
```

Expected: Vite starts on a local port. Open the URL in browser — the app renders with account selector, admin sees recipient list, non-admin sees claimant panel.

- [ ] **Step 5: Verify build**

```bash
cd apps/airdrop && npm run build
```

Expected: Production build succeeds, output in `apps/airdrop/dist/`.

- [ ] **Step 6: Commit .env to .gitignore (do NOT commit .env itself)**

Add to `apps/airdrop/.gitignore`:

```
node_modules
dist
.env
```

```bash
git add apps/airdrop/.gitignore
git commit -m "chore(airdrop): add .gitignore for node_modules, dist, and .env"
```

---

### Task 13: Smoke Test on Testnet

This is a manual verification task using the running app against testnet infrastructure.

- [ ] **Step 1: Start the app**

```bash
cd apps/airdrop && npm run dev
```

- [ ] **Step 2: Test admin flow**

1. Select Admin account from dropdown
2. Verify admin balance shows (should be non-zero after minting via the demo app)
3. Verify pre-loaded recipients appear in the table (Alice: 500, Bob: 300)
4. Click "Execute Airdrop"
5. Watch phase progression: approving → depositing → waiting maturity → transferring → complete
6. Verify all recipients show "Done" status

- [ ] **Step 3: Test claimant flow**

1. Switch to Alice account
2. Verify private balance shows after discovery
3. Enter withdrawal amount
4. Click Withdraw
5. Verify transaction completes and balance updates

- [ ] **Step 4: Commit any fixes found during smoke testing**

```bash
git add -A apps/airdrop/
git commit -m "fix(airdrop): fixes from smoke testing"
```

Only create this commit if fixes were needed.
