import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    
    // Target Chain ID for Arbitrum Sepolia in CCTP is typically '3'
    const DESTINATION_DOMAIN = 3; 
    const CCTP_TOKEN_MESSENGER = "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"; // Standard Testnet Messenger
    
    const { walletId, amount, targetAddress } = req.body;

    if (!walletId || !amount || !targetAddress) {
        return res.status(400).json({ error: "Missing bridging parameters." });
    }

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ENTITY_SECRET, 'hex'));

        // CCTP requires the destination address to be padded to 32 bytes (bytes32 format)
        const paddedTargetAddress = "0x" + targetAddress.replace("0x", "").padStart(64, "0");
        const scaledAmount = BigInt(Math.floor(parseFloat(amount) * 1e6)).toString(); // USDC uses 6 decimals

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString('base64'),
            walletId: walletId,
            contractAddress: CCTP_TOKEN_MESSENGER,
            abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
            abiParameters: [scaledAmount, DESTINATION_DOMAIN.toString(), paddedTargetAddress, "0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA"], // Using the tUSDC contract mapped for CCTP
            feeLevel: "MEDIUM" // USER PAYS GAS (No Sponsor Policy)
        };

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: result.message || "CCTP Burn Failed", details: result });
        
        return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
