export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { walletId, blockchain } = req.body;
        if (!walletId) return res.status(400).json({ error: "Missing walletId" });

        // 🔥 THE FIX: Pass the specific blockchain dynamically in the Circle API URL
        let url = `https://api.circle.com/v1/w3s/wallets/${walletId}/balances`;
        if (blockchain) {
            url += `?blockchain=${blockchain}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` }
        });

        const data = await response.json();
        return res.status(200).json(data);

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
