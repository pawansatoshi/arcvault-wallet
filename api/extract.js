export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ error: "Missing operationId" });

        // 🔥 THE FIX: Correct Circle API URL (No /operations/, No /developer/)
        const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });

        if (!txRes.ok) {
            // Transaction abhi blockchain par register nahi hui hai, safely wait karo
            return res.status(200).json({ pending: true }); 
        }

        const data = await txRes.json();
        
        // Circle's JSON path: data.data.transaction.txHash OR data.data.txHash
        const txHash = data?.data?.transaction?.txHash || data?.data?.txHash;

        if (!txHash) {
            return res.status(200).json({ pending: true });
        }

        // TxHash mil gaya! Frontend loop break ho jayega.
        return res.status(200).json({ success: true, txHash });

    } catch (e) {
        return res.status(200).json({ pending: true, error: "Network glitch, retrying..." });
    }
}
