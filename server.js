import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// .envファイルから環境変数を読み込み
dotenv.config();

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// パスワード認証エンドポイント
app.post('/auth', async (req, res) => {
    try {
        const { passwordHash } = req.body;

        if (!passwordHash) {
            return res.status(400).json({ error: 'Password hash is required' });
        }

        const correctHash = process.env.PASSWORD_HASH;
        if (!correctHash) {
            console.error('❌ PASSWORD_HASH not configured in .env');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Password authentication not configured'
            });
        }

        if (passwordHash === correctHash) {
            console.log('✅ Authentication successful');
            res.json({ success: true, message: 'Authentication successful' });
        } else {
            console.log('❌ Authentication failed: Invalid password');
            res.status(401).json({ success: false, message: 'Invalid password' });
        }
    } catch (error) {
        console.error('❌ Authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
});

// Web検索エンドポイント（Tavily APIを使用）
app.post('/search', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log('🔍 Searching with Tavily:', query);

        const tavilyApiKey = process.env.TAVILY_API_KEY;
        if (!tavilyApiKey || tavilyApiKey === 'your_tavily_api_key_here') {
            console.error('❌ Tavily API key not configured');
            return res.status(500).json({
                error: 'Tavily API key not configured',
                message: 'Please set TAVILY_API_KEY in your .env file. Get your free API key at https://tavily.com'
            });
        }

        // Tavily Search APIを呼び出し
        const tavilyResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: tavilyApiKey,
                query: query,
                search_depth: 'basic', // 'basic' or 'advanced' (advanced costs 2 credits)
                include_answer: true,
                include_images: false,
                include_raw_content: false,
                max_results: 5
            })
        });

        if (!tavilyResponse.ok) {
            const errorText = await tavilyResponse.text();
            console.error('❌ Tavily API error:', errorText);
            throw new Error(`Tavily API error: ${tavilyResponse.status}`);
        }

        const tavilyData = await tavilyResponse.json();
        const results = [];

        // Tavilyの回答（AIが生成した要約）
        if (tavilyData.answer) {
            results.push({
                title: 'Answer',
                snippet: tavilyData.answer
            });
        }

        // 検索結果
        if (tavilyData.results && tavilyData.results.length > 0) {
            for (const result of tavilyData.results) {
                results.push({
                    title: result.title || 'Result',
                    snippet: result.content || result.snippet || '',
                    url: result.url || ''
                });
            }
        }

        if (results.length === 0) {
            console.log('⚠️ No results found from Tavily');
            return res.json({
                query,
                results: [{
                    title: 'No Results',
                    snippet: 'No information found for this query. Please try rephrasing.'
                }]
            });
        }

        console.log('✅ Found', results.length, 'results from Tavily');
        res.json({ query, results });

    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
});

// エフェメラルキー生成エンドポイント
app.post('/token', async (req, res) => {
    try {
        const { voice, instructions, model } = req.body;

        const sessionConfig = {
            session: {
                type: 'realtime',
                model: model || 'gpt-realtime',
                audio: {
                    output: { voice: voice || 'alloy' }
                },
                instructions: instructions || 'You are a helpful assistant.',
                tools: [
                    {
                        type: 'function',
                        name: 'web_search',
                        description: 'Search the web for current information. Use this when you need up-to-date information, current events, weather, news, or facts that are not in your training data.',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'The search query to look up on the web'
                                }
                            },
                            required: ['query']
                        }
                    }
                ]
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
