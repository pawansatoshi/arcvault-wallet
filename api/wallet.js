import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const idempotencyKey = crypto.randomUUID();

    try {
        const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idempotencyKey: idempotencyKey,
                blockchains: ["ARC-TESTNET"],
                count: 1,
                walletSetId: process.env.CIRCLE_WALLET_SET_ID 
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: "Circle API Wallet Creation Failed", details: result });
        }

        return res.status(200).json({ data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
