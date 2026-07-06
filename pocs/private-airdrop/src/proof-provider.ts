import type { RpcProvider, constants } from "starknet";
// @ts-expect-error - deep import into dist, not part of the declared exports
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
