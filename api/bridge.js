import { AppKit } from "@circle-fin/app-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sourceAddress, destinationAddress, amount } = req.body;

        if (!sourceAddress) throw new Error("VALIDATION_ERROR: Missing source wallet address.");
        if (!destinationAddress) throw new Error("VALIDATION_ERROR: Missing destination address.");
        if (!amount) throw new Error("VALIDATION_ERROR: Missing amount.");

        if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
            throw new Error("VERCEL_ENV_ERROR: Missing Circle API keys.");
        }

        const kit = new AppKit();

        const adapter = createCircleWalletsAdapter({
            apiKey: process.env.CIRCLE_API_KEY,
            entitySecret: process.env.CIRCLE_ENTITY_SECRET,
        });

        const result = await kit.bridge({
            from: {
                adapter,
                chain: "ARC_TESTNET",
                address: sourceAddress
            },
            to: {
                recipientAddress: destinationAddress,
                chain: "ARB_SEPOLIA",
                useForwarder: true
            },
            amount: amount.toString()
        });

        console.log("Bridge Result:", JSON.stringify(result, null, 2));

        if (result.state === "error") {
            throw new Error(`CIRCLE_SDK_ERROR: ${JSON.stringify(result)}`);
        }

        return res.status(200).json({
            success: true,
            message: "Forwarded to Circle successfully",
            data: result
        });

    } catch (err) {
        console.error("Bridge Backend Error:", err);

        return res.status(500).json({
            success: false,
            errorType: "BACKEND_EXECUTION_FAILURE",
            errorMessage: err.message,
            stack: err.stack
        });
    }
    }
