# ArcVault Wallet 
**The Agent-Ready Mobile Financial Hub for the Arc Network**

ArcVault is a mobile-first, Progressive Web App (PWA) smart wallet engineered exclusively for the Arc Network. Designed for the "Internet Financial System," ArcVault bridges the gap between human users and autonomous AI agents through native ERC-8183 integration, zero-gas USDC infrastructure, and cross-platform identity routing.

## 🌟 Core Architecture & Features

### 1. The Omni-Name Routing Engine
ArcVault eliminates raw `0x` addresses for a true Venmo-style Web3 experience. Our Smart Search input automatically resolves cross-platform identities instantly:
* **Native:** `@username` (Via Firebase Realtime routing)
* **Farcaster:** `fc:username` (Resolved via Airstack API)
* **Basenames:** `name.base.eth` (Resolved via Base RPC)
* **ENS/Unstoppable:** `.eth` / `.crypto` (Resolved natively via ethers.js)

### 2. Built for the Agentic Economy (ERC-8183)
ArcVault is the first mobile client built specifically to support Arc's new Agentic Economy standard.
* **Agent Permissions:** Seamlessly fund and manage ERC-8183 job escrows directly from the mobile UI.
* **Orchestrator Support:** Native compatibility for verifying and funding external AI swarms (e.g., Moltbook orchestrators and Openclaw agents).
* **Yield Routing:** Users can allow specific agents to route idle USDC into USYC to farm treasury yield while awaiting job execution.

### 3. Institutional-Grade Security & UI
* **Circle MPC Integration:** Seedless, user-controlled wallets utilizing Circle's Programmable Wallets infrastructure.
* **WebAuthn Passkeys:** Passwordless onboarding using native device biometrics (FaceID/Fingerprint).
* **Q-Ready:** Built to seamlessly transition into Arc's post-quantum signature schemes at the consensus layer.
* **Sensory Polish:** Features CSS Glassmorphism, strict 6-decimal input masking (to prevent 18-decimal gas errors), JS haptic feedback, and a native Web Audio API Engine featuring an Apple-style success chime and a 432Hz ambient "Zen Mode."

### 4. Zero-Friction Transacting
* **Invisible Gas:** Utilizing Arc's stable fee design, users pay network fees natively in USDC or EURC. No volatile gas tokens required.
* **1-Click Batching:** Leveraging Account Abstraction (ERC-4337) to bundle `Approve` and `Swap` contracts into a single biometric scan.

## 🛠️ The Tech Stack (Zero-Cost Mobile Build)
ArcVault is engineered to be lightweight, lightning-fast, and completely bypass centralized App Store constraints.
* **Frontend:** Vanilla HTML5, JavaScript, Tailwind CSS (via CDN)
* **Deployment:** Vercel (Edge Network)
* **App Distribution:** PWA (Progressive Web App) via `manifest.json` and Service Workers.
* **Authentication:** Firebase Auth + WebAuthn
* **Blockchain Rails:** Circle Developer Testnet API, ethers.js

## 🚀 Quick Start & Deployment

You can deploy your own instance of ArcVault directly from your mobile browser for free.

1. Fork or clone this repository.
2. Ensure `index.html`, `manifest.json`, and `sw.js` are in the root directory.
3. Import the repository into [Vercel](https://vercel.com/).
4. Deploy the project.
5. Open the Vercel live link on any mobile browser (Chrome/Safari/Mises) and select **"Add to Home Screen"** to install the native PWA.

## 🔗 Official Ecosystem Links
* **Arc Network Documentation:** [docs.arc.network](https://docs.arc.network/arc/concepts/welcome-to-arc)
* **Arc Contract Addresses:** [Arc Reference](https://docs.arc.network/arc/references/contract-addresses)
* **Circle Developer Console:** [console.circle.com](https://console.circle.com/)
* **Arc House Community:** [community.arc.network](https://community.arc.network/)
* **ERC-8183 Implementation:** [Create your first ERC-8183 job](https://docs.arc.network/arc/tutorials/create-your-first-erc-8183-job)

---
*Built with precision for the Arc House Architects Program.*
