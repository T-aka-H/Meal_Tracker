from flask import Flask, request, Response
import requests
import os
from dotenv import load_dotenv
import logging

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 環境変数の読み込み
load_dotenv()

app = Flask(__name__)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = Response()
        res.headers['Access-Control-Allow-Origin'] = '*'
        res.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        res.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, apikey, prefer'
        return res

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, apikey, prefer'
    return response

@app.route('/rest/v1/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def proxy(path):
    """既存のSupabaseプロキシ機能を維持"""
    try:
        target_url = f"{SUPABASE_URL}/rest/v1/{path}"
        
        if request.query_string:
            target_url += f"?{request.query_string.decode()}"
        
        logger.info(f"Proxying {request.method} request to: {target_url}")
        
        # ヘッダーを取得
        headers = {}
        
        # APIキーの取得（クエリパラメータまたはヘッダーから）
        api_key = request.args.get('apikey') or request.headers.get('apikey') or SUPABASE_ANON_KEY
        if api_key:
            headers['apikey'] = api_key
            headers['Authorization'] = f'Bearer {api_key}'
        
        # その他のヘッダー
        for header_name in ['content-type', 'prefer']:
            if header_name in request.headers:
                headers[header_name] = request.headers[header_name]
        
        # リクエストボディを取得
        data = request.get_data()
        
        # プロキシリクエストを実行
        response = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=data,
            timeout=30,
            verify=False
        )
        
        logger.info(f"Proxy response status: {response.status_code}")
        
        # レスポンスを返す
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        response_headers = [(name, value) for (name, value) in response.raw.headers.items()
                          if name.lower() not in excluded_headers]
        
        return Response(
            response.content,
            status=response.status_code,
            headers=response_headers
        )
        
    except requests.RequestException as e:
        logger.error(f"Proxy Request Error: {e}")
        return {'error': f'Request failed: {str(e)}'}, 502
    
    except Exception as e:
        logger.error(f"Proxy Error: {e}")
        return {'error': f'Internal server error: {str(e)}'}, 500

# === 新しいAI診断機能 ===
@app.route('/')
def index():
    """メインページ - 既存のHTMLファイルを返す"""
    try:
        return send_from_directory('.', 'index.html')
    except FileNotFoundError:
        return "index.html not found", 404

@app.route('/app.js')
def serve_js():
    """JavaScriptファイルを配信"""
    try:
        return send_from_directory('.', 'app.js', mimetype='application/javascript')
    except FileNotFoundError:
        return "app.js not found", 404

@app.route('/styles.css')
def serve_css():
    """CSSファイルを配信"""
    try:
        return send_from_directory('.', 'styles.css', mimetype='text/css')
    except FileNotFoundError:
        return "styles.css not found", 404

@app.route('/api/ai-diagnosis', methods=['POST'])
def ai_diagnosis():
    """COHERE AIを使用した食事診断API"""
    
    if not COHERE_API_KEY:
        logger.error('COHERE_API_KEY が設定されていません')
        return jsonify({'error': 'COHERE_API_KEY が設定されていません'}), 500
    
    try:
        # フロントエンドからのデータを取得
        data = request.get_json()
        meal_records = data.get('meal_records', [])
        custom_prompt = data.get('custom_prompt', DEFAULT_PROMPT_TEMPLATE)
        
        if not meal_records:
            return jsonify({'error': '食事記録が提供されていません'}), 400
        
        logger.info(f'食事記録数: {len(meal_records)}')
        logger.info(f'カスタムプロンプト使用: {custom_prompt != DEFAULT_PROMPT_TEMPLATE}')
        
        # 食事記録を整形
        meal_summary = format_meal_records_for_ai(meal_records)
        
        # プロンプト作成（カスタムプロンプトまたはデフォルト）
        prompt = custom_prompt.format(meal_summary=meal_summary)
        
        logger.info(f'生成されたプロンプト長: {len(prompt)}文字')
        
        # COHERE APIに診断を依頼
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
        
        logger.info(f'COHERE APIレスポンス: {cohere_response.status_code}')
        
        if cohere_response.status_code != 200:
            error_msg = f"COHERE API エラー: {cohere_response.status_code}"
            logger.error(f"{error_msg}: {cohere_response.text}")
            return jsonify({'error': error_msg}), 500
        
        cohere_data = cohere_response.json()
        diagnosis = cohere_data['generations'][0]['text'].strip()
        
        logger.info(f'診断結果長: {len(diagnosis)}文字')
        
        return jsonify({
            'success': True,
            'diagnosis': diagnosis,
            'meal_count': len(meal_records),
            'prompt_used': custom_prompt != DEFAULT_PROMPT_TEMPLATE
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

@app.route('/api/prompt-template', methods=['GET'])
def get_prompt_template():
    """現在のプロンプトテンプレートを取得"""
    return jsonify({
        'default_template': DEFAULT_PROMPT_TEMPLATE,
        'variables': ['meal_summary'],
        'description': 'プロンプト内で {meal_summary} が実際の食事記録に置き換えられます'
    })

@app.route('/api/prompt-template', methods=['POST'])
def save_prompt_template():
    """カスタムプロンプトテンプレートを保存（セッション用）"""
    try:
        data = request.get_json()
        custom_prompt = data.get('prompt_template', '')
        
        if not custom_prompt:
            return jsonify({'error': 'プロンプトテンプレートが空です'}), 400
        
        # {meal_summary} が含まれているかチェック
        if '{meal_summary}' not in custom_prompt:
            return jsonify({'error': 'プロンプトには {meal_summary} を含める必要があります'}), 400
        
        logger.info(f'カスタムプロンプト保存: {len(custom_prompt)}文字')
        
        return jsonify({
            'success': True,
            'message': 'プロンプトテンプレートを保存しました',
            'template': custom_prompt
        })
        
    except Exception as e:
        logger.error(f'プロンプト保存エラー: {str(e)}')
        return jsonify({'error': f'プロンプトの保存に失敗しました: {str(e)}'}), 500

def format_meal_records_for_ai(records):
    """食事記録をAI用にフォーマット"""
    formatted_records = []
    
    for record in records:
        datetime_str = record.get('datetime', '')
        if datetime_str:
            try:
                # ISO形式の日時をパース
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
        
        # カロリーの処理
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

@app.route('/api/health', methods=['GET'])
def health_check():
    """ヘルスチェック用エンドポイント"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cohere_api_configured': bool(COHERE_API_KEY),
        'supabase_configured': bool(SUPABASE_ANON_KEY and SUPABASE_URL),
        'proxy_enabled': True,
        'version': '2.0.0'
    })

@app.route('/api/test-cohere', methods=['POST'])
def test_cohere():
    """COHERE API接続テスト"""
    if not COHERE_API_KEY:
        return jsonify({'error': 'COHERE_API_KEY が設定されていません'}), 500
    
    try:
        test_prompt = "こんにちは。簡単な挨拶をお願いします。"
        
        response = requests.post(
            'https://api.cohere.ai/v1/generate',
            headers={
                'Authorization': f'Bearer {COHERE_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'command',
                'prompt': test_prompt,
                'max_tokens': 50,
                'temperature': 0.7
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                'success': True,
                'message': 'COHERE API接続成功',
                'test_response': data['generations'][0]['text'].strip()
            })
        else:
            return jsonify({
                'success': False,
                'error': f'COHERE API エラー: {response.status_code}',
                'details': response.text
            }), response.status_code
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'COHERE API接続テスト失敗: {str(e)}'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'エンドポイントが見つかりません'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': '内部サーバーエラーが発生しました'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f'Flask アプリケーション開始: ポート{port}, デバッグ{debug}')
    logger.info(f'COHERE API設定: {"有効" if COHERE_API_KEY else "無効"}')
    logger.info(f'Supabase設定: {"有効" if SUPABASE_ANON_KEY and SUPABASE_URL else "無効"}')
    logger.info(f'プロキシ機能: 有効 ({SUPABASE_URL})')
    
    app.run(host='0.0.0.0', port=port, debug=debug)
