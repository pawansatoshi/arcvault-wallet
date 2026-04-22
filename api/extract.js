export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { operationId } = req.body;

    if (!operationId) {
      return res.json({ success: false, error: "Missing operationId" });
    }

    console.log("Checking operation:", operationId);

    const response = await fetch(
      `https://api.circle.com/v1/w3s/operations/${operationId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    console.log("Circle response:", JSON.stringify(data));

    // ✅ CORRECT PATH (VERY IMPORTANT)
    const txHash =
      data?.data?.transactionHash ||
      data?.data?.transactions?.[0]?.transactionHash;

    if (!txHash) {
      return res.json({
        success: false,
        status: data?.data?.status || "pending",
        error: "txHash not ready yet",
      });
    }

    return res.json({
      success: true,
      txHash,
    });

  } catch (err) {
    console.error("Extract error:", err);

    return res.json({
      success: false,
      error: "extract failed",
    });
  }
}
