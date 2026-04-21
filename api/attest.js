export default async function handler(req, res) {
    // Standard CORS headers for mobile access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { messageHash } = req.body;
    if (!messageHash) return res.status(400).json({ error: "Missing messageHash payload." });

    try {
        // Vercel server securely pings Circle without browser throttling
        const irisRes = await fetch(`https://iris-api-sandbox.circle.com/attestations/${messageHash}`);
        const irisData = await irisRes.json();
        
        if(irisData && irisData.attestation && irisData.status === "complete") {
            return res.status(200).json({ success: true, attestation: irisData.attestation });
        } else {
            // Return a 202 Accepted, indicating we need to keep polling
            return res.status(202).json({ success: false, status: "pending" }); 
        }
    } catch(e) {
        return res.status(500).json({ error: e.message });
    }
}
