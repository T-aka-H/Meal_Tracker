const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

// 環境変数の読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cohere APIキー
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_API_URL = 'https://api.cohere.ai/v1/generate';

// ミドルウェアの設定
app.use(cors({
    origin: ['https://millieon76.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'サーバーは正常に動作しています' });
});

// AI診断エンドポイント（Cohereを使用）
app.post('/api/ai-diagnosis', async (req, res) => {
    try {
        const { records } = req.body;
        
        // リクエストデータの検証
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                error: '有効な記録データが必要です'
            });
        }

        console.log(`診断リクエスト受信: ${records.length}件の記録`);

        // 食事記録をテキスト形式に変換
        const mealSummary = formatMealRecords(records);
        
        // Cohereへのプロンプトを作成
        const prompt = createDiagnosisPrompt(mealSummary);
        
        // Cohere APIを呼び出し
        const cohereResponse = await callCohereAPI(prompt);
        
        // 診断結果をパース
        const diagnosis = parseCohereResponse(cohereResponse);
        
        // 診断結果を返す
        res.json({
            diagnosis: diagnosis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('AI診断エラー:', error);
        res.status(500).json({
            error: 'AI診断の処理中にエラーが発生しました',
            message: error.message
        });
    }
});

// 食事記録をテキスト形式に変換
function formatMealRecords(records) {
    const sortedRecords = records.sort((a, b) => 
        new Date(a.datetime) - new Date(b.datetime)
    );
    
    let summary = "過去の食事記録:\n\n";
    
    sortedRecords.forEach(record => {
        const date = new Date(record.datetime);
        const dateStr = date.toLocaleDateString('ja-JP');
        const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        
        summary += `${dateStr} ${timeStr} - ${record.meal_type}: ${record.food_name}`;
        if (record.quantity) {
            summary += ` (${record.quantity})`;
        }
        if (record.memo) {
            summary += ` メモ: ${record.memo}`;
        }
        summary += '\n';
    });
    
    return summary;
}

// Cohereへのプロンプトを作成
function createDiagnosisPrompt(mealSummary) {
    return `あなたは優秀な栄養士です。以下の食事記録を分析し、栄養バランスや食事パターンについて診断してください。

${mealSummary}

以下の観点から分析してください：
1. 栄養バランス（タンパク質、炭水化物、脂質、ビタミン、ミネラル）
2. 食事の規則性（朝食、昼食、夕食のバランス）
3. 間食の頻度と内容
4. 改善すべき点
5. 良い点

分析結果は以下の形式で出力してください：

【総合スコア】(100点満点で評価)
【総評】(一文で総合評価)
【栄養バランス】(簡潔に)
【食事パターン】(簡潔に)
【良い点】
- (箇条書き)
【改善点とアドバイス】
- (具体的なアドバイスを箇条書き)`;
}

// Cohere APIを呼び出し
async function callCohereAPI(prompt) {
    try {
        const response = await axios.post(COHERE_API_URL, {
            model: 'command',
            prompt: prompt,
            max_tokens: 1000,
            temperature: 0.7,
            k: 0,
            stop_sequences: [],
            return_likelihoods: 'NONE'
        }, {
            headers: {
                'Authorization': `Bearer ${COHERE_API_KEY}`,
                'Content-Type': 'application/json',
                'Cohere-Version': '2022-12-06'
            }
        });
        
        return response.data.generations[0].text;
    } catch (error) {
        console.error('Cohere API エラー:', error.response?.data || error.message);
        throw new Error('AI診断サービスへの接続に失敗しました');
    }
}

// Cohereの応答をパース
function parseCohereResponse(responseText) {
    // スコアを抽出
    const scoreMatch = responseText.match(/【総合スコア】\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;
    
    // 総評を抽出
    const summaryMatch = responseText.match(/【総評】\s*(.+)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : '診断結果を生成しました。';
    
    // 改善点を抽出
    const recommendationsMatch = responseText.match(/【改善点とアドバイス】\s*([\s\S]+?)(?=【|$)/);
    const recommendationsText = recommendationsMatch ? recommendationsMatch[1] : '';
    
    // 箇条書きを配列に変換
    const recommendations = recommendationsText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);
    
    // 良い点を抽出
    const goodPointsMatch = responseText.match(/【良い点】\s*([\s\S]+?)(?=【|$)/);
    const goodPointsText = goodPointsMatch ? goodPointsMatch[1] : '';
    
    const goodPoints = goodPointsText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);
    
    return {
        score: score,
        summary: summary,
        recommendations: recommendations.length > 0 ? recommendations : ['今後も良い食習慣を継続してください。'],
        goodPoints: goodPoints,
        fullAnalysis: responseText
    };
}

// サーバーの起動
app.listen(PORT, () => {
    console.log(`サーバーがポート${PORT}で起動しました`);
    console.log(`Cohere APIキー設定: ${COHERE_API_KEY ? '✓' : '✗'}`);