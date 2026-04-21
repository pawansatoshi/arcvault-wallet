import crypto from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const API_KEY = process.env.CIRCLE_API_KEY;
    const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;

    const { amount, walletId } = req.body;

    if (!amount || !walletId) {
      return res.status(400).json({ error: "Missing amount or walletId" });
    }

    const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
    const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

    const rawAmount = (parseFloat(amount) * 1e6).toString();

    // 🔐 Get entity public key
    const keyRes = await fetch(
      "https://api.circle.com/v1/w3s/config/entity/publicKey",
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      }
    );
    const keyData = await keyRes.json();

    // 🔐 Encrypt entity secret
    const encryptedData = crypto.publicEncrypt(
      {
        key: keyData.data.publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(ENTITY_SECRET, "hex")
    );

    const entitySecretCiphertext = encryptedData.toString("base64");

    const payload = {
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext,
      walletId,
      contractAddress: USDC_ADDRESS,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [TOKEN_MESSENGER, rawAmount],
      feeLevel: "MEDIUM",
      blockchain: "ARC-TESTNET",
    };

    const response = await fetch(
      "https://api.circle.com/v1/w3s/developer/transactions/contractExecution",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Approval Failed");
    }

    return res.status(200).json({
      success: true,
      operationId: result.data.id,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
