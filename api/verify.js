import axios from "axios";

const secret = process.env.PAYMONGO_SECRETKEY || "sk_test_YOUR_REAL_KEY_HERE";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sourceId } = req.body;

  if (!secret || secret === "sk_test_YOUR_REAL_KEY_HERE") {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  try {
    const paymongo = axios.create({
      baseURL: "https://api.paymongo.com/v1",
      headers: {
        Authorization: `Basic ${Buffer.from(secret + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
    });

    const { data } = await paymongo.get(`/sources/${sourceId}`);
    const status = data.data.attributes.status;

    if (status === "chargeable") {
      await paymongo.post("/payments", {
        data: {
          attributes: {
            amount: data.data.attributes.amount,
            currency: "PHP",
            source: { id: sourceId, type: "source" },
          },
        },
      });
      return res.status(200).json({ status: "success" });
    }

    if (status === "failed" || status === "cancelled") {
      return res.status(200).json({ status: "failed" });
    }

    return res.status(200).json({ status: "pending" });

  } catch (err) {
    console.error("Verify error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Verification failed" });
  }
}