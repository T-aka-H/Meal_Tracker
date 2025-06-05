from flask import Flask, request, Response, jsonify
import requests
import os
from dotenv import load_dotenv
import cohere

# 環境変数の読み込み
load_dotenv()

app = Flask(__name__)

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
            verify=False  # SSL証明書の検証をスキップ
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

@app.route('/')
def health_check():
    return {'status': 'OK', 'message': 'Proxy server is running'}

@app.route('/api/get-meal-advice', methods=['POST'])
def get_meal_advice():
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
        prompt = f"""あなたは栄養士のアシスタントです。以下の食事記録を分析し、健康的な食生活のためのアドバイスを提供してください。
カロリー、栄養バランス、食事のタイミングなどの観点から具体的なアドバイスをお願いします。

{meals_text}

以下の点に注目してアドバイスを提供してください：
1. 食事のタイミングと頻度
2. カロリー摂取の適切性
3. 栄養バランスの分析
4. 改善のための具体的な提案

できるだけ具体的で実践的なアドバイスを、優しい口調で日本語で提供してください。
アドバイスは箇条書きで、3-4項目程度にまとめてください。"""

        # Cohereを使用してアドバイスを生成
        response = cohere_client.generate(
            prompt=prompt,
            max_tokens=500,
            temperature=0.7,
            model='command',
            stop_sequences=[],
            return_likelihoods='NONE'
        )

        advice = response.generations[0].text.strip()
        
        return jsonify({
            'advice': advice,
            'status': 'success'
        })

    except Exception as e:
        print(f"AIアドバイス生成エラー: {e}")
        return jsonify({'error': f'アドバイスの生成に失敗しました: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
