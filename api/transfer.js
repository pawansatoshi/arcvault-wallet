import crypto from 'crypto';

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET; // You MUST add this to Vercel
    const { walletId, destinationAddress, amount, tokenId } = req.body;

    if (!walletId || !destinationAddress || !amount) {
        return res.status(400).json({ error: "Missing required parameters." });
    }
    
    if (!ENTITY_SECRET) {
        return res.status(500).json({ error: "Server Configuration Error: Missing Entity Secret." });
    }

    const idempotencyKey = crypto.randomUUID();

    try {
        // STEP 1: Fetch Circle's Public Key
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const keyData = await keyRes.json();
        
        if (!keyRes.ok) {
            throw new Error("Failed to fetch Circle Public Key");
        }

        // STEP 2: Encrypt your Entity Secret
        const entitySecretBuffer = Buffer.from(ENTITY_SECRET, 'hex');
        const encryptedData = crypto.publicEncrypt({
            key: keyData.data.publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, entitySecretBuffer);
        const entitySecretCiphertext = encryptedData.toString('base64');

        // STEP 3: Execute Transfer with the Ciphertext included
        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idempotencyKey: idempotencyKey,
                entitySecretCiphertext: entitySecretCiphertext, // CRITICAL FIX
                walletId: walletId,
                destinationAddress: destinationAddress,
                amounts: [amount.toString()],
                tokenId: tokenId || "7b2bf0df-a1bd-5dd0-b5bc-180b181dbb3a", 
                feeLevel: "MEDIUM"
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: "Circle Transfer Failed", details: result });
        }

        return res.status(200).json({ success: true, data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
