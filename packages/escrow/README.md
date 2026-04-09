# Escrow

Privacy-preserving escrow contract for deferred delivery to unregistered pool recipients.

Integrates with the privacy pool via the `InvokeExternal` mechanism. Holds ERC-20 tokens
against commitment hashes until recipients claim them by presenting the secret preimage.
