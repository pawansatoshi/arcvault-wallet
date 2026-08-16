from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'api'

# Add Firebase ID-token authorization to every API route.
for path in API.glob('*.js'):
    if path.name == '_auth.js':
        continue
    text = path.read_text()
    if "from './_auth.js'" not in text:
        text = "import { requireAuth, requireOwnedWallet, authError } from './_auth.js';\n" + text
    marker = 'export default async function handler(req, res) {'
    if marker in text and 'const __authResult = await requireAuth(req)' not in text:
        guard = """export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
    let __authResult;
    try { __authResult = await requireAuth(req); } catch (e) { return authError(res, e); }
"""
        text = text.replace(marker, guard, 1)
    path.write_text(text)

# Bind new Circle wallets to the authenticated Firebase UID.
path = API / 'wallet.js'
text = path.read_text()
text = text.replace('const { userId } = req.body;', 'const userId = __authResult.uid;')
text = text.replace('accountType: "EOA"', 'accountType: "EOA",\n            refId: userId')
path.write_text(text)

# Prove ownership before privileged wallet operations.
for name in ('balance.js', 'transfer.js', 'approve.js', 'swap.js'):
    path = API / name
    text = path.read_text()
    if 'requireOwnedWallet(req, walletId)' not in text:
        if name == 'balance.js':
            needle = 'const { walletId } = req.body;'
            replacement = needle + "\n    try { await requireOwnedWallet(req, walletId); } catch (e) { return authError(res, e); }"
            text = text.replace(needle, replacement, 1)
        else:
            match = re.search(r'const \{ walletId,.*?\};', text, re.S)
            if match:
                replacement = match.group(0) + "\n    try { await requireOwnedWallet(req, walletId); } catch (e) { return authError(res, e); }"
                text = text[:match.start()] + replacement + text[match.end():]
    path.write_text(text)

# Faucet payouts can only target the authenticated wallet returned by Circle.
path = API / 'faucet.js'
text = path.read_text()
old = '''const { destinationAddress } = req.body;
    if (!destinationAddress) return res.status(400).json({ success: false, error: "Destination required." });'''
new = '''const { walletId } = req.body;
    let __owned;
    try { __owned = await requireOwnedWallet(req, walletId); } catch (e) { return authError(res, e); }
    const destinationAddress = __owned.wallet.address;'''
text = text.replace(old, new, 1)
path.write_text(text)

# Patch the browser bundle without replacing the whole 100KB file manually.
path = ROOT / 'index.html'
text = path.read_text()

master_pattern = r'window\.downloadMasterKey = \(\) => \{.*?\n        \};\n        window\.processRecovery = .*?\n        \};'
master_replacement = '''window.downloadMasterKey = () => {
            showError("Recovery Safety", "Client-generated recovery strings are not wallet credentials. Use your linked Firebase sign-in provider to recover access.", "ERR-RECOVERY-DISABLED");
        };
        window.processRecovery = () => {
            showError("Recovery Disabled", "This build does not accept client-generated recovery keys. Authenticate with a linked provider instead.", "ERR-RECOVERY-DISABLED");
        };'''
text = re.sub(master_pattern, master_replacement, text, count=1, flags=re.S)

wc_pattern = r'window\.simulateWalletConnect = \(\) => \{.*?\n        \};'
wc_replacement = '''window.simulateWalletConnect = () => {
            document.getElementById('wc-action-bar').classList.add('hidden');
            showError("WalletConnect Not Configured", "A QR URI can be detected, but this build does not contain a real WalletConnect session engine. No wallet session was approved.", "ERR-WC-NOT-CONFIGURED");
        };'''
text = re.sub(wc_pattern, wc_replacement, text, count=1, flags=re.S)

bridge_pattern = r'window\.executeBridge = async \(\) => \{.*?\n        \};'
bridge_replacement = '''window.executeBridge = async () => {
            showError("Bridge Unavailable", "The bridge surface is disabled until a verified CCTP integration is connected. No assets were moved.", "ERR-BRIDGE-DISABLED");
        };'''
text = re.sub(bridge_pattern, bridge_replacement, text, count=1, flags=re.S)

# Attach Firebase ID tokens to all first-party API calls.
anchor = 'const db = getFirestore(app);'
if 'window.__arcvaultApiFetchInstalled' not in text and anchor in text:
    injection = '''
        if (!window.__arcvaultApiFetchInstalled) {
            window.__arcvaultApiFetchInstalled = true;
            const __nativeFetch = window.fetch.bind(window);
            window.fetch = async (input, init = {}) => {
                const url = typeof input === 'string' ? input : input?.url || '';
                if (url.startsWith('/api/')) {
                    const user = auth.currentUser;
                    if (user) {
                        const token = await user.getIdToken();
                        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
                        headers.set('Authorization', `Bearer ${token}`);
                        init = { ...init, headers };
                    }
                }
                return __nativeFetch(input, init);
            };
        }
'''
    text = text.replace(anchor, anchor + injection, 1)

# Faucet sends walletId; server resolves the destination from Circle.
text = text.replace(
    "body: JSON.stringify({ destinationAddress: document.getElementById('wallet-address').innerText })",
    "body: JSON.stringify({ walletId: wId })",
)

# Keep Arc gas precision terminology explicit.
text = text.replace(
    'strict 6-decimal input masking (to prevent 18-decimal gas errors)',
    '6-decimal display formatting with separate native-gas precision',
)

path.write_text(text)
print('ArcVault hardening applied')
