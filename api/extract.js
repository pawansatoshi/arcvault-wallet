export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ error: "Missing operationId" });

        // 1. Check if Circle rejected the operation
        const opRes = await fetch(`https://api.circle.com/v1/w3s/operations/${operationId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        const opData = await opRes.json();

        if (opData?.data?.state === 'FAILED') {
            return res.status(200).json({ pending: false, error: "Circle W3S rejected the transaction. Please clear localStorage and retry." });
        }

        // 2. Fetch the transaction list to get the actual txHash
        const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions?operationId=${operationId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });

        if (txRes.ok) {
            const txData = await txRes.json();
            // 🔥 THE FIX: Correctly pathing into the transactions array
            if (txData?.data?.transactions && txData.data.transactions.length > 0) {
                const tx = txData.data.transactions[0];
                const txHash = tx.txHash || tx.transactionHash;
                
                if (txHash) {
                    return res.status(200).json({ success: true, txHash });
                }
            }
        }

        // Still pending on blockchain...
        return res.status(200).json({ pending: true });

    } catch (e) {
        return res.status(200).json({ pending: true, error: "Network glitch, retrying..." });
    }
}
