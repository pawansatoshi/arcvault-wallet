export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ error: "Missing operationId" });

        const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, {
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        
        const txData = await txRes.json();
        
        // Exact path for Circle W3S
        const txHash = txData?.data?.transaction?.txHash || txData?.data?.txHash || txData?.data?.transactionHash;

        if (!txHash) {
            return res.status(200).json({ pending: true }); // Let frontend keep polling smoothly
        }

        return res.status(200).json({ success: true, txHash });

    } catch (e) {
        return res.status(200).json({ pending: true, error: "Network glitch, retrying..." });
    }
}
