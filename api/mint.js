import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    
    const { walletId, messageBytes, attestation } = req.body;

    const MESSAGE_TRANSMITTER = "0x11DCa9b5f3aA7A667Cb0E5a9dDF930E1DE0fA4A5"; 

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ENTITY_SECRET, 'hex'));

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString('base64'),
            walletId: walletId, 
            contractAddress: MESSAGE_TRANSMITTER,
            abiFunctionSignature: "receiveMessage(bytes,bytes)",
            abiParameters: [messageBytes, attestation],
            feeLevel: "MEDIUM",
            blockchain: "ARB-SEPOLIA" 
        };

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Mint Execution Failed");

        return res.status(200).json({ success: true, operationId: result.data.id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
