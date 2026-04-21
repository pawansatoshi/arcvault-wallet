import { AppKit } from "@circle-fin/app-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";

export default async function handler(req, res) {
    // Standard CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // sourceAddress is the user's Arc wallet. destinationAddress is where it goes on Arb Sepolia.
    const { sourceAddress, destinationAddress, amount } = req.body;

    if (!sourceAddress || !destinationAddress || !amount) {
        return res.status(400).json({ error: "Missing required bridge parameters." });
    }

    try {
        // 1. Initialize the official Arc App Kit
        const kit = new AppKit();
        
        // 2. Setup the Circle Wallets Adapter securely on the backend
        const circleWalletsAdapter = createCircleWalletsAdapter({
            apiKey: process.env.CIRCLE_API_KEY,
            entitySecret: process.env.CIRCLE_ENTITY_SECRET,
        });

        console.log(`Initiating App Kit Bridge: ${amount} USDC from Arc to Arb Sepolia...`);

        // 3. The 100% Foolproof Bridge Call
        const result = await kit.bridge({
            from: { 
                adapter: circleWalletsAdapter, 
                chain: "Arc_Testnet", 
                address: sourceAddress // The wallet performing the burn
            },
            to: { 
                recipientAddress: destinationAddress, 
                chain: "Arbitrum_Sepolia", 
                useForwarder: true // THE MAGIC BULLET: Circle handles attestation & mint
            },
            amount: amount.toString()
        });

        /* Because useForwarder is true, this endpoint will return as soon as the burn 
           is successfully forwarded to Circle's infrastructure. 
           Your mobile browser does not need to stay awake to poll Iris or trigger the mint. 
        */

        if (result.state === "error") {
            throw new Error(`App Kit Bridge Error: ${JSON.stringify(result.steps)}`);
        }

        return res.status(200).json({ 
            success: true, 
            message: "Bridge successfully forwarded to Circle.",
            bridgeResult: result 
        });

    } catch (err) {
        console.error("Bridge Execution Failed:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
