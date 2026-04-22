export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const { txHash } = req.body;

    try {
        const rpcRes = await fetch('https://testnet-rpc.arc.network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getTransactionReceipt",
                params: [txHash],
                id: 1
            })
        });

        const rpcData = await rpcRes.json();
        const receipt = rpcData.result;

        if (!receipt) {
            return res.status(200).json({ status: "pending" });
        }

        // 🔴 REVERTED
        if (receipt.status === "0x0") {
            return res.status(200).json({ status: "reverted", txHash });
        }

        // ✅ SUCCESS
        if (receipt.status === "0x1") {
            return res.status(200).json({ status: "success", logs: receipt.logs, txHash });
        }

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
}
