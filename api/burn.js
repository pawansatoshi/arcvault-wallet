import crypto from "crypto";
import { parseUnits } from "ethers";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    try {
        const { walletId, destinationAddress, amount } = req.body;

        // ✅ Basic validation
        if (!walletId || !destinationAddress || !amount) {
            return res.status(400).json({ error: "Missing params" });
        }

        const numericAmount = parseFloat(amount);

        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        // 🚫 Prevent tiny / unstable transfers
        if (numericAmount < 0.1) {
            return res.status(400).json({
                error: "Minimum 0.1 USDC required"
            });
        }

        // 🔐 Get Circle public key
        const keyRes = await fetch(
            "https://api.circle.com/v1/w3s/config/entity/publicKey",
            {
                headers: {
                    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`
                }
            }
        );

        const keyData = await keyRes.json();

        const encryptedData = crypto.publicEncrypt(
            {
                key: keyData.data.publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256"
            },
            Buffer.from(process.env.CIRCLE_ENTITY_SECRET, "hex")
        );

        // ✅ Correct amount (ONLY here conversion happens)
        const rawAmount = parseUnits(amount.toString(), 6).toString();

        console.log("🔥 AMOUNT INPUT:", amount);
        console.log("🔥 RAW AMOUNT:", rawAmount);

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString("base64"),
            walletId,

            // ✅ TokenMessenger (Arc Testnet)
            contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",

            // ✅ FIXED ABI (NO bytes32)
            abiFunctionSignature:
                "depositForBurn(uint256,uint32,address,address)",

            abiParameters: [
                rawAmount,
                3, // Arbitrum Sepolia domain
                destinationAddress,
                "0x3600000000000000000000000000000000000000"
            ],

            feeLevel: "MEDIUM",
            blockchain: "ARC-TESTNET"
        };

        console.log("🔥 ABI USED:", payload.abiFunctionSignature);

        const response = await fetch(
            "https://api.circle.com/v1/w3s/developer/transactions/contractExecution",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json();

        console.log("🔥 BURN RESPONSE:", result);

        if (!response.ok) {
            throw new Error(result?.message || "Burn failed");
        }

        return res.status(200).json({
            success: true,
            operationId: result.data.id
        });

    } catch (e) {
        console.error("❌ BURN ERROR:", e);
        return res.status(500).json({ error: e.message });
    }
}
