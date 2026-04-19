import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    
    const { walletId, destinationAddress, amount, assetSymbol } = req.body;
    if (!walletId || !destinationAddress || !amount || !assetSymbol) {
        return res.status(400).json({ error: "Missing required transfer parameters." });
    }

    try {
        // Encrypt the Entity Secret
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ENTITY_SECRET, 'hex'));
        const entitySecretCiphertext = encryptedData.toString('base64');

        // Base payload using Direct Routing
        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: entitySecretCiphertext,
            walletId: walletId,
            destinationAddress: destinationAddress,
            amounts: [amount.toString()],
            feeLevel: "MEDIUM",
            blockchain: "ARC-TESTNET"
        };

        // Tri-Token Routing Logic
        if (assetSymbol === 'tARC') {
            payload.tokenAddress = "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78";
        } else if (assetSymbol === 'tUSDC') {
            payload.tokenAddress = "0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA";
        } else if (assetSymbol === 'USDC') {
            // For Native USDC (Gas), Circle API typically uses the 0x36 placeholder or standard Native Token ID.
            // If Circle throws an error requesting a Token ID for the native gas coin, replace this block 
            // with `payload.tokenId = process.env.NATIVE_USDC_TOKEN_ID;`
            payload.tokenAddress = "0x3600000000000000000000000000000000000000"; 
        }

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: result.message || "Transfer Failed", details: result });
        
        return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
