require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// Middleware for JSON (needed for Chat)
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// UPDATED: Using Gemini 2.5 Flash as requested.
// If this still gives a 404, try 'gemini-1.5-pro' or 'gemini-1.5-flash-001'
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 1. ANALYZE (Image OR Text)
app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        const hasImage = !!req.file;
        const locationName = req.body.location;

        if (!hasImage && !locationName) {
            return res.status(400).json({ error: 'Please upload an image or enter a location name.' });
        }

        let prompt = "";
        let inputParts = [];

        const jsonStructure = `
            Return a strictly valid JSON object (NO markdown, NO backticks) with these keys:
            - "landmarkName": String
            - "location": String (City, Country)
            - "description": String (An engaging 2-sentence intro)
            - "history": String (A 3-sentence historical fun fact)
            - "itinerary": Array of Strings (Exactly 3 items. Day 1, Day 2, Day 3 plans centered around this location)
            - "food": Array of Strings (Top 3 local dishes to try nearby)
        `;

        if (hasImage) {
            prompt = `Identify this landmark. Act as a travel guide. ${jsonStructure}`;
            inputParts = [
                prompt,
                {
                    inlineData: {
                        data: req.file.buffer.toString('base64'),
                        mimeType: req.file.mimetype,
                    },
                }
            ];
        } else {
            prompt = `I want to visit "${locationName}". Act as a travel guide. ${jsonStructure}`;
            inputParts = [prompt];
        }

        const result = await model.generateContent(inputParts);
        const response = await result.response;
        
        let text = response.text();
        // Cleanup formatting if Gemini adds markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(text);
        res.json(data);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'AI Error: ' + error.message });
    }
});

// 2. CHAT (Follow-up questions)
app.post('/chat', async (req, res) => {
    try {
        const { context, question } = req.body;

        const prompt = `
            Context: The user is asking about "${context.name}" located in "${context.location}".
            Historical info provided previously: "${context.history}".
            
            User Question: "${question}"
            
            Answer the user's question helpfully and briefly (max 2 sentences).
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ answer: text });

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: 'Chat Error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
