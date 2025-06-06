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

    @app.route('/api/prompt-template', methods=['GET', 'POST'])
    def handle_prompt_template():
        """プロンプトテンプレートの取得と保存"""
        if request.method == 'GET':
            # デフォルトプロンプトを返す
            return jsonify({
                'success': True,
                'default_template': app.config['DEFAULT_PROMPT_TEMPLATE_JA']
            })
        
        elif request.method == 'POST':
            # カスタムプロンプトの保存（実際にはメモリに保存するだけ）
            try:
                data = request.get_json()
                prompt_template = data.get('prompt_template', '')
                
                if not prompt_template:
                    return jsonify({'error': 'プロンプトが空です'}), 400
                
                if '{meal_summary}' not in prompt_template:
                    return jsonify({'error': 'プロンプトには {meal_summary} を含める必要があります'}), 400
                
                # 実際の実装では、データベースやファイルに保存することを検討
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
            # 簡単なテストプロンプト
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
    logger.debug(f'生成されたプロンプト: {prompt}')
    logger.info('COHERE APIにリクエスト送信')

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
        timeout=30
    )

    logger.debug(f'COHERE APIレスポンス: {cohere_response.status_code}')
    logger.debug(f'COHERE APIレスポンス内容: {cohere_response.text[:200]}...')

    if cohere_response.status_code != 200:
        error_msg = f"COHERE API エラー: {cohere_response.status_code}"
        logger.error(f"{error_msg}: {cohere_response.text}")
        raise Exception(error_msg)

    cohere_data = cohere_response.json()
    return cohere_data['generations'][0]['text'].strip()

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
