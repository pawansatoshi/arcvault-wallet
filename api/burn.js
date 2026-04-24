import crypto from "crypto";
import { parseUnits } from "ethers";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { walletId, amount } = req.body;

        if (!walletId || !amount) {
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
        const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString("base64"),
            walletId,
            
            // Arc GatewayWallet Contract Address
            contractAddress: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9", 
            
            // 🔥 THE FIX: Official Arc Gateway Deposit Signature
            abiFunctionSignature: "deposit(address,uint256)", 
            abiParameters: [
                ARC_USDC_ADDRESS, // 1. The Token to deposit
                rawAmount         // 2. The amount in subunits
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
            throw new Error(result?.message || "Gateway Deposit failed");
        }

        return res.status(200).json({
            success: true,
            operationId: result.data.id
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
