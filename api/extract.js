export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { operationId } = req.body;

        if (!operationId) {
            return res.status(400).json({
                success: false,
                error: "Missing operationId"
            });
        }

        console.log("🔍 Checking operation:", operationId);

        // 🔥 PRIMARY: operations endpoint (FAST + RELIABLE)
        let circleRes = await fetch(
            `https://api.circle.com/v1/w3s/operations/${operationId}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`
                }
            }
        );

        let data = await circleRes.json();

        // 🔁 FALLBACK (important)
        if (!circleRes.ok || !data?.data) {
            console.log("⚠️ fallback to transactions API");

            const txRes = await fetch(
                `https://api.circle.com/v1/w3s/transactions/${operationId}`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`
                    }
                }
            );

            if (txRes.ok) {
                data = await txRes.json();
            }
        }

        console.log("📦 Circle data:", JSON.stringify(data));

        // 🔥 EXTRACT txHash from ANY possible location
        const txHash =
            data?.data?.transactionHash ||
            data?.data?.txHash ||
            data?.data?.blockchainTransactionHash ||
            data?.data?.result?.txHash ||
            data?.data?.result?.transactionHash ||
            null;

        // ⏳ still pending
        if (!txHash) {
            return res.status(200).json({
                success: false,
                pending: true
            });
        }

        console.log("✅ TX FOUND:", txHash);

        return res.status(200).json({
            success: true,
            txHash
        });

    } catch (e) {
        console.error("❌ EXTRACT ERROR:", e);

        return res.status(200).json({
            success: false,
            pending: true,
            error: e.message
        });
    }
}
