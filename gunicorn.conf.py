import multiprocessing
import os

# ワーカープロセス数
workers = multiprocessing.cpu_count() * 2 + 1

# ワーカークラス
worker_class = 'sync'

# バインドするアドレス
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# タイムアウト設定
timeout = 120

# アクセスログの設定
accesslog = '-'
access_log_format = '%({x-real-ip}i)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# エラーログの設定
errorlog = '-'
loglevel = 'info'

# プリロード
preload_app = True

# 最大リクエストサイズ
limit_request_line = 0
limit_request_fields = 32768
limit_request_field_size = 0 