# Trust model

**What Satlas never does:** hold private keys or seed phrases, sign, broadcast,
create an account, or send wallet data to any Satlas-operated server (there is none).

**What Satlas does by default:** queries a public Esplora-compatible API
(mempool.space) for the transaction history of addresses derived from your
descriptor. The operator of that API can therefore see those addresses and link
them to your IP. This is the same tradeoff every watch-only wallet using a public
backend makes.

**How to remove that tradeoff:** configure a self-hosted Esplora/Electrs endpoint
in Settings (the gear icon). Then no third party sees your addresses.

Labels you create are stored only in your browser's IndexedDB and can be exported
as BIP-329 JSONL.
