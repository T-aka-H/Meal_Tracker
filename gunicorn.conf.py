import multiprocessing
import os

# Server socket
bind = "0.0.0.0:10000"
backlog = 2048

# Worker processes
workers = 1  # 開発環境では1つで十分
worker_class = 'sync'
worker_connections = 1000
timeout = 120  # タイムアウトを120秒に延長
keepalive = 2

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Process naming
proc_name = 'meal-tracker-api'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL
keyfile = None
certfile = None

# アクセスログの設定
accesslog = '-'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)s'

# エラーログの設定
errorlog = '-'
loglevel = 'debug'

# プリロード
preload_app = True

# リクエスト設定
max_requests = 1000
max_requests_jitter = 50

# タイムアウト設定
graceful_timeout = 120
keep_alive = 5

# バッファサイズ設定
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# その他の設定
worker_tmp_dir = '/dev/shm'  # メモリ内一時ディレクトリを使用
forwarded_allow_ips = '*'    # プロキシからのリクエストを許可
proxy_allow_ips = '*'        # プロキシからのリクエストを許可

# セキュリティ設定
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190 