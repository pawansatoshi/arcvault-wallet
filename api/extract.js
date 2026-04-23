export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { operationId } = req.body;
        if (!operationId) return res.status(400).json({ success: false, error: "Missing ID" });

        console.log("🔍 Fetching Transaction ID:", operationId);

        // ✅ DIRECTLY call the Transactions endpoint (No operations fallback needed)
        const txRes = await fetch(
            `https://api.circle.com/v1/w3s/transactions/${operationId}`,
            {
                method: "GET",
                headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` }
            }
        );

        if (!txRes.ok) {
            console.log("⚠️ Circle API Pending/Not Ready");
            return res.status(200).json({ success: false, pending: true });
        }

        const data = await txRes.json();
        console.log("📦 Circle Data:", JSON.stringify(data));

        // ✅ Extract Hash
        const txHash = data?.data?.txHash || data?.data?.transactionHash;

        if (!txHash) {
            return res.status(200).json({ success: false, pending: true });
        }

        console.log("✅ TX HASH FOUND:", txHash);
        return res.status(200).json({ success: true, txHash });

    } catch (e) {
        console.error("❌ EXTRACT ERROR:", e);
        return res.status(200).json({ success: false, pending: true, error: e.message });
    }
}
