export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const { txId } = req.body;

    if (!txId) return res.status(400).json({ error: "Missing Transaction ID" });

    try {
        const response = await fetch(`https://api.circle.com/v1/w3s/transactions/${txId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const result = await response.json();
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
