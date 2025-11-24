require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

// Make sure to use the model version that worked for you
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(express.static('public'));

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype,
            },
        };

        // NEW: Enhanced Prompt for a full Trip Guide
        const prompt = `
            Identify this landmark. 
            Act as a travel guide. Return a strictly valid JSON object (NO markdown, NO backticks) with these keys:
            - "landmarkName": String
            - "location": String (City, Country)
            - "description": String (An engaging 2-sentence intro)
            - "history": String (A 3-sentence historical fun fact)
            - "itinerary": Array of Strings (Exactly 3 items. Day 1, Day 2, Day 3 plans centered around this location)
            - "food": Array of Strings (Top 3 local dishes to try nearby)
        `;

        const result = await model.generateContent([prompt, imagePart]);
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});