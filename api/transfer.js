import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    
    const { walletId, destinationAddress, amount, assetSymbol = 'USDC' } = req.body;

    if (!walletId || !destinationAddress || !amount) {
        return res.status(400).json({ error: "Missing required parameters." });
    }
    
    if (!ENTITY_SECRET) {
        return res.status(500).json({ error: "Server Configuration Error: Missing Entity Secret." });
    }

    // --- THE ARCHITECT UPGRADE: MAP SYMBOLS TO YOUR CUSTOM CONTRACTS ---
    const USDC_ADDRESS = "0x3600000000000000000000000000000000000000".toLowerCase();
    const TARC_ADDRESS = "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78".toLowerCase();

    // Determine which contract address we are looking for based on the frontend request
    const expectedAddress = (assetSymbol === 'USDC' || assetSymbol === 'USDC') ? USDC_ADDRESS : TARC_ADDRESS;

    try {
        // --- STEP 1: AUTO-DISCOVER THE REAL TOKEN ID ---
        const balanceRes = await fetch(`https://api.circle.com/v1/w3s/wallets/${walletId}/balances`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const balanceData = await balanceRes.json();
        
        if (!balanceRes.ok) {
            throw new Error(`Failed to fetch balances to discover token ID. Circle API: ${balanceData.message || 'Unknown error'}`);
        }

        // Find the specific token in the wallet's balances by ADDRESS instead of symbol
        const targetToken = balanceData.data?.tokenBalances?.find(t => 
            t.token.tokenAddress && t.token.tokenAddress.toLowerCase() === expectedAddress
        );
        
        if (!targetToken) {
            return res.status(404).json({ error: `Transfer Failed`, details: { message: `Cannot find ${assetSymbol} in this wallet. The wallet must have a balance to discover the Token ID.` } });
        }
        
        const actualTokenId = targetToken.token.id;

        // --- STEP 2: FETCH PUBLIC KEY & ENCRYPT SECRETS ---
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const keyData = await keyRes.json();
        
        if (!keyRes.ok) throw new Error("Failed to fetch Circle Public Key");

        const entitySecretBuffer = Buffer.from(ENTITY_SECRET, 'hex');
        const encryptedData = crypto.publicEncrypt({
            key: keyData.data.publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, entitySecretBuffer);
        const entitySecretCiphertext = encryptedData.toString('base64');

        // --- STEP 3: EXECUTE DYNAMIC TRANSFER ---
        const idempotencyKey = crypto.randomUUID();
        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idempotencyKey: idempotencyKey,
                entitySecretCiphertext: entitySecretCiphertext,
                walletId: walletId,
                destinationAddress: destinationAddress,
                amounts: [amount.toString()],
                tokenId: actualTokenId,
                feeLevel: "MEDIUM"
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: "Circle Transfer Failed", details: result });
        }

        return res.status(200).json({ success: true, data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
