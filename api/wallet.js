export default async function handler(req, res) {
    // Standard Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET; // This MUST be the 684-character code
    const WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

    try {
        console.log("🛠️ Attempting to contact Circle API...");
        
        const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                idempotencyKey: `arc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                entitySecretCiphertext: ENTITY_SECRET,
                blockchains: ["ARC-TESTNET"],
                count: 1,
                walletSetId: WALLET_SET_ID,
                accountType: "SCA" 
            })
        });

        const result = await response.json();
        
        // This log is the most important part!
        console.log("🔍 FULL CIRCLE RESPONSE:", JSON.stringify(result));

        if (!response.ok) {
            return res.status(response.status).json({
                error: "Circle Rejected Request",
                details: result.message || result
            });
        }

        // If successful, Circle returns an array. We need to grab the first wallet.
        const walletAddress = result.data.wallets[0].address;
        console.log("✅ Wallet Created Successfully:", walletAddress);

        return res.status(200).json({ address: walletAddress });

    } catch (err) {
        console.error("🚨 Server Crash Error:", err.message);
        return res.status(500).json({ error: "Server Crash", details: err.message });
    }
}
