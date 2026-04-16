import crypto from 'crypto';

export default async function handler(req, res) {
    // Standard CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

    try {
        const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                // CRITICAL FIX: Generates a mathematically perfect UUID v4
                idempotencyKey: crypto.randomUUID(), 
                entitySecretCiphertext: ENTITY_SECRET,
                blockchains: ["ARC-TESTNET"],
                count: 1,
                walletSetId: WALLET_SET_ID,
                accountType: "SCA" 
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Passes the EXACT error array to your frontend diagnostic box
            return res.status(response.status).json({
                error: "Circle API Error",
                details: result.errors ? result.errors : result
            });
        }

        // Return exact format expected by our new frontend
        return res.status(200).json({ 
            data: { 
                wallets: [{ address: result.data.wallets[0].address }] 
            } 
        });

    } catch (err) {
        return res.status(500).json({ error: "Server Crash", details: err.message });
    }
}
