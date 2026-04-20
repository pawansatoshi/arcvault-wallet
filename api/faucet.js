import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const MASTER_WALLET_ID = process.env.CIRCLE_MASTER_WALLET_ID; 
    
    const { destinationAddress } = req.body;
    if (!destinationAddress) return res.status(400).json({ success: false, error: "Destination required." });

    const tUSDC_ADDRESS = "0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA";
    const tARC_ADDRESS = "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78";
    const DISPENSE_AMOUNT = "100"; 

    try {
        // 1. Fetch Token UUIDs (Fixes "API_PARAMETER_INVALID")
        const getTokenId = async (address) => {
            const tokenRes = await fetch(`https://api.circle.com/v1/w3s/tokens?address=${address}`, {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });
            const tokenData = await tokenRes.json();
            if (tokenData.data && tokenData.data.tokens && tokenData.data.tokens.length > 0) {
                return tokenData.data.tokens[0].id;
            }
            throw new Error(`Token ${address} not indexed by Circle.`);
        };

        const tUSDC_UUID = await getTokenId(tUSDC_ADDRESS);
        const tARC_UUID = await getTokenId(tARC_ADDRESS);

        // 2. Setup Security Keys
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ENTITY_SECRET, 'hex'));
        const entitySecretCiphertext = encryptedData.toString('base64');

        // 3. Execute Transfer using UUID
        const executeTransfer = async (tokenUuid) => {
            const payload = {
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: entitySecretCiphertext,
                walletId: MASTER_WALLET_ID,
                destinationAddress: destinationAddress,
                amounts: [DISPENSE_AMOUNT],
                feeLevel: "MEDIUM", 
                tokenId: tokenUuid
            };
            const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Transfer Failed");
            return result.data.id;
        };

        const txIdUsdc = await executeTransfer(tUSDC_UUID);
        await new Promise(resolve => setTimeout(resolve, 1200)); // Delay prevents rate-limit crash
        const txIdArc = await executeTransfer(tARC_UUID);

        return res.status(200).json({ success: true, txHashUsdc: txIdUsdc, txHashArc: txIdArc });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
