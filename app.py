from flask import Flask, request, Response, jsonify, send_from_directory
import requests
import os
from dotenv import load_dotenv
import logging
from flask_cors import CORS
from datetime import datetime
import json

# ログ設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 環境変数の読み込み
load_dotenv()

def create_app():
    app = Flask(__name__)
    # CORSの設定を更新
    CORS(app, resources={
        r"/*": {
            "origins": [
                "https://meal-tracker-1-y2dy.onrender.com",  # フロントエンド
                "http://localhost:5000",
                "http://127.0.0.1:5000"
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    # 環境変数から設定を取得
    app.config['COHERE_API_KEY'] = os.environ.get('COHERE_API_KEY')
    app.config['GEMINI_API_KEY'] = os.environ.get('GEMINI_API_KEY')  # 新規追加
    app.config['SUPABASE_ANON_KEY'] = os.environ.get('SUPABASE_ANON_KEY')
    app.config['SUPABASE_URL'] = os.environ.get('SUPABASE_URL', 'https://nhnanyzkcxlysugllpde.supabase.co')

    # デフォルトプロンプトテンプレート
    app.config['DEFAULT_PROMPT_TEMPLATE_JA'] = """以下は過去1週間の食事記録です。この記録を基に、栄養バランス、食事パターン、健康面でのアドバイスを日本語で提供してください。

食事記録:
{meal_summary}

以下の観点から分析してください：
1. 栄養バランス（炭水化物、タンパク質、ビタミン、ミネラル）
2. 食事のタイミングと頻度
3. カロリー摂取量の適切性
4. 改善すべき点
5. 具体的な推奨事項

回答は親しみやすく、実践的なアドバイスを含めてください。専門用語