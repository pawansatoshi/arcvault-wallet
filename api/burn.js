import crypto from "crypto";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    try {
        const { walletId, destinationAddress, amount } = req.body;

        if (!walletId || !destinationAddress || !amount) {
            return res.status(400).json({ error: "Missing params" });
        }

        // 🔐 get public key
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

        // 💰 correct amount
        const rawAmount = (parseFloat(amount) * 1e6).toFixed(0);

        // 🔥 FIX: address → bytes32
        const destBytes32 =
            "0x" +
            destinationAddress.toLowerCase().replace("0x", "").padStart(64, "0");

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString("base64"),
            walletId,

            contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",

            // ✅ CORRECT ABI
            abiFunctionSignature:
                "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",

            abiParameters: [
                rawAmount, // amount
                3, // Arbitrum
                destBytes32, // receiver
                "0x3600000000000000000000000000000000000000", // USDC
                "0x0000000000000000000000000000000000000000000000000000000000000000", // hookData
                0, // maxFee
                2000 // minFinality
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

        if (!response.ok) {
            console.error(result);
            throw new Error(result?.message || "Circle error");
        }

        return res.status(200).json({
            success: true,
            operationId: result.data.id
        });

    } catch (e) {
        console.error("BURN ERROR:", e);
        return res.status(500).json({ error: e.message });
    }
}
