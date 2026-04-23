export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ error: "Missing operationId" });

        // 🔥 THE FIX: Search the transactions list BY operationId using a query parameter
        const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions?operationId=${operationId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        
        if (!txRes.ok) {
            return res.status(200).json({ pending: true }); 
        }

        const data = await txRes.json();
        
        // Grab the txHash from the first transaction in the returned array
        if (data?.data?.transactions && data.data.transactions.length > 0) {
            const tx = data.data.transactions[0];
            const txHash = tx.txHash || tx.transactionHash;
            
            if (txHash) {
                return res.status(200).json({ success: true, txHash });
            }
        }

        // If the blockchain hasn't generated the transaction yet, keep pending safely
        return res.status(200).json({ pending: true });

    } catch (e) {
        return res.status(200).json({ pending: true, error: e.message });
    }
}
