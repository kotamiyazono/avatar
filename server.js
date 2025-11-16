import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// .envファイルから環境変数を読み込み
dotenv.config();

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// エフェメラルキー生成エンドポイント
app.post('/token', async (req, res) => {
    try {
        const { voice, instructions } = req.body;

        const sessionConfig = {
            session: {
                type: 'realtime',
                model: 'gpt-realtime',
                audio: {
                    output: { voice: voice || 'alloy' }
                },
                instructions: instructions || 'You are a helpful assistant.'
            }
        };

        const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionConfig)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('OpenAI API error:', error);
            throw new Error(`Failed to generate token: ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate token' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
