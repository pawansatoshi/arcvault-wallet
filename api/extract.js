export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
    try {
        const { operationId } = req.body;

        if (!operationId) {
            return res.status(400).json({ error: "Missing operationId" });
        }

        // Step 1: Get operation
        const opRes = await fetch(
            `https://api.circle.com/v1/w3s/operations/${operationId}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`
                }
            }
        );

        const opData = await opRes.json();

        // If still processing → wait
        if (opData?.data?.state !== "COMPLETE") {
            return res.status(200).json({ pending: true });
        }

        // Step 2: Fetch transactions list (THIS IS THE REAL FIX)
        const txRes = await fetch(
            `https://api.circle.com/v1/w3s/transactions`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`
                }
            }
        );

        const txData = await txRes.json();

        const tx = txData?.data?.transactions?.find(
            (t) => t.operationId === operationId
        );

        if (!tx || !tx.transactionHash) {
            return res.status(200).json({ pending: true });
        }

        return res.status(200).json({
            success: true,
            txHash: tx.transactionHash
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
