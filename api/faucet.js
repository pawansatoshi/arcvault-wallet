import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    // NOTE: You MUST add TREASURY_WALLET_ID to your Vercel Environment Variables!
    const TREASURY_WALLET = process.env.TREASURY_WALLET_ID; 
    
    const { destinationAddress } = req.body;
    if (!destinationAddress) return res.status(400).json({ error: "Missing destination address." });
    if (!TREASURY_WALLET) return res.status(500).json({ error: "Missing Treasury Wallet ID in env." });

    const TARC_ADDRESS = "0xe66a11cb4b147F208e6d81B7540bfc83E1680c78".toLowerCase();
    const CLAIM_AMOUNT = "100"; // 100 tARC per claim

    try {
        // 1. Find the tARC Token ID in the Treasury Wallet
        const balRes = await fetch(`https://api.circle.com/v1/w3s/wallets/${TREASURY_WALLET}/balances`, { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const balData = await balRes.json();
        const targetToken = balData.data?.tokenBalances?.find(t => t.token.tokenAddress && t.token.tokenAddress.toLowerCase() === TARC_ADDRESS);
        
        if (!targetToken) return res.status(404).json({ error: "Treasury Wallet is out of tARC." });
        const tokenId = targetToken.token.id;

        // 2. Encrypt Entity Secret
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const entitySecretBuffer = Buffer.from(ENTITY_SECRET, 'hex');
        const encryptedData = crypto.publicEncrypt({ key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, entitySecretBuffer);
        const entitySecretCiphertext = encryptedData.toString('base64');

        // 3. Execute Transfer from Treasury to User
        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: entitySecretCiphertext,
                walletId: TREASURY_WALLET,
                destinationAddress: destinationAddress,
                amounts: [CLAIM_AMOUNT],
                tokenId: tokenId,
                feeLevel: "MEDIUM"
            })
        });

        const result = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: "Faucet execution failed", details: result });
        return res.status(200).json({ success: true, data: result.data });

    } catch (err) {
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
}
