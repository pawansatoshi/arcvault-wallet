# ArcVault release hardening

This release applies the zero-bug testnet gate to the ArcVault wallet surface.

- Firebase ID-token authorization is enforced at the API boundary.
- Circle wallet operations are bound to the authenticated Firebase identity.
- Client-generated recovery strings are no longer accepted as wallet credentials.
- The bridge UI is disabled until a verified CCTP implementation is connected.
- WalletConnect UI no longer reports a simulated session as approved.
- Arc native gas precision and ERC-20 display precision are documented separately.
- Vercel security headers and PWA metadata are included.
