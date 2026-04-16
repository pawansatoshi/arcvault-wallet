export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, action } = req.body;
    
    // Pulling the keys we just fixed in Vercel
    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

    try {
        if (action === "create") {
            const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    idempotencyKey: crypto.randomUUID(),
                    entitySecretCiphertext: ENTITY_SECRET, // Fixed name!
                    blockchains: ["ARC-TESTNET"],
                    count: 1,
                    walletSetId: WALLET_SET_ID,
                    accountType: "SCA" 
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error("Circle API Error:", data);
                return res.status(response.status).json(data);
            }

            return res.status(200).json(data);
        }
    } catch (err) {
        console.error("Server Error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
