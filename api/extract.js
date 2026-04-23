export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ error: "Missing operationId" });

        // 1. Check operations endpoint directly to see the true state
        let opRes = await fetch(`https://api.circle.com/v1/w3s/operations/${operationId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        
        let opData = await opRes.json();
        
        // 🔥 If Circle rejected it, tell the frontend to STOP polling
        if (opData?.data?.state === 'FAILED') {
            return res.status(200).json({ pending: false, error: "Transaction FAILED on Circle W3S" });
        }

        // 2. Safely extract txHash if it's COMPLETED
        const txHash = opData?.data?.transactionHash || opData?.data?.txHash;

        if (!txHash) {
            return res.status(200).json({ pending: true }); 
        }

        return res.status(200).json({ success: true, txHash });

    } catch (e) {
        return res.status(200).json({ pending: true, error: "Network glitch, retrying..." });
    }
}
