import crypto from 'crypto';

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const { walletId, destinationAddress, amount } = req.body;
    
    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(process.env.CIRCLE_ENTITY_SECRET, 'hex'));

        const destBytes32 = "0x" + destinationAddress.toLowerCase().replace("0x", "").padStart(64, "0");
        const rawAmount = Math.floor(parseFloat(amount) * 1e6).toString(); // 6 Decimals strict

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString('base64'),
            walletId: walletId, 
            contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // TokenMessengerV2
            
            // EXACT CCTP V2 SIGNATURE
            abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
            abiParameters: [
                rawAmount, 
                "3", // Arbitrum Sepolia Domain
                destBytes32, 
                "0x3600000000000000000000000000000000000000", // Arc Native USDC
                "0x0000000000000000000000000000000000000000000000000000000000000000", // Any Caller
                "0", // Max Fee
                "2000" // Min Finality Threshold
            ],
            feeLevel: "MEDIUM",
            blockchain: "ARC-TESTNET"
        };

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST', headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (!response.ok) throw new Error(`CIRCLE_ERROR: ${JSON.stringify(result)}`);
        return res.status(200).json({ success: true, operationId: result.data.id });
    } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
}
