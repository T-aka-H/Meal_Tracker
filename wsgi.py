import os
from app import create_app

# アプリケーションの作成
app = create_app()

if __name__ == "__main__":
    # 環境変数からポートを取得
    port = int(os.environ.get('PORT', 5000))
    # アプリケーションを起動
    app.run(host='0.0.0.0', port=port) 