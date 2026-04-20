import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const MASTER_WALLET_ID = process.env.CIRCLE_MASTER_WALLET_ID; 

    const { amount, destinationAddress, sourceChain, destChain } = req.body;

    if (!amount || !destinationAddress) {
        return res.status(400).json({ success: false, error: "Missing parameters." });
    }

    // 1. Official CCTP Contract Addresses
    // TODO: We need the exact TokenMessenger address for Arc Testnet
    const TOKEN_MESSENGER_ADDRESS = "INSERT_ARC_TOKEN_MESSENGER_ADDRESS"; 
    const USDC_ADDRESS = "0x...USDC..."; // Arc Native USDC

    // Domain ID for Arbitrum Sepolia in Circle CCTP is 3
    const DESTINATION_DOMAIN = 3; 

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { 
            headers: { 'Authorization': `Bearer ${API_KEY}` } 
        });
        const keyData = await keyRes.json();
        
        const encryptedData = crypto.publicEncrypt(
            { key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, 
            Buffer.from(ENTITY_SECRET, 'hex')
        );
        const entitySecretCiphertext = encryptedData.toString('base64');

        // Pad the destination address to 32 bytes (required by CCTP)
        const paddedDestination = "0x" + destinationAddress.replace("0x", "").padStart(64, "0");
        const rawAmount = (parseFloat(amount) * 1000000).toString(); // USDC has 6 decimals

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: entitySecretCiphertext,
            walletId: MASTER_WALLET_ID,
            contractAddress: TOKEN_MESSENGER_ADDRESS,
            abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
            abiParameters: [
                rawAmount,
                DESTINATION_DOMAIN.toString(),
                paddedDestination,
                USDC_ADDRESS
            ],
            feeLevel: "MEDIUM",
            blockchain: "ARC-TESTNET"
        };

        const response = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "CCTP Burn Initiation Failed");

        // We return the Operation ID. The frontend will use this to track the hash and poll the Iris API.
        return res.status(200).json({ success: true, operationId: result.data.id });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
