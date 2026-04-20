// api/receipt.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { txHash } = req.body;

    if (!txHash) return res.status(400).json({ error: "Missing txHash" });

    try {
        const response = await fetch('https://testnet-rpc.arc.network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                jsonrpc: "2.0", 
                id: 1, 
                method: "eth_getTransactionReceipt", 
                params: [txHash] 
            })
        });
        
        const data = await response.json();
        return res.status(200).json(data);
    } catch(e) {
        return res.status(500).json({ error: e.message });
    }
}
