// /api/extract.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;

        if (!operationId) {
            return res.status(400).json({ success: false, error: "Missing operationId" });
        }

        const circleRes = await fetch(`https://api.circle.com/v1/w3s/operations/${operationId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        let data = await circleRes.json();

        // fallback
        if (!circleRes.ok && circleRes.status === 404) {
            const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`
                }
            });
            if (txRes.ok) {
                data = await txRes.json();
            }
        }

        const state = data?.data?.state;

        // 🚨 HANDLE FAILURE (CRITICAL)
        if (state === "failed
