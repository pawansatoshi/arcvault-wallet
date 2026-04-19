import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const { walletId, fromSymbol, amount } = req.body;

    const DEX_ADDRESS = "0x09980dfDA55Fa5C761887C82FA5014D9dFaA3A9A";
    const USDC_NATIVE = "0x3600000000000000000000000000000000000000".toLowerCase();
    const TARC_ADDRESS = "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78".toLowerCase();

    const tokenInAddress = fromSymbol === 'USDC' ? USDC_NATIVE : TARC_ADDRESS;
    const scaledAmount = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString();

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ENTITY_SECRET, 'hex'));

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: encryptedData.toString('base64'),
                walletId: walletId,
                contractAddress: DEX_ADDRESS, // We call swap() ON the DEX contract
                abiFunctionSignature: "swap(address,uint256)",
                abiParameters: [tokenInAddress, scaledAmount],
                feeLevel: "MEDIUM"
            })
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: "Swap Failed", details: result });
        return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
