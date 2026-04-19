import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const { walletId, fromSymbol, amount } = req.body;

    const DEX_ADDRESS = "0x09980dfDA55Fa5C761887C82FA5014D9dFaA3A9A";
    const TUSDC_ADDRESS = "0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA".toLowerCase();
    const TARC_ADDRESS = "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78".toLowerCase();

    // STRICT LOCKOUT
    if (fromSymbol === 'USDC') {
         return res.status(400).json({ error: "Execution Halted", details: "Native USDC does not require approval routing." });
    }

    const tokenAddress = fromSymbol === 'tUSDC' ? TUSDC_ADDRESS : TARC_ADDRESS;
    const scaledAmount = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString();

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ENTITY_SECRET, 'hex'));

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString('base64'),
            walletId: walletId,
            contractAddress: tokenAddress,
            abiFunctionSignature: "approve(address,uint256)",
            abiParameters: [DEX_ADDRESS, scaledAmount],
            feeLevel: "MEDIUM"
        };

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: result.message || "Approval Failed", details: result });
        return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
