require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Clarity AI backend running");
});

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', // Allow all if not specified (for testing)
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/clarify', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text input is required' });
    }

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are Clarity AI.

Your task: State the core issue, intent, or confusion in the user's message as ONE clear sentence.

Strict rules:
- Focus on the user's situation, not the topic.
- Do NOT explain concepts or give background information.
- Do NOT teach, advise, or educate.
- Do NOT generalize.
- Do NOT use academic or instructional language.
- Do NOT refer to yourself.
- Do NOT describe the user abstractly.

Writing style:
- Plain, natural English.
- Human and direct.
- Professional and calm.
- Exactly ONE sentence.
- No emojis.
- No bullet points.

Goal: Reveal what is unclear or causing difficulty for the user, as simply as possible.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            model: "llama-3.1-8b-instant",
        });

        const clarification = completion.choices[0]?.message?.content || "";
        res.json({ clarification: clarification.trim() });

    } catch (error) {
        console.error('Error with Groq API:', error);
        res.status(500).json({ error: 'Failed to clarify text', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
