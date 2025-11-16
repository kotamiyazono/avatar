# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Avatar Voice Agentは、OpenAI Realtime APIを使用した音声ベースのAIエージェントです。音声に反応する3Dビジュアライゼーション（Three.js）を備え、テキスト入力なしで自然な会話が可能です。

## Development Commands

```bash
# 依存関係のインストール
npm install

# バックエンドサーバーの起動（ポート3002）
npm run server

# 開発サーバーの起動（http://localhost:5173）
npm run dev

# 本番ビルド
npm run build

# ビルドのプレビュー
npm run preview
```

## Architecture

### Core Components

1. **AvatarApp (src/main.js)**
   - アプリケーションの中核クラス
   - OpenAI Realtime APIとの接続管理（WebRTC、@openai/agents SDK使用）
   - パスワード認証による接続制御
   - 設定の保存・読み込み（localStorage）
   - UI制御とイベントハンドリング
   - Web Audio APIによる音声レベル解析
   - Tavily AI Search API統合による検索ツール
   - リアルタイムのトークン使用量追跡とコスト計算
   - セッション情報表示（Voice名、Model、Tokens、Cost）

2. **AuthManager (src/auth.js)**
   - SHA-256ハッシュによるパスワード認証システム
   - sessionStorageで認証状態を管理
   - サーバー側の認証エンドポイント（/auth）と連携
   - エラータイプ別の詳細なエラーハンドリング
   - パスワード変更時の自動認証リセット

3. **AudioVisualizer (src/visualizer.js)**
   - Three.jsを使用した3Dビジュアライゼーション
   - 音声レベルに応じて変化する球体（ワイヤーフレーム）とリング
   - リアルタイムアニメーション（3軸回転、脈動効果）
   - 3つの状態で色が変化：AI話中（青）、ユーザー話中（ピンク）、待機中（グレー）

4. **Server (server.js)**
   - Expressサーバー（ポート3002）
   - エフェメラルキー生成エンドポイント（/token）
   - パスワード認証エンドポイント（/auth）
   - Web検索プロキシエンドポイント（/search）- Tavily API経由
   - OpenAI・Tavily APIキー、パスワードハッシュの安全な管理

5. **Config (src/config.js)**
   - API設定の一元管理
   - サーバーURLとエンドポイントパスの定義

### Authentication System

パスワード認証の仕組み:
- クライアント側でパスワードをSHA-256でハッシュ化
- ハッシュ化されたパスワードをサーバーの `/auth` エンドポイントに送信
- サーバー側で環境変数 `PASSWORD_HASH` と照合
- 認証成功時は `sessionStorage` に状態を保存
- 接続時に認証チェック、未認証なら自動的に認証プロセスを開始
- パスワード変更検出時は自動的に認証状態をリセット

パスワードハッシュの生成:
```bash
node generate-password-hash.js
```

### OpenAI Realtime API Integration

https://platform.openai.com/docs/guides/realtime

接続フロー:
1. パスワード認証をチェック（未認証なら認証プロセス開始）
2. サーバー（`/token`）からエフェメラルキーを取得
3. `@openai/agents/realtime`を使用してRealtimeAgentとRealtimeSessionを作成
4. OpenAIRealtimeWebRTCトランスポートでWebRTC接続を確立
5. セッションに接続してAIエージェントとの通信を開始

重要なポイント:
- モデル: `gpt-realtime`
- セッションタイプ: `realtime`
- WebRTC経由で低レイテンシー通信
- @openai/agents SDKを使用した高レベルAPI
- エフェメラルキーはサーバーサイドで生成（セキュリティ）
- Voice変更はセッション中に適用不可（再接続が必要）
- Instructions変更はセッション中に `session.update()` で即座に反映可能

### Audio Visualization

音声ビジュアライゼーションの仕組み:
- Web Audio APIの`AnalyserNode`で周波数データを取得（AI出力とマイク入力の2つ）
- 音量ベースで3つの状態を検出：AI話中、ユーザー話中、待機中
- Three.jsで3Dシーンをレンダリング
  - 球体：IcosahedronGeometry（ワイヤーフレーム）
  - リング：128本の3Dバーを円形配置
- 音声レベルに応じて変化：
  - スケール、回転、色、発光強度
  - 3軸回転と脈動効果
- ビジュアライゼーションタイプを選択可能（球体 or リング）

## Configuration

設定は`localStorage`に保存:
- `voice`: 音声の種類（alloy, echo, shimmer, ash, ballad, coral, sage, verse）
- `instructions`: システムプロンプト（AIへの指示）
- `theme`: テーマ設定（light, dark, system）
- `visualization`: ビジュアライゼーションタイプ（sphere, ring）
- `model`: 使用モデル（gpt-realtime）
- `password`: パスワード（SHA-256ハッシュ化前の値）

認証状態は`sessionStorage`に保存:
- `authenticated`: 認証済みフラグ（boolean）
- `lastPasswordHash`: 最後に認証したパスワードのハッシュ

## UI Features

### Session Info Display（左上）
Voice名を白文字で表示し、その下にModel、Tokens、Costを表示:
```
Ash          ← 白文字（プライマリカラー）
Model: gpt-realtime    ← グレー（セカンダリカラー）
1,234 tokens (in: 567 / out: 667)    ← グレー
$0.0123      ← グレー
```

### Settings Modal
- Password: 接続時の認証に使用
- Voice: 音声の種類（変更時は再接続が必要）
- Model: 使用するモデル
- Instructions: システムプロンプト（セッション中に変更可能）
- Theme: ライト/ダーク/システム
- Visualization: Sphere/Ring

## Key Files

- **index.html**: UI構造とスタイル（CSS変数でテーマ管理）
- **src/main.js**: アプリケーションロジックとRealtime API統合
- **src/auth.js**: パスワード認証システム
- **src/config.js**: API設定の一元管理
- **src/visualizer.js**: Three.jsを使用した3Dビジュアライゼーション
- **server.js**: エフェメラルキー生成・認証・検索プロキシサーバー
- **generate-password-hash.js**: パスワードハッシュ生成ユーティリティ
- **package.json**: 依存関係とスクリプト

## Environment Variables

サーバー側の`.env`ファイルで設定:
```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
PASSWORD_HASH=<SHA-256ハッシュ>
```

パスワードハッシュの生成方法:
```bash
node generate-password-hash.js
# プロンプトに従ってパスワードを入力
# 出力されたハッシュを .env の PASSWORD_HASH に設定
```

**重要**:
- APIキーとパスワードハッシュはサーバーサイドで管理され、クライアント側には公開されません
- OpenAI: エフェメラルキーのみがクライアントに送信
- Tavily: サーバー経由でプロキシされる（クライアントからは見えない）
- Password: クライアントはハッシュ化した値のみを送信

**Tavily API**:
- AI向けに最適化された検索API
- 無料枠: 月1,000クエリ
- リアルタイム情報（天気、ニュース、最新イベント）に対応
- 信頼できる情報源を優先し、AIが読みやすい要約を自動生成
- 取得: https://tavily.com

## Browser Requirements

- WebRTC対応
- Web Audio API対応
- Canvas API対応
- マイクアクセス許可が必要
