export default async function handler(req, res) {
    // 1. Set headers to allow the mobile browser to talk to the API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    console.log("🚀 Request received from App...");

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

    // IMPORTANT: We need to make sure we aren't sending the raw secret 
    // to the 'ciphertext' field. Since you are using Mises/Fetch, 
    // let's ensure the Circle API is actually accepting the request.

    try {
        const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: ENTITY_SECRET, 
                blockchains: ["ARC-TESTNET"],
                count: 1,
                walletSetId: WALLET_SET_ID,
                accountType: "SCA" 
            })
        });

        const data = await response.json();
        
        // This log will appear in Vercel so we can see the REAL answer from Circle
        console.log("📦 Circle API Response:", JSON.stringify(data));

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: "Circle Config Issue", 
                details: data.message || "Unknown Error" 
            });
        }

        // Return the address directly so the Frontend sees it immediately
        return res.status(200).json(data);

    } catch (err) {
        console.error("❌ Server Crash:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
