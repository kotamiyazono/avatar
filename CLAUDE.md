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
   - 設定の保存・読み込み（localStorage）
   - UI制御とイベントハンドリング
   - Web Audio APIによる音声レベル解析
   - DuckDuckGo検索ツールの統合

2. **AudioVisualizer (src/visualizer.js)**
   - Three.jsを使用した3Dビジュアライゼーション
   - 音声レベルに応じて変化する球体（ワイヤーフレーム）とリング
   - リアルタイムアニメーション（3軸回転、脈動効果）
   - 3つの状態で色が変化：AI話中（青）、ユーザー話中（ピンク）、待機中（グレー）

3. **Server (server.js)**
   - Expressサーバー（ポート3002）
   - エフェメラルキー生成エンドポイント（/token）
   - OpenAI APIキーの安全な管理

### OpenAI Realtime API Integration

https://platform.openai.com/docs/guides/realtime

接続フロー:
1. サーバー（`/token`）からエフェメラルキーを取得
2. `@openai/agents/realtime`を使用してRealtimeAgentとRealtimeSessionを作成
3. OpenAIRealtimeWebRTCトランスポートでWebRTC接続を確立
4. セッションに接続してAIエージェントとの通信を開始

重要なポイント:
- モデル: `gpt-realtime`
- セッションタイプ: `realtime`
- WebRTC経由で低レイテンシー通信
- @openai/agents SDKを使用した高レベルAPI
- エフェメラルキーはサーバーサイドで生成（セキュリティ）

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

## Key Files

- **index.html**: UI構造とスタイル（CSS変数でテーマ管理）
- **src/main.js**: アプリケーションロジックとRealtime API統合
- **src/visualizer.js**: Three.jsを使用した3Dビジュアライゼーション
- **server.js**: エフェメラルキー生成サーバー
- **package.json**: 依存関係とスクリプト

## Environment Variables

サーバー側の`.env`ファイルでAPIキーを設定:
```
OPENAI_API_KEY=sk-...
```

**重要**: APIキーはサーバーサイドで管理され、クライアント側には公開されません。エフェメラルキーのみがクライアントに送信されます。

## Browser Requirements

- WebRTC対応
- Web Audio API対応
- Canvas API対応
- マイクアクセス許可が必要
