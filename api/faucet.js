import crypto from 'crypto';

export default async function handler(req, res) {
    // Standard CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const { walletId } = req.body;

    if (!walletId) return res.status(400).json({ error: "Missing walletId." });
    if (!ENTITY_SECRET) return res.status(500).json({ error: "Missing Entity Secret." });

    // YOUR DEPLOYED FAUCET CONTRACT ADDRESS
    const FAUCET_ADDRESS = "0x1A4EAee21145bdB6bDd69808865105dBc1dF118F";

    try {
        // 1. Fetch Public Key & Encrypt Entity Secret
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

        // 2. Execute Contract Function via Circle API
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
                contractAddress: FAUCET_ADDRESS,
                abiFunctionSignature: "claimTokens()", // The exact function in your Solidity code
                abiParameters: [], // claimTokens takes no arguments
                feeLevel: "MEDIUM"
            })
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: "Contract Execution Failed", details: result });

        return res.status(200).json({ success: true, data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
