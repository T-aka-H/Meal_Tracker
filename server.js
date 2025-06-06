require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { CohereClient } = require('cohere-ai');

const app = express();
const port = process.env.PORT || 8080;

// CohereクライアントのAPIキーを設定
const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY,
});

// CORSの設定
app.use(cors({
    origin: '*',  // 開発中は全てのオリジンを許可
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

// JSONボディの解析
app.use(express.json());

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Cohereによる食事分析エンドポイント
app.post('/cohere-analyze', async (req, res) => {
    try {
        const { prompt, language } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'プロンプトが必要です' });
        }

        // Cohereの生成設定
        const generateConfig = {
            prompt: prompt,
            maxTokens: 500,
            temperature: 0.7,
            k: 0,
            stopSequences: [],
            returnLikelihoods: 'NONE'
        };

        // 言語に応じて追加設定
        if (language === 'ja') {
            generateConfig.model = 'command-nightly';  // 日本語対応モデル
        } else {
            generateConfig.model = 'command';  // 英語用標準モデル
        }

        // Cohereで生成
        const response = await cohere.generate(generateConfig);

        // 生成されたテキストを取得
        const generatedText = response.generations[0].text;

        // レスポンスを返す
        res.json({
            text: generatedText.trim(),
            language: language
        });

    } catch (error) {
        console.error('Cohere API エラー:', error);
        res.status(500).json({
            error: '食事分析の生成中にエラーが発生しました',
            details: error.message
        });
    }
});

// エラーハンドリング
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'サーバーエラーが発生しました',
        details: err.message
    });
});

// サーバーの起動
app.listen(port, () => {
    console.log(`プロキシサーバーが起動しました: http://localhost:${port}`);
}); 