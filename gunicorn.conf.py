import multiprocessing
import os

# ワーカープロセス数（開発環境では1つで十分）
workers = 1

# ワーカークラス
worker_class = 'sync'

# バインドするアドレス
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# タイムアウト設定（COHEREのAPIコールに十分な時間を確保）
timeout = 300

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