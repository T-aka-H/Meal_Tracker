from flask import Flask, request, Response, jsonify, send_from_directory
import requests
import os
from dotenv import load_dotenv
import logging
from flask_cors import CORS
from datetime import datetime
import json

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 環境変数の読み込み
load_dotenv()

app = Flask(__name__)
CORS(app)

# 環境変数から設定を取得
COHERE_API_KEY = os.environ.get('COHERE_API_KEY')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY') 
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://nhnanyzkcxlysugllpde.supabase.co')

# デフォルトプロンプトテンプレート
DEFAULT_PROMPT_TEMPLATE = """以下は過去1週間の食事記録です。この記録を基に、栄養バランス、食事パターン、健康面でのアドバイスを日本語で提供してください。

食事記録:
{meal_summary}

以下の観点から分析してください：
1. 栄養バランス（炭水化物、タンパク質、ビタミン、ミネラル）
2. 食事のタイミングと頻度
3. カロリー摂取量の適切性
4. 改善すべき点
5. 具体的な推奨事項

回答は親しみやすく、実践的なアドバイスを含めてください。専門用語は分かりやすく説明してください。"""

# CORSプリフライトリクエストの処理
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = Response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, apikey, prefer'
        return response

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, apikey, prefer'
    return response

# 静的ファイルの提供
@app.route('/')
def serve_static():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory('.', path)

# Supabaseプロキシ
@app.route('/rest/v1/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def proxy(path):
    try:
        target_url = f"{SUPABASE_URL}/rest/v1/{path}"
        if request.query_string:
            target_url += f"?{request.query_string.decode()}"
        
        logger.info(f"Proxying {request.method} request to: {target_url}")
        
        headers = {}
        api_key = request.args.get('apikey') or request.headers.get('apikey') or SUPABASE_ANON_KEY
        if api_key:
            headers['apikey'] = api_key
            headers['Authorization'] = f'Bearer {api_key}'
        
        for header_name in ['content-type', 'prefer']:
            if header_name in request.headers:
                headers[header_name] = request.headers[header_name]
        
        response = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=request.get_data(),
            timeout=30,
            verify=False
        )
        
        logger.info(f"Proxy response status: {response.status_code}")
        
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for (name, value) in response.raw.headers.items()
                  if name.lower() not in excluded_headers]
        
        return Response(response.content, response.status_code, headers)
        
    except requests.RequestException as e:
        logger.error(f"Proxy Request Error: {e}")
        return jsonify({'error': f'Request failed: {str(e)}'}), 502
    except Exception as e:
        logger.error(f"Proxy Error: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# AI診断エンドポイント
@app.route('/api/ai-diagnosis', methods=['POST'])
def ai_diagnosis():
    """COHERE AIを使用した食事診断API"""
    if not COHERE_API_KEY:
        logger.error('COHERE_API_KEY が設定されていません')
        return jsonify({'error': 'COHERE_API_KEY が設定されていません'}), 500
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'リクエストボディが空です'}), 400
        
        meal_records = data.get('meal_records', [])
        custom_prompt = data.get('custom_prompt', DEFAULT_PROMPT_TEMPLATE)
        
        if not meal_records:
            return jsonify({'error': '食事記録が提供されていません'}), 400
        
        logger.info(f'食事記録数: {len(meal_records)}')
        meal_summary = format_meal_records_for_ai(meal_records)
        prompt = custom_prompt.format(meal_summary=meal_summary)
        
        logger.info('COHERE APIにリクエスト送信')
        cohere_response = requests.post(
            'https://api.cohere.ai/v1/generate',
            headers={
                'Authorization': f'Bearer {COHERE_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'command',
                'prompt': prompt,
                'max_tokens': 800,
                'temperature': 0.7,
                'k': 0,
                'stop_sequences': [],
                'return_likelihoods': 'NONE'
            },
            timeout=30
        )
        
        if cohere_response.status_code != 200:
            error_msg = f"COHERE API エラー: {cohere_response.status_code}"
            logger.error(f"{error_msg}: {cohere_response.text}")
            return jsonify({'error': error_msg}), 500
        
        cohere_data = cohere_response.json()
        diagnosis = cohere_data['generations'][0]['text'].strip()
        
        logger.info('AI診断完了')
        return jsonify({
            'success': True,
            'diagnosis': diagnosis,
            'meal_count': len(meal_records)
        })
        
    except requests.exceptions.Timeout:
        logger.error('COHERE API タイムアウト')
        return jsonify({'error': 'AI診断がタイムアウトしました。しばらく時間をおいて再度お試しください。'}), 504
    except requests.exceptions.RequestException as e:
        logger.error(f'COHERE API リクエストエラー: {str(e)}')
        return jsonify({'error': 'AI診断サービスへの接続に失敗しました。'}), 503
    except Exception as e:
        logger.error(f'AI診断エラー: {str(e)}')
        return jsonify({'error': f'内部エラー: {str(e)}'}), 500

def format_meal_records_for_ai(records):
    """食事記録をAI用にフォーマット"""
    formatted_records = []
    for record in records:
        datetime_str = record.get('datetime', '')
        if datetime_str:
            try:
                dt = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
                date_str = dt.strftime('%Y年%m月%d日')
                time_str = dt.strftime('%H:%M')
            except Exception as e:
                logger.warning(f'日時解析エラー: {e}')
                date_str = "日付不明"
                time_str = "時間不明"
        else:
            date_str = "日付不明"
            time_str = "時間不明"
        
        calories = record.get('calories')
        calories_str = f"{calories}kcal" if calories else "不明"
        
        formatted_record = f"""日付: {date_str} {time_str}
食事の種類: {record.get('meal_type', '不明')}
食べ物: {record.get('food_name', '不明')}
カロリー: {calories_str}
場所: {record.get('location', '記録なし')}
備考: {record.get('notes', 'なし')}"""
        
        formatted_records.append(formatted_record)
    
    return '\n\n'.join(formatted_records)

# エラーハンドラー
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Not Found', 'message': 'The requested resource was not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal Server Error', 'message': str(error)}), 500

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method Not Allowed', 'message': 'The method is not allowed for the requested URL'}), 405

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f'Flask アプリケーション開始: ポート{port}, デバッグ{debug}')
    logger.info(f'COHERE API設定: {"有効" if COHERE_API_KEY else "無効"}')
    logger.info(f'Supabase設定: {"有効" if SUPABASE_ANON_KEY and SUPABASE_URL else "無効"}')
    logger.info(f'プロキシ機能: 有効 ({SUPABASE_URL})')
    
    app.run(host='0.0.0.0', port=port, debug=debug)
