import { ethers } from 'ethers';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { operationId } = req.body;
    
    try {
        // Step A: Get the actual Blockchain Tx Hash from Circle W3S
        const circleRes = await fetch(`https://api.circle.com/v1/w3s/transactions/${operationId}`, {
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        const circleData = await circleRes.json();
        
        if (circleData.data.transaction.state !== 'COMPLETE') {
            return res.status(202).json({ status: "pending" }); // Burn still processing
        }
        
        const txHash = circleData.data.transaction.txHash;

        // Step B: Connect to Source Chain to extract logs
        const arcProvider = new ethers.JsonRpcProvider("https://testnet-rpc.arc.network");
        const receipt = await arcProvider.getTransactionReceipt(txHash);

        if (!receipt) {
            return res.status(202).json({ status: "pending" }); // Waiting for RPC indexer
        }

        // Step C: Isolate the MessageSent event signature
        const MESSAGE_SENT_TOPIC = "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";
        const log = receipt.logs.find(l => l.topics[0] === MESSAGE_SENT_TOPIC);
        
        if (!log) throw new Error("MessageSent log not found in receipt.");
        
        // Step D: Format bytes for Iris
        const messageBytes = log.data;
        const messageHash = ethers.keccak256(messageBytes);

        return res.status(200).json({ status: "extracted", messageBytes, messageHash });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
