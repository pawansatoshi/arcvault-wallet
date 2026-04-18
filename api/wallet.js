import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

    if (!ENTITY_SECRET || !WALLET_SET_ID) {
        return res.status(500).json({ error: "Server Configuration Error: Missing Entity Secret or Wallet Set ID." });
    }

    try {
        // --- STEP 1: FETCH PUBLIC KEY & ENCRYPT SECRETS ---
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

        // --- STEP 2: COMMAND CIRCLE TO FORGE THE WALLET ---
        const idempotencyKey = crypto.randomUUID();
        const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idempotencyKey: idempotencyKey,
                entitySecretCiphertext: entitySecretCiphertext, // The critical missing parameter
                blockchains: ["ARC-TESTNET"],
                count: 1,
                walletSetId: WALLET_SET_ID 
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: "Circle API Wallet Creation Failed", details: result });
        }

        return res.status(200).json({ success: true, data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
