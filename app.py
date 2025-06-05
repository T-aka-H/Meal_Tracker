from flask import Flask, request, Response
import requests
import os
from dotenv import load_dotenv

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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
