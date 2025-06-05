from flask import Flask, request, Response, jsonify
import requests
import os
from dotenv import load_dotenv
import cohere
from flask_cors import CORS

# 環境変数の読み込み
load_dotenv()

app = Flask(__name__)
CORS(app)  # CORSを有効化

# Cohereクライアントの初期化
cohere_client = cohere.Client(os.getenv('COHERE_API_KEY'))

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
    try:
        # Supabase URLを取得
        supabase_url = os.getenv('SUPABASE_URL', 'https://nhnanyzkcxlysugllpde.supabase.co')
        target_url = f"{supabase_url}/rest/v1/{path}"
        
        # クエリパラメータがある場合は追加
        if request.query_string:
            target_url += f"?{request.query_string.decode()}"
        
        print(f"Proxying {request.method} request to: {target_url}")
        
        # ヘッダーを取得
        headers = {}
        
        # APIキーの取得（クエリパラメータまたはヘッダーから）
        api_key = request.args.get('apikey') or request.headers.get('apikey')
        if api_key:
            headers['apikey'] = api_key
            headers['Authorization'] = f'Bearer {api_key}'
        
        # その他のヘッダー
        for header_name in ['content-type', 'prefer']:
            if header_name in request.headers:
                headers[header_name] = request.headers[header_name]
        
        print(f"Headers: {headers}")
        
        # リクエストボディを取得
        data = request.get_data()
        
        # プロキシリクエストを実行
        response = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=data,
            timeout=30,
            verify=True  # SSL証明書の検証を有効化
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response content: {response.text[:200]}...")  # 最初の200文字をログ出力
        
        # レスポンスを返す
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for (name, value) in response.raw.headers.items()
                  if name.lower() not in excluded_headers]
        
        return Response(
            response.content,
            status=response.status_code,
            headers=headers
        )
        
    except requests.RequestException as e:
        print(f"Request Error: {e}")
        return {'error': f'Request failed: {str(e)}'}, 502
    
    except Exception as e:
        print(f"Proxy Error: {e}")
        return {'error': f'Internal server error: {str(e)}'}, 500

@app.route('/api/get-meal-advice', methods=['POST', 'OPTIONS'])
def get_meal_advice():
    if request.method == "OPTIONS":
        return '', 204
        
    try:
        data = request.json
        meal_records = data.get('meal_records', [])
        
        if not meal_records:
            return jsonify({'error': '食事記録が提供されていません'}), 400

        # 食事記録を文字列にフォーマット
        meals_text = "最近の食事記録:\n"
        for record in meal_records:
            datetime = record['datetime']
            meals_text += f"- {datetime[:10]} {datetime[11:16]} {record['meal_type']}: {record['food_name']}"
            if record.get('calories'):
                meals_text += f" ({record['calories']}kcal)"
            if record.get('location'):
                meals_text += f" @ {record['location']}"
            meals_text += "\n"

        # Cohereプロンプトの作成
        prompt = f"""You are a registered dietitian who can speak both English and Japanese, but you are more comfortable thinking in English first.

Please analyze the following meal records and provide health advice in the following two steps:

Step 1: First, think and formulate your advice in English
Step 2: Then translate your thoughts into natural, professional Japanese

Recent meal records:
{meals_text}

Please focus on the following points:
1. Meal timing and frequency
2. Calorie intake appropriateness
3. Nutritional balance analysis
4. Specific suggestions for improvement

First, formulate your thoughts in English, considering:
- Professional dietary advice
- Scientific reasoning
- Practical and actionable suggestions
- Encouraging and supportive tone

Format your English response as:
- 3-4 bullet points with specific advice
- Each point should be 2-3 lines with detailed explanation
- End with one line of encouragement

Then, translate your advice into Japanese, ensuring:
・「です・ます」調の丁寧な言葉遣い
・専門家らしい説得力のある表現
・具体的で実践的なアドバイス
・温かく励ましの気持ちを込めた文章

Please provide your response in the following format:

[ENGLISH]
• First advice point in English...

• Second advice point in English...

• Third advice point in English...

Keep up the great work with your meal tracking!

[JAPANESE]
・最初のアドバイスポイント...

・2つ目のアドバイスポイント...

・3つ目のアドバイスポイント...

毎日の食事記録、素晴らしい習慣ですね。これからも続けていきましょう！"""

        # Cohereを使用してアドバイスを生成
        response = cohere_client.generate(
            prompt=prompt,
            max_tokens=800,  # トークン数を増やして両言語分の出力に対応
            temperature=0.7,
            model='command',
            stop_sequences=[],
            return_likelihoods='NONE'
        )

        advice = response.generations[0].text.strip()
        
        # 英語と日本語のアドバイスを分割
        try:
            english_advice = ""
            japanese_advice = ""
            
            parts = advice.split("[JAPANESE]")
            if len(parts) == 2:
                english_part = parts[0].split("[ENGLISH]")
                if len(english_part) == 2:
                    english_advice = english_part[1].strip()
                japanese_advice = parts[1].strip()
            
            return jsonify({
                'advice_en': english_advice,
                'advice_jp': japanese_advice,
                'status': 'success'
            })
        except Exception as e:
            print(f"アドバイス分割エラー: {e}")
            return jsonify({
                'advice_en': advice,
                'advice_jp': advice,
                'status': 'success'
            })

    except Exception as e:
        print(f"AIアドバイス生成エラー: {e}")
        return jsonify({'error': f'アドバイスの生成に失敗しました: {str(e)}'}), 500

@app.route('/')
def health_check():
    return {'status': 'OK', 'message': 'Proxy server is running'}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
