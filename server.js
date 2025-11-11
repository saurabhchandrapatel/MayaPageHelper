// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/gemini", async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`
      },
      body: JSON.stringify({ prompt, temperature: 0.7, maxOutputTokens: 500 })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("Proxy running on http://localhost:3000"));
