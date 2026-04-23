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
        
        if (!circleRes.ok && circleRes.status === 404) {
            const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
            });
            if (txRes.ok) {
                data = await txRes.json();
            }
        }

        let txHash = 
            data?.data?.transactionHash ||
            data?.data?.txHash ||
            data?.data?.blockchainTransactionHash ||
            data?.data?.result?.txHash ||
            data?.data?.result?.transactionHash;

        if (!txHash) {
            return res.status(200).json({ success: false, pending: true });
        }

        return res.status(200).json({ success: true, txHash });

    } catch (e) {
        console.error("[EXTRACT ERROR]", e);
        return res.status(200).json({ success: false, pending: true, error: e.message });
    }
}
