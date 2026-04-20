export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { walletId, blockchain } = req.body;
    // Default to ARC-TESTNET if not provided
    const targetChain = blockchain || 'ARC-TESTNET';

    try {
        const response = await fetch(`https://api.circle.com/v1/w3s/wallets/${walletId}/balances?blockchain=${targetChain}`, {
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: "Balance sync failed" });
    }
}
