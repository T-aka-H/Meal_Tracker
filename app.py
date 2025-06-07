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
    
    # CORSの設定（シンプル化）
    CORS(app, origins="*")

    # 環境変数から設定を取得
    app.config['COHERE_API_KEY'] = os.environ.get('COHERE_API_KEY')
    app.config['GEMINI_API_KEY'] = os.environ.get('GEMINI_API_KEY')
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

回答は親しみやすく、実践的なアドバイスを含めてください。専門用語は分かりやすく説明してください。"""

    app.config['DEFAULT_PROMPT_TEMPLATE_EN'] = """Below are meal records from the past week. Based on these records, please provide advice on nutritional balance, meal patterns, and health aspects in English.

Meal Records:
{meal_summary}

Please analyze from the following perspectives:
1. Nutritional balance (carbohydrates, protein, vitamins, minerals)
2. Meal timing and frequency
3. Appropriateness of calorie intake
4. Points for improvement
5. Specific recommendations

Please provide friendly and practical advice. Explain technical terms in an easy-to-understand way."""

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
                'GEMINI_API_KEY': bool(app.config['GEMINI_API_KEY']),
                'SUPABASE_ANON_KEY': bool(app.config['SUPABASE_ANON_KEY']),
                'SUPABASE_URL': bool(app.config['SUPABASE_URL'])
            }
        })

    @app.route('/api/prompt-template', methods=['GET', 'POST'])
    def handle_prompt_template():
        """プロンプトテンプレートの取得と保存"""
        if request.method == 'GET':
            return jsonify({
                'success': True,
                'default_template': app.config['DEFAULT_PROMPT_TEMPLATE_JA']
            })
        
        elif request.method == 'POST':
            try:
                data = request.get_json()
                prompt_template = data.get('prompt_template', '')
                
                if not prompt_template:
                    return jsonify({'error': 'プロンプトが空です'}), 400
                
                if '{meal_summary}' not in prompt_template:
                    return jsonify({'error': 'プロンプトには {meal_summary} を含める必要があります'}), 400
                
                logger.info('カスタムプロンプトを受信（メモリに保存）')
                
                return jsonify({
                    'success': True,
                    'message': 'プロンプトを保存しました'
                })
                
            except Exception as e:
                logger.error(f'プロンプト保存エラー: {str(e)}')
                return jsonify({'error': str(e)}), 500

    @app.route('/api/test-cohere', methods=['POST'])
    def test_cohere():
        """COHERE API接続テスト"""
        logger.debug('COHERE接続テストを実行')
        
        if not app.config['COHERE_API_KEY']:
            return jsonify({
                'success': False,
                'error': 'COHERE_API_KEY が設定されていません'
            }), 500
        
        try:
            test_prompt = "こんにちは。これはAPIテストです。短く返答してください。"
            
            response = requests.post(
                'https://api.cohere.ai/v1/generate',
                headers={
                    'Authorization': f'Bearer {app.config["COHERE_API_KEY"]}',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                json={
                    'model': 'command',
                    'prompt': test_prompt,
                    'max_tokens': 50,
                    'temperature': 0.5,
                    'k': 0,
                    'stop_sequences': [],
                    'return_likelihoods': 'NONE'
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                test_response = data['generations'][0]['text'].strip()
                
                return jsonify({
                    'success': True,
                    'test_response': test_response,
                    'message': 'COHERE API接続成功'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'APIエラー: {response.status_code}'
                }), response.status_code
                
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'error': 'タイムアウト：APIの応答が遅いです'
            }), 504
        except Exception as e:
            logger.error(f'COHERE接続テストエラー: {str(e)}')
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/test-gemini', methods=['POST'])
    def test_gemini():
        """Gemini API接続テスト"""
        logger.debug('Gemini接続テストを実行')
        
        if not app.config['GEMINI_API_KEY']:
            return jsonify({
                'success': False,
                'error': 'GEMINI_API_KEY が設定されていません'
            }), 500
        
        try:
            test_prompt = "こんにちは。これはAPIテストです。短く返答してください。"
            
            response = requests.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={app.config["GEMINI_API_KEY"]}',
                headers={
                    'Content-Type': 'application/json'
                },
                json={
                    'contents': [{
                        'parts': [{
                            'text': test_prompt
                        }]
                    }],
                    'generationConfig': {
                        'maxOutputTokens': 50,
                        'temperature': 0.5
                    }
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                test_response = data['candidates'][0]['content']['parts'][0]['text'].strip()
                
                return jsonify({
                    'success': True,
                    'test_response': test_response,
                    'message': 'Gemini API接続成功'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'APIエラー: {response.status_code}'
                }), response.status_code
                
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'error': 'タイムアウト：APIの応答が遅いです'
            }), 504
        except Exception as e:
            logger.error(f'Gemini接続テストエラー: {str(e)}')
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/ai-diagnosis', methods=['POST', 'OPTIONS'])
    def ai_diagnosis():
        """Cohere または Gemini AIを使用した食事診断API"""
        logger.debug('AI診断エンドポイントにリクエストを受信')

        if request.method == 'OPTIONS':
            response = Response()
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            return response

        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'リクエストボディが空です'}), 400

            meal_records = data.get('meal_records', [])
            llm_provider = data.get('llm_provider', 'cohere')
            custom_prompt_ja = data.get('custom_prompt_ja') or app.config['DEFAULT_PROMPT_TEMPLATE_JA']
            custom_prompt_en = data.get('custom_prompt_en') or app.config['DEFAULT_PROMPT_TEMPLATE_EN']

            if not meal_records:
                return jsonify({'error': '食事記録が提供されていません'}), 400

            if llm_provider == 'cohere' and not app.config['COHERE_API_KEY']:
                return jsonify({'error': 'COHERE_API_KEY が設定されていません'}), 500
            elif llm_provider == 'gemini' and not app.config['GEMINI_API_KEY']:
                return jsonify({'error': 'GEMINI_API_KEY が設定されていません'}), 500

            meal_summary = format_meal_records_for_ai(meal_records)
            
            prompt_ja = custom_prompt_ja.format(meal_summary=meal_summary)
            if llm_provider == 'cohere':
                diagnosis_ja = get_cohere_diagnosis(prompt_ja, app.config['COHERE_API_KEY'])
            else:
                diagnosis_ja = get_gemini_diagnosis(prompt_ja, app.config['GEMINI_API_KEY'])
            
            prompt_en = custom_prompt_en.format(meal_summary=meal_summary)
            if llm_provider == 'cohere':
                diagnosis_en = get_cohere_diagnosis(prompt_en, app.config['COHERE_API_KEY'])
            else:
                diagnosis_en = get_gemini_diagnosis(prompt_en, app.config['GEMINI_API_KEY'])

            response = jsonify({
                'success': True,
                'diagnosis_ja': diagnosis_ja,
                'diagnosis_en': diagnosis_en,
                'meal_count': len(meal_records),
                'llm_provider': llm_provider
            })
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response

        except requests.exceptions.Timeout:
            return jsonify({'error': 'AI診断がタイムアウトしました。しばらく時間をおいて再度お試しください。'}), 504
        except requests.exceptions.RequestException as e:
            return jsonify({'error': 'AI診断サービスへの接続に失敗しました。'}), 503
        except Exception as e:
            logger.error(f'AI診断エラー: {str(e)}')
            return jsonify({'error': f'内部エラー: {str(e)}'}), 500

    # エラーハンドリング
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({'error': 'エンドポイントが見つかりません'}), 404

    @app.errorhandler(405)
    def method_not_allowed_error(error):
        return jsonify({'error': '許可されていないHTTPメソッドです'}), 405

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f'内部サーバーエラー: {str(error)}')
        return jsonify({'error': '内部サーバーエラーが発生しました'}), 500

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

def get_cohere_diagnosis(prompt, api_key):
    """COHEREを使用して診断を取得"""
    logger.info('COHERE APIにリクエスト送信')

    try:
        cohere_response = requests.post(
            'https://api.cohere.ai/v1/generate',
            headers={
                'Authorization': f'Bearer {api_key}',
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
            timeout=60
        )

        if cohere_response.status_code != 200:
            error_msg = f"COHERE API エラー: {cohere_response.status_code}"
            logger.error(f"{error_msg}: {cohere_response.text}")
            raise Exception(error_msg)

        cohere_data = cohere_response.json()
        return cohere_data['generations'][0]['text'].strip()

    except requests.exceptions.Timeout:
        raise Exception('COHERE APIがタイムアウトしました。しばらく時間をおいて再度お試しください。')
    except requests.exceptions.RequestException as e:
        raise Exception(f'COHERE APIへの接続に失敗しました: {str(e)}')
    except Exception as e:
        logger.error(f'予期せぬエラー: {str(e)}')
        raise

def get_gemini_diagnosis(prompt, api_key):
    """Geminiを使用して診断を取得"""
    logger.info('Gemini APIにリクエスト送信')

    try:
        gemini_response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={api_key}',
            headers={
                'Content-Type': 'application/json'
            },
            json={
                'contents': [{
                    'parts': [{
                        'text': prompt
                    }]
                }],
                'generationConfig': {
                    'maxOutputTokens': 800,
                    'temperature': 0.7,
                    'topP': 0.9,
                    'topK': 40
                },
                'safetySettings': [
                    {
                        'category': 'HARM_CATEGORY_HARASSMENT',
                        'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                    },
                    {
                        'category': 'HARM_CATEGORY_HATE_SPEECH',
                        'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                    },
                    {
                        'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                        'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                    },
                    {
                        'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                    }
                ]
            },
            timeout=60
        )

        if gemini_response.status_code != 200:
            error_msg = f"Gemini API エラー: {gemini_response.status_code}"
            logger.error(f"{error_msg}: {gemini_response.text}")
            raise Exception(error_msg)

        gemini_data = gemini_response.json()
        
        if 'candidates' not in gemini_data or len(gemini_data['candidates']) == 0:
            raise Exception('Gemini APIからの応答が予期された形式ではありません')
        
        candidate = gemini_data['candidates'][0]
        
        if 'finishReason' in candidate and candidate['finishReason'] != 'STOP':
            if candidate['finishReason'] == 'SAFETY':
                return "申し訳ございませんが、安全性の観点から診断結果を生成できませんでした。別の方法でお試しください。"
        
        if 'content' not in candidate or 'parts' not in candidate['content']:
            raise Exception('Gemini APIからの応答にコンテンツが含まれていません')
        
        text_content = candidate['content']['parts'][0]['text'].strip()
        return text_content

    except requests.exceptions.Timeout:
        raise Exception('Gemini APIがタイムアウトしました。しばらく時間をおいて再度お試しください。')
    except requests.exceptions.RequestException as e:
        raise Exception(f'Gemini APIへの接続に失敗しました: {str(e)}')
    except Exception as e:
        logger.error(f'予期せぬエラー: {str(e)}')
        raise

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() in ['true', '1', 'yes']
    
    logger.info(f'アプリケーション起動: ポート {port}, デバッグモード: {debug_mode}')
    logger.info(f'環境変数確認 - COHERE_API_KEY: {"設定済み" if os.environ.get("COHERE_API_KEY") else "未設定"}')
    logger.info(f'環境変数確認 - GEMINI_API_KEY: {"設定済み" if os.environ.get("GEMINI_API_KEY") else "未設定"}')
    
    app.run(host='0.0.0.0', port=port, debug=debug_mode)