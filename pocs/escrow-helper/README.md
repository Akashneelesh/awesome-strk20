> [!NOTE]
> **Reference implementation.** This Cairo helper depends on the `privacy` pool library (`privacy = { path = "../privacy" }`), which is not bundled in this repo. It is provided as a reference `privacy_invoke` example; wire it against the privacy pool sources to build and test.

# Escrow

Privacy-preserving escrow contract for deferred delivery to unregistered pool recipients.

Integrates with the privacy pool via the `InvokeExternal` mechanism. Holds ERC-20 tokens
against commitment hashes until recipients claim them by presenting the secret preimage.
