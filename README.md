# Avatar Voice Agent

OpenAI Realtime APIを使用した音声エージェント。音声に反応する3Dビジュアライゼーションを備えたシンプルなUIで、AIと自然に会話できます。

## 特徴

- 🎙️ **音声ベースの対話**: テキスト入力不要、音声だけでAIと会話
- 🌊 **3Dビジュアライゼーション**: 音声に反応して動く3D球体とリング（Three.js使用）
- ⚡ **低レイテンシー**: OpenAI Realtime API（WebRTC）による自然な会話体験
- 🔐 **パスワード認証**: SHA-256ハッシュによる安全なアクセス制御
- 📊 **使用量トラッキング**: リアルタイムのトークン数とコスト表示
- 🎨 **カスタマイズ可能**: テーマ切り替え（ライト/ダーク/システム）、ビジュアライゼーション選択（球体/リング）
- 🔍 **Web検索機能**: Tavily AI Search API統合でリアルタイム情報にアクセス

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成（または`.env.example`をコピー）して、APIキーを設定：

```bash
cp .env.example .env
```

`.env`ファイルを編集：
```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
PASSWORD_HASH=<SHA-256ハッシュ>
```

**APIキーの取得**:
- OpenAI API: https://platform.openai.com/api-keys
- Tavily API (無料枠: 月1,000クエリ): https://tavily.com

**パスワードハッシュの生成**:
```bash
node generate-password-hash.js
# プロンプトに従ってパスワードを入力
# 出力されたハッシュを .env の PASSWORD_HASH に設定
```

**重要**: APIキーとパスワードハッシュはサーバーサイドで管理され、クライアント側には公開されません。

### 3. サーバーとクライアントの起動

2つのターミナルで以下を実行：

**ターミナル1: バックエンドサーバー**
```bash
npm run server
```

**ターミナル2: フロントエンド開発サーバー**
```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

## 使い方

1. **設定**: 右下の + ボタンをクリックして設定を開く
   - **Password**: 接続時の認証に使用（初回必須）
   - **Voice**: 音声の種類を選択（変更時は再接続が必要）
   - **Model**: 使用するモデルを選択
   - **Instructions**: AIへの指示（システムプロンプト）
   - **Theme**: ライト/ダーク/システム
   - **Visualization**: 球体/リング
2. **接続**: 画面下部中央の「Connect」ボタンをクリック（パスワード認証が実行されます）
3. **会話**: マイクの使用を許可して、AIと自然に会話できます
4. **切断**: 「Disconnect」ボタンで接続を終了

**セッション情報**: 画面左上に現在のVoice、Model、トークン使用量、コストが表示されます

## ビルド

本番用にビルド：

```bash
npm run build
```

ビルドされたファイルは`dist/`ディレクトリに出力されます。

プレビュー：

```bash
npm run preview
```

## 技術スタック

- **OpenAI Realtime API**: WebRTC経由での音声通信
- **@openai/agents SDK**: 高レベルのRealtime API統合
- **Tavily AI Search API**: AI向けに最適化されたWeb検索
- **Vanilla JavaScript**: フレームワーク不要のシンプルな実装
- **Three.js**: 3Dビジュアライゼーション
- **Web Audio API**: 音声レベルの解析
- **Web Crypto API**: SHA-256によるパスワードハッシュ化
- **Express**: バックエンドサーバー（エフェメラルキー生成・認証・検索プロキシ）
- **Vite**: 高速な開発環境

## プロジェクト構造

```
avatar/
├── index.html                    # メインHTML（CSS変数でテーマ管理）
├── server.js                     # バックエンドサーバー（認証・トークン・検索API）
├── generate-password-hash.js     # パスワードハッシュ生成ユーティリティ
├── src/
│   ├── main.js                   # アプリケーションロジック・Realtime API統合
│   ├── auth.js                   # パスワード認証システム
│   ├── config.js                 # API設定の一元管理
│   └── visualizer.js             # Three.jsによる3Dビジュアライゼーション
├── package.json
├── .env
├── .env.example
├── CLAUDE.md                     # Claude Code用開発ドキュメント
└── README.md                     # ユーザー向けドキュメント（このファイル）
```

## ライセンス

MIT
