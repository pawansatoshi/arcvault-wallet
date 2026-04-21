export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { messageHash } = req.body;

    try {
        // Single stateless ping
        const irisRes = await fetch(`https://iris-api-sandbox.circle.com/v1/attestations/${messageHash}`);
        const irisData = await irisRes.json();
        
        if (irisData.status === "complete") {
            return res.status(200).json({ status: "complete", attestation: irisData.attestation });
        } else {
            return res.status(202).json({ status: "pending" }); // Tell frontend to ping again later
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
