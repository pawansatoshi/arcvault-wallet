from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'api'

for path in API.glob('*.js'):
    if path.name == '_auth.js':
        continue
    text = path.read_text()
    if "from './_auth.js'" not in text:
        text = "import { requireAuth, requireOwnedWallet, authError } from './_auth.js';\n" + text
    marker = 'export default async function handler(req, res) {'
    if marker in text and 'let __authResult;' not in text:
        guard = """export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
    let __authResult;
    try { __authResult = await requireAuth(req); } catch (e) { return authError(res, e); }
"""
        text = text.replace(marker, guard, 1)
    path.write_text(text)

path = API / 'wallet.js'
text = path.read_text()
text = text.replace('const { userId } = req.body;', 'const userId = __authResult.uid;')
if 'refId: userId' not in text:
    text = text.replace('accountType: "EOA"', 'accountType: "EOA",\n            refId: userId')
path.write_text(text)

for name in ('balance.js', 'transfer.js', 'approve.js', 'swap.js'):
    path = API / name
    text = path.read_text()
    if 'requireOwnedWallet(req, walletId)' not in text:
        if name == 'balance.js':
            needle = 'const { walletId } = req.body;'
            text = text.replace(needle, needle + "\n    try { await requireOwnedWallet(req, walletId); } catch (e) { return authError(res, e); }", 1)
        else:
            match = re.search(r'const \{ walletId,.*?\};', text, re.S)
            if match:
                text = text[:match.end()] + "\n    try { await requireOwnedWallet(req, walletId); } catch (e) { return authError(res, e); }" + text[match.end():]
    path.write_text(text)

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

path = ROOT / 'index.html'
text = path.read_text()

start_marker = 'window.downloadMasterKey ='
end_marker = '\n        function updateClocks'
if start_marker in text and end_marker in text:
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    secure_recovery = '''window.downloadMasterKey = () => {
            showError("Recovery Safety", "Client-generated recovery strings are not wallet credentials. Use your linked Firebase sign-in provider to recover access.", "ERR-RECOVERY-DISABLED");
        };
        window.processRecovery = () => {
            showError("Recovery Disabled", "This build does not accept client-generated recovery keys. Authenticate with a linked provider instead.", "ERR-RECOVERY-DISABLED");
        };
'''
    text = text[:start] + secure_recovery + text[end:]

start_marker = 'window.simulateWalletConnect ='
end_marker = '\n\n        window.startQRScanner'
if start_marker in text and end_marker in text:
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    wc = '''window.simulateWalletConnect = () => {
            document.getElementById('wc-action-bar').classList.add('hidden');
            showError("WalletConnect Not Configured", "A QR URI can be detected, but this build does not contain a real WalletConnect session engine. No wallet session was approved.", "ERR-WC-NOT-CONFIGURED");
        };'''
    text = text[:start] + wc + text[end:]

start_marker = 'window.executeBridge = async () => {'
end_marker = '\n        };\n\n        window.startExperience'
if start_marker in text and end_marker in text:
    start = text.index(start_marker)
    end = text.index(end_marker, start) + len('\n        };')
    bridge = '''window.executeBridge = async () => {
            showError("Bridge Unavailable", "The bridge surface is disabled until a verified CCTP integration is connected. No assets were moved.", "ERR-BRIDGE-DISABLED");
        };'''
    text = text[:start] + bridge + text[end:]

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

text = text.replace("body: JSON.stringify({ destinationAddress: document.getElementById('wallet-address').innerText })", "body: JSON.stringify({ walletId: wId })")
text = text.replace('strict 6-decimal input masking (to prevent 18-decimal gas errors)', '6-decimal display formatting with separate native-gas precision')
path.write_text(text)
print('ArcVault hardening applied')
