<div align="center">

# ArcVault

### Arc-native mobile wallet & financial control layer

<p><strong>Testnet-first • Mobile-first • Agent-ready • PWA</strong></p>

<p>
  <a href="https://arcvault-wallet.vercel.app/"><strong>Live App</strong></a> ·
  <a href="https://github.com/pawansatoshi/arcvault-wallet/issues">Issues</a> ·
  <a href="https://docs.arc.io/">Arc Docs</a>
</p>

</div>

---

> **Status: Arc Testnet / experimental.** ArcVault is a development project, not a production custody product. Use test wallets and testnet funds only. Never enter a production private key or recovery secret into this application.

## Overview

ArcVault is a mobile-first Progressive Web App built around the Arc Testnet. It combines wallet operations, Arc-native USDC flows, identity-aware UX, transaction history, network management and an experimental DApp surface in a single lightweight interface.

The project is deliberately designed as a **testnet engineering playground**: functionality is exposed through a polished mobile UI while security boundaries, API authorization and on-chain behavior are treated as first-class release gates.

## What ArcVault provides

| Area | Capability | Status |
| --- | --- | --- |
| Wallet | Circle Programmable Wallet-backed account creation | Testnet |
| Authentication | Firebase Auth with social/email providers | Testnet |
| Arc | Arc Testnet wallet and USDC flows | Active |
| Transfers | API-mediated testnet token transfers | Active |
| Ledger | Firestore-backed transaction history | Active |
| Networks | Arc + configurable EVM networks | Experimental |
| DApp surface | URL / QR exploration | Experimental |
| Swaps | Project testnet swap integration | Experimental |
| Bridge | UI scaffold pending verified CCTP integration | Disabled until verified |
| PWA | Installable mobile web application | Active |

## Arc Testnet configuration

Arc Testnet uses **USDC as its native gas asset**. Native gas accounting uses 18-decimal internal precision, while the ERC-20 USDC interface uses 6 decimals. ArcVault must therefore distinguish **display precision** from **transaction precision**.

| Parameter | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Native gas | USDC |
| CCTP domain | `26` |
| Finality | Deterministic; 1 confirmation is sufficient |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` |

See the official Arc documentation for the authoritative network configuration.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                         ArcVault PWA                        │
│                                                             │
│  Mobile UI • Auth • Wallet • Ledger • Network Manager      │
│  DApp surface • QR • Testnet transaction UX                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────┐
│                       Vercel API layer                      │
│                                                             │
│  Auth validation • Circle API integration • validation      │
│  wallet creation • balance • transfer • status • swap      │
└──────────────────────────────┬──────────────────────────────┘
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
      Firebase Auth / Firestore          Circle Programmable
                                         Wallets infrastructure
             │                                   │
             └─────────────────┬─────────────────┘
                               ▼
                         Arc Testnet
```

### Design principles

1. **No secret material in the browser.** Circle API credentials and entity secrets belong only in server-side environment variables.
2. **Authenticated API boundaries.** Browser authentication must not be treated as authorization by itself; server endpoints validate the caller before performing privileged operations.
3. **Explicit testnet status.** Experimental or simulated functionality must never be presented as completed on-chain settlement.
4. **Correct Arc accounting.** Native gas precision and ERC-20 display precision are handled separately.
5. **Fail closed.** Unverified bridge or recovery mechanisms should be unavailable rather than silently performing a different operation.

## Security model

ArcVault is a testnet application, but its release process follows production-minded security principles:

- Firebase ID-token validation for privileged API operations.
- Circle credentials kept in Vercel server-side environment variables.
- No private keys or entity secrets shipped to the client bundle.
- Input validation for wallet IDs, EVM addresses, amounts and asset identifiers.
- Explicit separation between testnet simulation and confirmed transactions.
- Security headers at the Vercel edge.
- Service-worker cache limited to same-origin application assets.
- Recovery UX does **not** treat a client-generated string as proof of wallet ownership.

## Technology

- **Frontend:** HTML5, JavaScript, Tailwind CSS
- **PWA:** Web App Manifest + Service Worker
- **Authentication:** Firebase Authentication
- **Database:** Firebase Firestore
- **Wallet infrastructure:** Circle Programmable Wallets
- **Blockchain:** Arc Testnet / EVM
- **API runtime:** Vercel Functions
- **Web3 tooling:** ethers.js
- **JWT verification:** jose
- **Deployment:** Vercel

## Local development

### Requirements

- Node.js 18+
- npm
- A Firebase project
- Circle Developer credentials for server-side wallet flows
- Arc Testnet access / test funds

### Install

```bash
git clone https://github.com/pawansatoshi/arcvault-wallet.git
cd arcvault-wallet
npm install
```

### Environment variables

Configure secrets in your local `.env` or Vercel project settings. **Do not commit them.**

```text
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_MASTER_WALLET_ID=
WALLET_SET_ID=
FIREBASE_PROJECT_ID=arcvault-cc843
```

Firebase browser configuration is public client configuration. Privileged Circle credentials and server secrets must remain server-side.

### Run

ArcVault is a static-first application with Vercel Functions under `/api`. For the closest local reproduction of production behavior, use Vercel's local development workflow or deploy a preview build.

## Release / QA gate

Before calling a build release-ready, validate the complete checklist in [`QA_RELEASE_GATE.md`](QA_RELEASE_GATE.md).

### Frontend

- [ ] Mobile viewport: 320px, 360px, 390px, 412px+
- [ ] Desktop viewport: 1024px, 1280px, 1440px+
- [ ] No modal overflow or horizontal scrolling
- [ ] PWA manifest loads
- [ ] Service worker installs and updates correctly
- [ ] Refresh does not corrupt authenticated state
- [ ] Loading and failure states are visible

### Authentication

- [ ] Google login
- [ ] X login where Firebase provider configuration permits it
- [ ] GitHub login
- [ ] Email login/signup
- [ ] Logout clears local authorization state
- [ ] Unlinking the only sign-in provider is blocked
- [ ] Privileged API calls require a valid Firebase ID token

### Blockchain

- [ ] Arc Testnet chain ID is `5042002`
- [ ] Arc RPC is reachable
- [ ] USDC display precision is correct
- [ ] Native gas precision is not confused with ERC-20 precision
- [ ] Transfer amounts are validated before submission
- [ ] Receipts / operation status are checked before reporting success
- [ ] Explorer links are generated only for real transaction hashes

### Security

- [ ] No Circle secret appears in client source
- [ ] No fake recovery credential can impersonate another Firebase UID
- [ ] No endpoint accepts arbitrary wallet ownership claims
- [ ] Bridge is disabled until a real bridge protocol is integrated
- [ ] Faucet endpoints are authenticated and wallet-bound
- [ ] Security headers are present in production

## Known testnet limitations

ArcVault is intentionally a testnet project. Network conditions, APIs and testnet assets can change. Experimental features should not be interpreted as production financial infrastructure.

The DApp browser and custom-network surface are convenience features and do not constitute a secure browser wallet sandbox. The bridge surface remains disabled until it is connected to a verified CCTP flow.

## Project structure

```text
arcvault-wallet/
├── api/
│   ├── approve.js
│   ├── balance.js
│   ├── faucet.js
│   ├── status.js
│   ├── swap.js
│   ├── transfer.js
│   ├── wallet.js
│   └── _auth.js
├── scripts/
│   └── harden_release.py
├── index.html
├── manifest.json
├── sw.js
├── logo.png
├── package.json
├── vercel.json
├── QA_RELEASE_GATE.md
└── README.md
```

## Contributing

Keep changes small, testable and explicit about their testnet status. Do not commit API credentials, entity secrets, private keys, service-account JSON files or generated wallet secrets.

For security-sensitive changes, verify both sides of the boundary:

```text
browser → authenticated API request → server validation → Circle / Arc
```

A UI-only security control is not considered a sufficient authorization boundary.

## Disclaimer

ArcVault is an experimental testnet project. It is provided for development, testing and demonstration purposes. It is not a bank, custodian, exchange, investment product or production wallet. Testnet assets have no intended monetary value.

## Links

- [Arc documentation](https://docs.arc.io/)
- [Arc Testnet connection guide](https://docs.arc.io/integrate/connect-to-arc)
- [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Arc bridge integration](https://docs.arc.io/integrate/infrastructure/bridges)
- [Circle Developers](https://developers.circle.com/)
- [Circle Faucet](https://faucet.circle.com/)
- [ArcScan](https://testnet.arcscan.app/)
- [Live ArcVault](https://arcvault-wallet.vercel.app/)

---

<div align="center">

**ArcVault — testnet infrastructure for the Arc-native financial interface.**

</div>
