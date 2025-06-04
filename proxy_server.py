from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import sys
import ssl
import os
from dotenv import load_dotenv
from wsgiref.simple_server import make_server

# 環境変数の読み込み
load_dotenv()

class CORSProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, prefer')
        self.end_headers()

    def do_GET(self):
        """Proxy GET requests to Supabase"""
        self.proxy_request('GET')

    def do_POST(self):
        """Proxy POST requests to Supabase"""
        self.proxy_request('POST')

    def do_PUT(self):
        """Proxy PUT requests to Supabase"""
        self.proxy_request('PUT')

    def do_DELETE(self):
        """Proxy DELETE requests to Supabase"""
        self.proxy_request('DELETE')

    def proxy_request(self, method):
        try:
            if not self.path.startswith('/rest/v1/'):
                self.send_error(400, 'Invalid path')
                return

            # 環境変数からSupabase URLを取得
            supabase_url = os.getenv('SUPABASE_URL', 'https://nhnanyzkcxlysugllpde.supabase.co')
            target_url = supabase_url + self.path

            print(f"Proxying {method} request to: {target_url}")

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None

            headers = {}
            for header in ['authorization', 'apikey', 'content-type', 'prefer']:
                if header in self.headers:
                    headers[header] = self.headers[header]

            # SSL証明書の検証をスキップするためのコンテキスト作成
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            req = urllib.request.Request(target_url, data=body, headers=headers, method=method)

            # SSL証明書検証をスキップしてリクエストを実行
            with urllib.request.urlopen(req, context=ssl_context) as response:
                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, prefer')
                
                if response.headers.get('content-type'):
                    self.send_header('Content-Type', response.headers['content-type'])
                
                self.end_headers()

                response_data = response.read()
                self.wfile.write(response_data)

        except urllib.error.HTTPError as e:
            print(f"HTTP Error: {e.code} - {e.reason}")
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            try:
                error_data = e.read()
                self.wfile.write(error_data)
            except:
                error_response = json.dumps({'error': f'HTTP {e.code}: {e.reason}'}).encode()
                self.wfile.write(error_response)

        except Exception as e:
            print(f"Proxy Error: {e}")
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'error': str(e)}).encode()
            self.wfile.write(error_response)

def create_app():
    """Create WSGI app for Render"""
    def wsgi_app(environ, start_response):
        # 新しいハンドラーインスタンスを作成
        handler = CORSProxyHandler(
            environ.get('wsgi.input'),
            environ.get('wsgi.errors'),
            environ.get('wsgi.url_scheme')
        )
        
        # レスポンスヘッダーを設定
        status = '200 OK'
        headers = [
            ('Content-type', 'application/json'),
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, prefer')
        ]
        
        start_response(status, headers)
        
        # パスとメソッドを取得
        path = environ.get('PATH_INFO', '')
        method = environ.get('REQUEST_METHOD', 'GET')
        
        try:
            # プロキシリクエストを処理
            if method == 'OPTIONS':
                return [b'']
            
            if not path.startswith('/rest/v1/'):
                return [json.dumps({'error': 'Invalid path'}).encode()]
            
            # Supabase URLを構築
            supabase_url = os.getenv('SUPABASE_URL', 'https://nhnanyzkcxlysugllpde.supabase.co')
            target_url = supabase_url + path
            
            # ヘッダーを取得
            headers = {}
            for header in ['authorization', 'apikey', 'content-type', 'prefer']:
                env_header = 'HTTP_' + header.upper().replace('-', '_')
                if env_header in environ:
                    headers[header] = environ[env_header]
            
            # リクエストボディを読み取り
            content_length = int(environ.get('CONTENT_LENGTH', 0))
            body = environ['wsgi.input'].read(content_length) if content_length > 0 else None
            
            # SSL検証をスキップ
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # リクエストを作成
            req = urllib.request.Request(target_url, data=body, headers=headers, method=method)
            
            # リクエストを実行
            with urllib.request.urlopen(req, context=ssl_context) as response:
                return [response.read()]
                
        except Exception as e:
            error_response = json.dumps({'error': str(e)}).encode()
            return [error_response]
    
    return wsgi_app

app = create_app()

if __name__ == '__main__':
    # ローカル開発用のサーバー
    port = int(os.environ.get('PORT', 8080))
    with make_server('', port, app) as httpd:
        print(f"WSGI Server running on port {port}...")
        httpd.serve_forever() 