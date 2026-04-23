import crypto from "crypto";
import { parseUnits } from "ethers";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    try {
        const { walletId, destinationAddress, amount } = req.body;

        if (!walletId || !destinationAddress || !amount) {
            return res.status(400).json({ error: "Missing params" });
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

        // ✅ correct USDC amount (6 decimals)
        const rawAmount = parseUnits(amount.toString(), 6).toString();

        // ✅ destination → bytes32 (CCTP requires this)
        const destBytes32 =
            "0x" +
            destinationAddress.toLowerCase().replace("0x", "").padStart(64, "0");

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString("base64"),
            walletId,

            // 🔥 IMPORTANT: correct CCTP TokenMessenger contract (Arc testnet)
            contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",

            // 🔥 CORRECT ABI (7 params version)
            abiFunctionSignature:
                "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",

            abiParameters: [
                rawAmount,
                3, // Arbitrum domain
                destBytes32,
                "0x3600000000000000000000000000000000000000", // USDC
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                0,
                2000
            ],

            feeLevel: "MEDIUM",
            blockchain: "ARC-TESTNET"
        };

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
