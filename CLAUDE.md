# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Avatar Voice Agentは、OpenAI Realtime APIを使用した音声ベースのAIエージェントです。音声に反応するフラクタルビジュアライゼーションを備え、テキスト入力なしで自然な会話が可能です。

## Development Commands

```bash
# 依存関係のインストール
npm install

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
   - OpenAI Realtime APIとの接続管理（WebRTC）
   - 設定の保存・読み込み（localStorage）
   - UI制御とイベントハンドリング
   - Web Audio APIによる音声レベル解析

2. **AudioVisualizer (src/visualizer.js)**
   - Canvas APIを使用したビジュアライゼーション
   - 音声レベルに応じて変化するフラクタルパターン
   - リアルタイムアニメーション

### OpenAI Realtime API Integration

https://platform.openai.com/docs/guides/realtime

接続フロー:
1. エフェメラルキーの取得（`POST /v1/realtime/client_secrets`）
2. RTCPeerConnectionの確立
3. マイク入力の取得とトラック追加
4. DataChannelでイベント通信
5. SDPオファー/アンサー交換（`POST /v1/realtime/calls`）

重要なポイント:
- モデル: `gpt-4o-realtime-preview-2024-12-17`
- セッションタイプ: `realtime`
- WebRTC経由で低レイテンシー通信
- DataChannelでイベントベースの制御

### Audio Visualization

音声ビジュアライゼーションの仕組み:
- Web Audio APIの`AnalyserNode`で周波数データを取得
- 平均音量を0-1の範囲に正規化
- Canvas上にフラクタル円形パターンを描画
- 音声レベルに応じて円のサイズ・不透明度が変化
- 時間ベースの回転アニメーション

## Configuration

設定は`localStorage`に保存:
- `openai_api_key`: OpenAI APIキー
- `voice`: 音声の種類（alloy, echo, shimmer, ash, ballad, coral, sage, verse）
- `instructions`: システムプロンプト

## Key Files

- **index.html**: UI構造とスタイル
- **src/main.js**: アプリケーションロジックとRealtime API統合
- **src/visualizer.js**: オーディオビジュアライゼーション
- **package.json**: 依存関係とスクリプト

## Environment Variables

開発時に`.env`ファイルでAPIキーを設定可能:
```
VITE_OPENAI_API_KEY=sk-...
```

注: UIの設定画面からもAPIキーを入力可能（localStorage保存）

## Browser Requirements

- WebRTC対応
- Web Audio API対応
- Canvas API対応
- マイクアクセス許可が必要
