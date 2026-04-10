import { describe, expect, it } from "vitest";
import {
  ESCROW_HELPER_PRIVACY_WARNING,
  buildClaimInvoke,
  buildClaimUrl,
  buildDepositInvoke,
  computeCommitmentHash,
  parseClaimUrl,
  parseEscrowSecret,
} from "../src/index.js";

describe("escrow helpers", () => {
  it("computes a deterministic commitment hash", () => {
    expect(computeCommitmentHash(0x1234n)).toBe(0x65dc57682da30c7de57d930d985bb8f2561de12e0a2959c131e0538f2d35101n);
  });

  it("builds deposit invoke calldata", () => {
    const call = buildDepositInvoke("0xabc", 0x111n, "0xdef", 25n)({} as never);
    expect(call).toEqual({
      contractAddress: "0xabc",
      calldata: [0, 0x111n, "0xdef", 25n, 0, 0],
    });
  });

  it("builds claim invoke calldata from the prepared open note", () => {
    const call = buildClaimInvoke("0xabc", 0xfeedn)({
      openNotes: [{ noteId: 0x123n }],
    } as never);
    expect(call).toEqual({
      contractAddress: "0xabc",
      calldata: [1, 0, 0, 0, 0xfeedn, 0x123n],
    });
  });

  it("round-trips claim URLs and raw secrets", () => {
    const url = buildClaimUrl("https://example.com/claim", 0xbeefn);
    expect(parseClaimUrl(url)).toBe(0xbeefn);
    expect(parseEscrowSecret(url)).toBe(0xbeefn);
    expect(parseEscrowSecret("beef")).toBe(0xbeefn);
    expect(parseEscrowSecret("0xbeef")).toBe(0xbeefn);
  });

  it("exports a helper privacy warning for UI surfaces", () => {
    expect(ESCROW_HELPER_PRIVACY_WARNING).toContain("distinguishable");
    expect(ESCROW_HELPER_PRIVACY_WARNING).toContain("pool-native");
  });
});
