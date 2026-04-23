export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ error: "Missing operationId" });

        // 1. PRIMARY: Check operations endpoint (This is what we missed last time!)
        let circleRes = await fetch(`https://api.circle.com/v1/w3s/operations/${operationId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        let data = await circleRes.json();

        // 2. FALLBACK: Check transactions endpoint
        if (!circleRes.ok || !data?.data) {
            const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
            });
            if (txRes.ok) {
                data = await txRes.json();
            }
        }

        // 3. EXTRACT TX HASH safely from anywhere
        const txHash = 
            data?.data?.transactionHash ||
            data?.data?.txHash ||
            data?.data?.blockchainTransactionHash ||
            data?.data?.transaction?.txHash ||
            data?.data?.result?.txHash ||
            data?.data?.result?.transactionHash;

        if (!txHash) {
            return res.status(200).json({ pending: true }); // Let frontend keep polling
        }

        return res.status(200).json({ success: true, txHash });

    } catch (e) {
        return res.status(200).json({ pending: true, error: "Network glitch, retrying..." });
    }
}
