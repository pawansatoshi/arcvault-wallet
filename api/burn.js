import crypto from "crypto";
import { parseUnits, isAddress } from "ethers";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    try {
        let { walletId, destinationAddress, amount } = req.body;

        // ✅ basic validation
        if (!walletId || !destinationAddress || !amount) {
            return res.status(400).json({ error: "Missing params" });
        }

        // ✅ address validation (IMPORTANT)
        if (!isAddress(destinationAddress)) {
            return res.status(400).json({ error: "Invalid destination address" });
        }

        // ✅ sanitize amount (fix decimal bugs)
        amount = Number(amount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        // 🔥 prevent underflow / tiny values
        if (amount < 0.000001) {
            return res.status(400).json({ error: "Amount too small (min 0.000001 USDC)" });
        }

        // 🔐 get Circle public key
        const keyRes = await fetch(
            "https://api.circle.com/v1/w3s/config/entity/publicKey",
            {
                headers: {
                    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`
                }
            }
        );

        const keyData = await keyRes.json();

        if (!keyData?.data?.publicKey) {
            throw new Error("Failed to fetch Circle public key");
        }

        const encryptedData = crypto.publicEncrypt(
            {
                key: keyData.data.publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256"
            },
            Buffer.from(process.env.CIRCLE_ENTITY_SECRET, "hex")
        );

        // ✅ EXACT USDC conversion (6 decimals ONLY)
        const rawAmount = parseUnits(amount.toString(), 6).toString();

        // 🔥 CORRECT payload for ARC CCTP
        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString("base64"),
            walletId,

            contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",

            // ✅ correct ABI (ARC version)
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

        console.log("🚀 Sending payload:", payload);

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

        console.log("📦 Circle response:", result);

        if (!response.ok) {
            throw new Error(JSON.stringify(result));
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
