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
    CORS(app)

    # 環境変数から設定を取得
    app.config['COHERE_API_KEY'] = os.environ.get('COHERE_API_KEY')
    app.config['SUPABASE_ANON_KEY'] = os.environ.get('SUPABASE_ANON_KEY')
    app.config['SUPABASE_URL'] = os.environ.get('SUPABASE_URL', 'https://nhnanyzkcxlysugllpde.supabase.co')

    # デフォルトプロンプトテンプレート
    app.config['DEFAULT_PROMPT_TEMPLATE'] = """以下は過去1週間の食事記録です。この記録を基に、栄養バランス、食事パターン、健康面でのアドバイスを日本語で提供してください。

食事記録:
{meal_summary}

以下の観点から分析してください：
1. 栄養バランス（炭水化物、タンパク質、ビタミン、ミネラル）
2. 食事のタイミングと頻度
3. カロリー摂取量の適切性
4. 改善すべき点
5. 具体的な推奨事項

回答は親しみやすく、実践的なアドバイスを含めてください。専門用語は分かりやすく説明してください。"""

    @app.route('/')
    def index():
        """メインページを提供"""
        return send_from_directory('.', 'index.html')

    @app.route('/<path:filename>')
    def serve_static(filename):
        """静的ファイルを提供"""
        return send_from_directory('.', filename)

    @app.route('/api/health')
    def health_check():
        """ヘルスチェックエンドポイント"""
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'environment': {
                'COHERE_API_KEY': bool(app.config['COHERE_API_KEY']),
                'SUPABASE_ANON_KEY': bool(app.config['SUPABASE_ANON_KEY']),
                'SUPABASE_URL': bool(app.config['SUPABASE_URL'])
            }
        })

    @app.route('/api/ai-diagnosis', methods=['POST', 'OPTIONS'])
    def ai_diagnosis():
        """COHERE AIを使用した食事診断API"""
        logger.debug('AI診断エンドポイントにリクエストを受信')
        logger.debug(f'リクエストメソッド: {request.method}')
        logger.debug(f'リクエストヘッダー: {dict(request.headers)}')

        # OPTIONSリクエストの処理
        if request.method == 'OPTIONS':
            response = Response()
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            return response

        if not app.config['COHERE_API_KEY']:
            logger.error('COHERE_API_KEY が設定されていません')
            return jsonify({'error': 'COHERE_API_KEY が設定されていません'}), 500

        try:
            data = request.get_json()
            logger.debug(f'受信したリクエストデータ: {data}')

            if not data:
                logger.error('リクエストボディが空です')
                return jsonify({'error': 'リクエストボディが空です'}), 400

            meal_records = data.get('meal_records', [])
            custom_prompt = data.get('custom_prompt', app.config['DEFAULT_PROMPT_TEMPLATE'])

            if not meal_records:
                logger.error('食事記録が提供されていません')
                return jsonify({'error': '食事記録が提供されていません'}), 400

            logger.info(f'食事記録数: {len(meal_records)}')
            meal_summary = format_meal_records_for_ai(meal_records)
            prompt = custom_prompt.format(meal_summary=meal_summary)

            logger.debug(f'生成されたプロンプト: {prompt}')
            logger.info('COHERE APIにリクエスト送信')

            cohere_response = requests.post(
                'https://api.cohere.ai/v1/generate',
                headers={
                    'Authorization': f'Bearer {app.config["COHERE_API_KEY"]}',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
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

            logger.debug(f'COHERE APIレスポンス: {cohere_response.status_code}')
            logger.debug(f'COHERE APIレスポンス内容: {cohere_response.text[:200]}...')

            if cohere_response.status_code != 200:
                error_msg = f"COHERE API エラー: {cohere_response.status_code}"
                logger.error(f"{error_msg}: {cohere_response.text}")
                return jsonify({'error': error_msg}), 500

            cohere_data = cohere_response.json()
            diagnosis = cohere_data['generations'][0]['text'].strip()

            logger.info('AI診断完了')
            logger.debug(f'診断結果: {diagnosis[:200]}...')

            response = jsonify({
                'success': True,
                'diagnosis': diagnosis,
                'meal_count': len(meal_records)
            })
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response

        except requests.exceptions.Timeout:
            logger.error('COHERE API タイムアウト')
            return jsonify({'error': 'AI診断がタイムアウトしました。しばらく時間をおいて再度お試しください。'}), 504
        except requests.exceptions.RequestException as e:
            logger.error(f'COHERE API リクエストエラー: {str(e)}')
            return jsonify({'error': 'AI診断サービスへの接続に失敗しました。'}), 503
        except Exception as e:
            logger.error(f'AI診断エラー: {str(e)}')
            logger.exception('詳細なエラー情報:')
            return jsonify({'error': f'内部エラー: {str(e)}'}), 500

    return app

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

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
