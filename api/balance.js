export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const { walletId } = req.body;

    if (!walletId) return res.status(400).json({ error: "Missing walletId parameter" });

    try {
        const response = await fetch(`https://api.circle.com/v1/w3s/wallets/${walletId}/balances`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: result.message || "Balance Fetch Failed", details: result });
        
        return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
