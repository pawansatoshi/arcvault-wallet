import crypto from 'crypto';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
    const MASTER_WALLET_ID = process.env.CIRCLE_MASTER_WALLET_ID; 

    // Receive the exact parameters from your ArcVault OS frontend
    const { amount, destinationAddress } = req.body;

    if (!amount || !destinationAddress) {
        return res.status(400).json({ success: false, error: "Missing parameters." });
    }

    // Official Arc Testnet CCTP Addresses (Sourced from docs.arc.network)
    const TOKEN_MESSENGER_ADDRESS = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"; 
    const USDC_ADDRESS = "0x3600000000000000000000000000000000000000"; 

    // Domain ID for Arbitrum Sepolia in Circle CCTP
    const DESTINATION_DOMAIN = 3; 

    try {
        // 1. Setup Fresh Cryptographic Security
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', { 
            headers: { 'Authorization': `Bearer ${API_KEY}` } 
        });
        const keyData = await keyRes.json();
        
        const encryptedData = crypto.publicEncrypt(
            { key: keyData.data.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, 
            Buffer.from(ENTITY_SECRET, 'hex')
        );
        const entitySecretCiphertext = encryptedData.toString('base64');

        // 2. Format Parameters for CCTP Smart Contract
        // CCTP strictly requires the destination address to be padded to 32 bytes (64 hex characters)
        const paddedDestination = "0x" + destinationAddress.replace("0x", "").padStart(64, "0");
        
        // Arc USDC ERC-20 interface requires 6 decimals of precision
        const rawAmount = (parseFloat(amount) * 1000000).toString(); 

        // 3. Command the Treasury to execute 'depositForBurn'
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

        // Return the Circle Operation ID to the frontend
        return res.status(200).json({ success: true, operationId: result.data.id });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
