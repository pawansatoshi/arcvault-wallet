import crypto from "crypto";
import { parseUnits } from "ethers";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { walletId, destinationAddress, amount } = req.body;

        if (!walletId || !destinationAddress || !amount) {
            return res.status(400).json({ error: "Missing params" });
        }

        const keyRes = await fetch("https://api.circle.com/v1/w3s/config/entity/publicKey", {
            headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` }
        });
        const keyData = await keyRes.json();

        const encryptedData = crypto.publicEncrypt(
            {
                key: keyData.data.publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256"
            },
            Buffer.from(process.env.CIRCLE_ENTITY_SECRET, "hex")
        );

        const rawAmount = parseUnits(amount.toString(), 6).toString();
        // Gateway might take a standard EVM address (not padded to 32 bytes like raw CCTP)
        const destAddressEVMFriendly = destinationAddress; 

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString("base64"),
            walletId,
            
            // 🔥 The Arc GatewayWallet Contract Address
            contractAddress: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9", 
            
            // ⚠️ Placeholder ABI: Ensure this matches Arc Gateway Docs
            abiFunctionSignature: "deposit(uint256,address,uint32)", 
            abiParameters: [
                rawAmount,
                destAddressEVMFriendly,
                3 // Arbitrum Sepolia Domain ID
            ],
            feeLevel: "MEDIUM",
            blockchain: "ARC-TESTNET"
        };

        const response = await fetch("https://api.circle.com/v1/w3s/developer/transactions/contractExecution", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result?.message || "Gateway Send failed");
        }

        return res.status(200).json({
            success: true,
            operationId: result.data.id
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
