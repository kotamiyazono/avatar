# Avatar Voice Agent

OpenAI Realtime APIを使用した音声エージェント。音声に反応するフラクタルビジュアライゼーションを備えたシンプルなUIで、AIと自然に会話できます。

## 特徴

- 🎙️ **音声ベースの対話**: テキスト入力不要、音声だけでAIと会話
- 🌊 **リアルタイムビジュアライゼーション**: 音声に反応して動くフラクタルパターン
- ⚡ **低レイテンシー**: OpenAI Realtime APIによる自然な会話体験
- 🎨 **ミニマルデザイン**: 白背景に黒のビジュアライゼーションのみ

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成（または`.env.example`をコピー）して、OpenAI APIキーを設定：

```bash
cp .env.example .env
```

`.env`ファイルを編集：
```
VITE_OPENAI_API_KEY=sk-...
```

**注意**: APIキーは環境変数に設定するか、アプリの設定画面から入力できます。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

## 使い方

1. **設定**: 右上の⚙️ボタンをクリックして、APIキーと音声設定を行います
2. **接続**: 画面下部の「接続」ボタンをクリック
3. **会話**: マイクの使用を許可して、AIと自然に会話できます
4. **切断**: 「切断」ボタンで接続を終了

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
- **Vanilla JavaScript**: フレームワーク不要のシンプルな実装
- **Canvas API**: リアルタイムビジュアライゼーション
- **Web Audio API**: 音声レベルの解析
- **Vite**: 高速な開発環境

## プロジェクト構造

```
avatar/
├── index.html              # メインHTML
├── src/
│   ├── main.js            # アプリケーションロジック・Realtime API統合
│   └── visualizer.js      # オーディオビジュアライゼーション
├── package.json
├── .env.example
└── README.md
```

## ライセンス

MIT
