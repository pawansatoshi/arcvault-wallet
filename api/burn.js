import crypto from 'crypto';

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    const { walletId, destinationAddress, amount } = req.body;

    try {
        const keyRes = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
            headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` }
        });

        const keyData = await keyRes.json();

        const encryptedData = crypto.publicEncrypt(
            {
                key: keyData.data.publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(process.env.CIRCLE_ENTITY_SECRET, 'hex')
        );

        const rawAmount = Math.floor(parseFloat(amount) * 1e6).toString();

        const payload = {
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: encryptedData.toString('base64'),
            walletId,
            contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
            abiFunctionSignature:
                "depositForBurn(uint256,uint32,address,address)",
            abiParameters: [
                rawAmount,
                3,
                destinationAddress,
                "0x3600000000000000000000000000000000000000"
            ],
            feeLevel: "MEDIUM",
            blockchain: "ARC-TESTNET"
        };

        const response = await fetch(
            'https://api.circle.com/v1/w3s/developer/transactions/contractExecution',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json();

        if (!response.ok) throw new Error(JSON.stringify(result));

        return res.status(200).json({
            success: true,
            operationId: result.data.id,
            txHash: result.data.transactionHash
        });

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
}
