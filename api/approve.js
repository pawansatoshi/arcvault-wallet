import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const { walletId, tokenAddress, amount } = req.body;

    if (!walletId || !tokenAddress || !amount) return res.status(400).json({ error: "Missing parameters." });

    const DEX_ADDRESS = "0x09980dfDA55Fa5C761887C82FA5014D9dFaA3A9A";
    const scaledAmount = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString();

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const keyData = await keyRes.json();
        
        const entitySecretBuffer = Buffer.from(ENTITY_SECRET, 'hex');
        const encryptedData = crypto.publicEncrypt({
            key: keyData.data.publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, entitySecretBuffer);
        const entitySecretCiphertext = encryptedData.toString('base64');

        // Command Circle to approve the DEX
        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: entitySecretCiphertext,
                walletId: walletId,
                contractAddress: tokenAddress,
                abiFunctionSignature: "approve(address,uint256)",
                abiParameters: [DEX_ADDRESS, scaledAmount],
                feeLevel: "MEDIUM"
            })
        });

        const result = await response.json();
        return res.status(200).json({ success: true, data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
