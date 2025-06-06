import os
from dotenv import load_dotenv
from app import create_app

# 環境変数の読み込み
load_dotenv()

# アプリケーションの作成
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port) 