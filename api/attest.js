export default async function handler(req, res) {
    const { messageHash } = req.body;

    try {
        // CCTP Testnet Iris API
        const irisRes = await fetch(`https://iris-api-sandbox.circle.com/v1/attestations/${messageHash}`);
        const irisData = await irisRes.json();
        
        if (irisData.status === "complete") {
            return res.status(200).json({ success: true, attestation: irisData.attestation });
        } else {
            return res.status(202).json({ success: false, status: "pending" }); 
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
