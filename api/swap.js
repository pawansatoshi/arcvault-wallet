import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const { walletId, fromSymbol, amount } = req.body;

    if (!walletId || !fromSymbol || !amount) return res.status(400).json({ error: "Missing parameters." });
    if (!ENTITY_SECRET) return res.status(500).json({ error: "Missing Entity Secret." });

    const DEX_ADDRESS = "0x09980dfDA55Fa5C761887C82FA5014D9dFaA3A9A";
    
    // Enforcing 'twrc' standard for wrapped native liquidity
    const TWRC_ADDRESS = "0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA".toLowerCase();
    const TARC_ADDRESS = "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78".toLowerCase();

    // Route the correct ERC-20 asset
    const tokenInAddress = (fromSymbol === 'twrc' || fromSymbol === 'USDC') ? TWRC_ADDRESS : TARC_ADDRESS;
    const scaledAmount = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString();

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const keyData = await keyRes.json();
        if (!keyRes.ok) throw new Error("Failed to fetch Circle Public Key");

        const entitySecretBuffer = Buffer.from(ENTITY_SECRET, 'hex');
        const encryptedData = crypto.publicEncrypt({
            key: keyData.data.publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, entitySecretBuffer);
        const entitySecretCiphertext = encryptedData.toString('base64');

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: entitySecretCiphertext,
                walletId: walletId,
                contractAddress: DEX_ADDRESS,
                abiFunctionSignature: "swap(address,uint256)",
                abiParameters: [tokenInAddress, scaledAmount],
                feeLevel: "MEDIUM"
            })
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: "Swap Execution Failed", details: result });
        
        return res.status(200).json({ success: true, data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
