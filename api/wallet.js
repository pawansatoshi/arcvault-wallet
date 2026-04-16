import crypto from 'crypto';

export default async function handler(req, res) {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const RAW_SECRET_HEX = process.env.CIRCLE_ENTITY_SECRET; // The 64-character code
    const WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

    try {
        // 2. Fetch Circle's Public Key dynamically
        const pubKeyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const pubKeyData = await pubKeyRes.json();
        
        if (!pubKeyRes.ok) {
            throw new Error("Failed to fetch Circle public key");
        }
        
        const publicKeyPem = pubKeyData.data.publicKey;

        // 3. The "Architect Engine": Encrypt the secret on the fly
        const entitySecretBuffer = Buffer.from(RAW_SECRET_HEX, 'hex');
        const encryptedBuffer = crypto.publicEncrypt({
            key: publicKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, entitySecretBuffer);
        
        const freshCiphertext = encryptedBuffer.toString('base64');

        // 4. Create the wallet using the freshly generated ticket
        const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: freshCiphertext,
                blockchains: ["ARC-TESTNET"],
                count: 1,
                walletSetId: WALLET_SET_ID,
                accountType: "SCA" 
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: "Circle API Error",
                details: result.errors ? result.errors : result
            });
        }

        // Return the final address
        return res.status(200).json({ 
            data: { 
                wallets: [{ address: result.data.wallets[0].address }] 
            } 
        });

    } catch (err) {
        return res.status(500).json({ error: "Server Engine Crash", details: err.message });
    }
}
