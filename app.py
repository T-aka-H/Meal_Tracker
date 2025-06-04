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
        for header in ['authorization', 'apikey', 'content-type', 'prefer']:
            if header in request.headers:
                headers[header] = request.headers[header]
        
        # リクエストボディを取得
        data = request.get_data()
        
        # プロキシリクエストを実行
        response = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=data,
            verify=False  # SSL証明書の検証をスキップ
        )
        
        # レスポンスを返す
        return Response(
            response.content,
            status=response.status_code,
            headers=dict(response.headers)
        )
        
    except Exception as e:
        print(f"Proxy Error: {e}")
        return {'error': str(e)}, 500

@app.route('/')
def health_check():
    return {'status': 'OK', 'message': 'Proxy server is running'}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
