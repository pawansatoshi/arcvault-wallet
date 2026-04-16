export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
                // Adding Date.now() ensures this is ALWAYS a unique ID
                idempotencyKey: `arcvault-${Date.now()}`, 
                entitySecretCiphertext: ENTITY_SECRET, 
                blockchains: ["ARC-TESTNET"],
                count: 1,
                walletSetId: WALLET_SET_ID,
                accountType: "SCA" 
            })
        });

        const data = await response.json();
        
        // This log is your "Black Box." It will tell us exactly why it fails.
        console.log("Circle Response:", JSON.stringify(data));

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
                    }
