export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const { operationId } = req.body;

    try {
        const circleRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, { headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` } });
        const circleData = await circleRes.json();
        
        if (circleData.data?.transaction?.state === 'FAILED') throw new Error(`Burn Failed on-chain: ${circleData.data.transaction.errorReason}`);
        if (circleData.data?.transaction?.state !== 'COMPLETE') return res.status(200).json({ status: "pending" });
        
        const txHash = circleData.data.transaction.txHash;
        
        // Fetch raw RPC receipt to get logs
        const rpcRes = await fetch('https://testnet-rpc.arc.network', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getTransactionReceipt", params: [txHash], id: 1 })
        });
        const rpcData = await rpcRes.json();
        if (!rpcData.result || !rpcData.result.logs) return res.status(200).json({ status: "pending" });

        const MESSAGE_SENT_TOPIC = "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";
        const log = rpcData.result.logs.find(l => l.topics[0] === MESSAGE_SENT_TOPIC);
        if (!log) throw new Error("MessageSent event NOT found. TokenMessenger did not burn the token.");

        // Manual Hex decoding bypasses ABI library crashes
        let dataHex = log.data.replace('0x', '');
        const offset = parseInt(dataHex.substring(0, 64), 16) * 2;
        const length = parseInt(dataHex.substring(offset, offset + 64), 16) * 2;
        const messageBytes = "0x" + dataHex.substring(offset + 64, offset + 64 + length);

        return res.status(200).json({ status: "complete", messageBytes });
    } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
}
