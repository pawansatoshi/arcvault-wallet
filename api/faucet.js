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
    
    // Web3 Raw Amounts: Assuming 18 decimals for custom tokens. 100 tokens = 100 * 10^18
    const RAW_AMOUNT = "100000000000000000000"; 

    try {
        // Fetch public key once (safe to reuse the public key)
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const keyData = await keyRes.json();
        const publicKey = keyData.data.publicKey;

        const executeContractTransfer = async (contractAddr) => {
            // GENERATE FRESH CIPHERTEXT FOR EVERY SINGLE TRANSFER
            const encryptedData = crypto.publicEncrypt(
                { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, 
                Buffer.from(ENTITY_SECRET, 'hex')
            );
            const freshCiphertext = encryptedData.toString('base64');

            const payload = {
                idempotencyKey: crypto.randomUUID(),
                entitySecretCiphertext: freshCiphertext,
                walletId: MASTER_WALLET_ID,
                contractAddress: contractAddr,
                abiFunctionSignature: "transfer(address,uint256)",
                abiParameters: [destinationAddress, RAW_AMOUNT],
                feeLevel: "MEDIUM", 
                blockchain: "ARC-TESTNET"
            };

            const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Contract Execution Failed");
            return result.data.id;
        };

        // Transfer 1: tUSDC (Fresh Encryption)
        const txIdUsdc = await executeContractTransfer(tUSDC_ADDRESS);
        
        // Wait 1.5 seconds to prevent rate-limiting from Circle's API
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        
        // Transfer 2: tARC (Fresh Encryption)
        const txIdArc = await executeContractTransfer(tARC_ADDRESS);

        return res.status(200).json({ success: true, txHashUsdc: txIdUsdc, txHashArc: txIdArc });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
