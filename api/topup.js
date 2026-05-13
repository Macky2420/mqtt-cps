import axios from "axios";

// TEMP FALLBACK: Replace "sk_test_xxx" with your REAL key so it works NOW.
// After confirming it works, delete the fallback and use .env.local only.
const secret = process.env.PAYMONGO_SECRETKEY || "sk_test_YOUR_REAL_KEY_HERE";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, method, cardName, email, cardId } = req.body;

  if (!amount || amount < 10) {
    return res.status(400).json({ error: "Minimum amount is ₱10" });
  }

  if (!secret || secret === "sk_test_YOUR_REAL_KEY_HERE") {
    console.error("PAYMONGO_SECRETKEY is missing");
    return res.status(500).json({ error: "Server misconfigured: missing secret key" });
  }

  try {
    const paymongo = axios.create({
      baseURL: "https://api.paymongo.com/v1",
      headers: {
        Authorization: `Basic ${Buffer.from(secret + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
    });

    const { data } = await paymongo.post("/sources", {
      data: {
        attributes: {
          amount: amount * 100,
          currency: "PHP",
          type: method,
          redirect: {
            success: `http://localhost:3000/cards?src={SOURCE_ID}`,
            failed: `http://localhost:3000/cards?topup=failed`,
          },
          billing: {
            name: cardName || "Customer",
            email: email || "",
          },
        },
      },
    });

    const source = data.data;
    return res.status(200).json({
      checkoutUrl: source.attributes.redirect.checkout_url,
      sourceId: source.id,
    });

  } catch (err) {
    console.error("PayMongo error:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Payment gateway error",
      details: err.response?.data?.errors?.[0]?.detail || err.message,
    });
  }
}