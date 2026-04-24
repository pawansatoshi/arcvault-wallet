import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const TREASURY_WALLET = process.env.TREASURY_WALLET_ID; 
    
    const { destinationAddress } = req.body;
    if (!destinationAddress) return res.status(400).json({ error: "Missing destination address" });

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ENTITY_SECRET, 'hex'));
        const entitySecretCiphertext = encryptedData.toString('base64');

        // Dispense 100 tUSDC directly via tokenAddress
        const payloadUsdc = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: entitySecretCiphertext,
            walletId: TREASURY_WALLET,
            destinationAddress: destinationAddress,
            amounts: ["100"],
            tokenAddress: "0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA", 
            blockchain: "ARC-TESTNET",
            feeLevel: "MEDIUM"
        };

        const resUsdc = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadUsdc)
        });
        const resultUsdc = await resUsdc.json();

        // Dispense 100 tARC directly via tokenAddress
        const payloadArc = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: entitySecretCiphertext,
            walletId: TREASURY_WALLET,
            destinationAddress: destinationAddress,
            amounts: ["100"],
            tokenAddress: "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78", 
            blockchain: "ARC-TESTNET",
            feeLevel: "MEDIUM"
        };

        const resArc = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadArc)
        });
        const resultArc = await resArc.json();

        if (!resUsdc.ok || !resArc.ok) {
             return res.status(500).json({ error: "Faucet Dispense Error", details: { usdc: resultUsdc, arc: resultArc }});
        }

        return res.status(200).json({ 
            success: true, 
            txHashUsdc: resultUsdc.data.id,
            txHashArc: resultArc.data.id
        });
    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
