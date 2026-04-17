import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const { walletId, destinationAddress, amount, tokenId } = req.body;

    if (!walletId || !destinationAddress || !amount) {
        return res.status(400).json({ error: "Missing required parameters." });
    }

    const idempotencyKey = crypto.randomUUID();

    try {
        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idempotencyKey: idempotencyKey,
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
