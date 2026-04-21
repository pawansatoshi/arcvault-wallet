import { ethers } from 'ethers';

export default async function handler(req, res) {
    const { txHash } = req.body;

    try {
        // 1. Connect to Source RPC (Arc Testnet)
        const provider = new ethers.JsonRpcProvider("https://testnet-rpc.arc.network");
        const receipt = await provider.getTransactionReceipt(txHash);

        if (!receipt || receipt.status === 0) {
            throw new Error("Transaction not mined or reverted on-chain.");
        }

        // 2. Exact signature for CCTP MessageSent(bytes message)
        const MESSAGE_SENT_TOPIC = "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";
        const log = receipt.logs.find(l => l.topics[0] === MESSAGE_SENT_TOPIC);
        
        if (!log) throw new Error("MessageSent log missing. depositForBurn likely failed.");

        // 3. CRITICAL FIX: ABI-Decode the dynamic bytes payload
        const abiCoder = new ethers.AbiCoder();
        const decodedMessage = abiCoder.decode(['bytes'], log.data)[0];

        // 4. CRITICAL FIX: Use Ethereum Keccak256, NOT Node.js SHA3
        const messageHash = ethers.keccak256(decodedMessage);

        return res.status(200).json({ 
            success: true, 
            messageBytes: decodedMessage, // Send this exactly to receiveMessage
            messageHash: messageHash      // Send this to Iris API
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
