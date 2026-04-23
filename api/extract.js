export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ success: false, error: "Missing operationId" });

        // 1. Fetch from Circle Transactions API
        const txRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, {
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        
        const txData = await txRes.json();
        
        // 🔥 THE BUG FIX: Circle nests txHash inside the "transaction" object!
        const txHash = txData?.data?.transaction?.txHash || txData?.data?.txHash || txData?.data?.transactionHash;

        if (!txHash) {
            return res.status(200).json({ success: true, pending: true });
        }

        // 2. Fetch Receipt from Arc RPC Directly from Backend (Bypasses Frontend CORS issues)
        const rpcRes = await fetch("https://testnet-rpc.arc.network", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getTransactionReceipt",
                params: [txHash]
            })
        });

        const rpcData = await rpcRes.json();
        const receipt = rpcData.result;

        if (!receipt) {
            return res.status(200).json({ success: true, pending: true, txHash });
        }

        if (receipt.status === "0x0" || receipt.status === 0) {
            return res.status(200).json({ success: false, reverted: true, txHash });
        }

        // 3. Extract Message Bytes safely
        const log = receipt.logs.find(l => l.topics && l.topics[0] === "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036");
        
        if (!log || !log.data) {
            return res.status(200).json({ success: false, error: "No CCTP log found in transaction" });
        }

        let dataHex = log.data.replace(/^0x/, '');
        const offset = parseInt(dataHex.substring(0, 64), 16) * 2;
        const length = parseInt(dataHex.substring(offset, offset + 64), 16) * 2;
        const messageBytes = "0x" + dataHex.substring(offset + 64, offset + 64 + length);

        return res.status(200).json({ 
            success: true, 
            pending: false, 
            txHash, 
            messageBytes 
        });

    } catch (e) {
        return res.status(200).json({ success: true, pending: true, error: e.message });
    }
}
