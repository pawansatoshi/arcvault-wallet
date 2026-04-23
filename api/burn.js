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
        // Pads destination address to 32 bytes as required by CCTP
        const destBytes32 = "0x" + destinationAddress.replace("0x", "").padStart(64, "0");

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString("base64"),
            walletId,
            
            // CORRECT Arc TokenMessengerV2 Address
            contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", 
            
            // 🔥 THE FIX: Standard 4-Parameter Native CCTP Signature
            abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
            abiParameters: [
                rawAmount,
                3, // Destination Domain (Arbitrum Sepolia)
                destBytes32,
                "0x3600000000000000000000000000000000000000" // Native USDC
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
            throw new Error(result?.message || "Burn failed");
        }

        return res.status(200).json({
            success: true,
            operationId: result.data.id
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
