import { AudioVisualizer } from './visualizer.js';
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime';
import { z } from 'zod';
import { API_CONFIG } from './config.js';

// 定数定義
const PRICING = {
    'gpt-realtime': { input: 32.00, output: 64.00 },
    'gpt-realtime-mini': { input: 10.00, output: 20.00 }
};
const TOKENS_PER_MILLION = 1000000;
const POLLING_INTERVAL_MS = 5000;

// Web検索ツールの定義
const webSearchTool = tool({
    name: 'web_search',
    description: 'Search the web for current information. Use this when you need up-to-date information, current events, weather, news, or facts that are not in your training data.',
    parameters: z.object({
        query: z.string().describe('The search query to look up on the web')
    }),
    async execute({ query }) {
        console.log('🔍 Executing web search:', query);
        try {
            // サーバー経由で検索を実行（CORS回避とより良い結果のため）
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                throw new Error('Search request failed');
            }

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                console.log('⚠️ No results found');
                return data.message || 'No results found. Try rephrasing your query.';
            }

            // 結果を整形
            const formattedResults = data.results.map((result, index) => {
                return `${index + 1}. ${result.title}\n   ${result.snippet}`;
            }).join('\n\n');

            console.log('✅ Found', data.results.length, 'results');
            return `Search results for "${query}":\n\n${formattedResults}`;

        } catch (error) {
            console.error('❌ Web search error:', error);
            return 'Failed to perform web search. Please try again.';
        }
    }
});

/**
 * Avatar Voice Agent
 * @openai/agents を使用した実装
 */
class AvatarApp {
    constructor() {
        this.isConnected = false;
        this.agent = null;
        this.session = null;
        this.audioContext = null;
        this.aiAnalyser = null;
        this.micAnalyser = null;
        this.micStream = null;
        this.isSpeaking = false; // AIが話しているかどうか

        // 設定の読み込み
        this.settings = {
            voice: localStorage.getItem('voice') || 'alloy',
            instructions: localStorage.getItem('instructions') || 'You are a friendly assistant.',
            theme: localStorage.getItem('theme') || 'system',
            visualization: localStorage.getItem('visualization') || 'sphere',
            model: localStorage.getItem('model') || 'gpt-realtime-mini',
        };

        // トークン数の追跡
        this.tokenUsage = {
            inputTokens: 0,
            outputTokens: 0
        };

        // システムのダークモード検出
        this.darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.darkModeQuery.addEventListener('change', () => {
            if (this.settings.theme === 'system') {
                this.applyTheme('system');
            }
        });

        this.initUI();
        this.initVisualizer();
        // テーマを先に適用してから visualizer を start
        this.applyTheme(this.settings.theme);
        this.applyVisualization(this.settings.visualization);
        this.visualizer.start();

        // 初期表示
        this.updateSessionInfo();
    }

    initUI() {
        // ボタン要素
        this.connectBtn = document.getElementById('connect-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.saveBtn = document.getElementById('save-btn');
        this.cancelBtn = document.getElementById('cancel-btn');
        this.status = document.getElementById('status');

        // 設定フォーム
        this.voiceSelect = document.getElementById('voice');
        this.instructionsInput = document.getElementById('instructions');
        this.themeSelect = document.getElementById('theme');
        this.visualizationSelect = document.getElementById('visualization-select');
        this.modelSelect = document.getElementById('model-select');

        // セッション情報表示
        this.sessionInfo = document.getElementById('session-info');

        // イベントリスナー
        this.connectBtn.addEventListener('click', () => this.toggleConnection());
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.saveBtn.addEventListener('click', () => this.saveSettings());
        this.cancelBtn.addEventListener('click', () => this.closeSettings());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettings();
        });

        // 初期設定を反映
        this.loadSettingsToForm();
    }

    initVisualizer() {
        const canvas = document.getElementById('visualization');
        this.visualizer = new AudioVisualizer(canvas);
        // start() は applyTheme の後に呼ぶ
    }

    loadSettingsToForm() {
        this.voiceSelect.value = this.settings.voice;
        this.instructionsInput.value = this.settings.instructions;
        this.themeSelect.value = this.settings.theme;
        this.visualizationSelect.value = this.settings.visualization;
        this.modelSelect.value = this.settings.model;
    }

    openSettings() {
        this.settingsModal.classList.add('active');
    }

    closeSettings() {
        // キャンセル時はフォームを元に戻す
        this.loadSettingsToForm();
        this.settingsModal.classList.remove('active');
    }

    async saveSettings() {
        const oldVoice = this.settings.voice;
        const oldInstructions = this.settings.instructions;

        this.settings.voice = this.voiceSelect.value;
        this.settings.instructions = this.instructionsInput.value;
        this.settings.theme = this.themeSelect.value;
        this.settings.visualization = this.visualizationSelect.value;
        this.settings.model = this.modelSelect.value;

        localStorage.setItem('voice', this.settings.voice);
        localStorage.setItem('instructions', this.settings.instructions);
        localStorage.setItem('theme', this.settings.theme);
        localStorage.setItem('visualization', this.settings.visualization);
        localStorage.setItem('model', this.settings.model);

        // パスワードが変更された場合は認証状態をリセット
        if (window.authManager) {
            window.authManager.checkPasswordAndClearIfChanged();
        }

        this.applyTheme(this.settings.theme);
        this.applyVisualization(this.settings.visualization);
        this.updateSessionInfo();

        // セッション中にvoiceまたはmodelが変更された場合、再接続が必要
        if (this.isConnected) {
            const voiceChanged = oldVoice !== this.settings.voice;
            const instructionsChanged = oldInstructions !== this.settings.instructions;

            if (voiceChanged) {
                this.showStatus('Voice changed. Reconnect to apply', 4000);
            } else if (instructionsChanged) {
                // Instructionsのみの変更なら即座に反映を試みる
                if (this.session) {
                    try {
                        await this.session.update({
                            instructions: this.settings.instructions
                        });
                        console.log('✅ Instructions updated');
                        this.showStatus('Instructions updated');
                    } catch (error) {
                        console.error('❌ Failed to update instructions:', error);
                    }
                }
            }
        }

        this.closeSettings();
        if (!this.isConnected || oldVoice === this.settings.voice) {
            this.showStatus('Settings saved');
        }
    }

    showStatus(message, duration = 2000) {
        this.status.textContent = message;
        this.status.classList.add('visible');
        setTimeout(() => {
            this.status.classList.remove('visible');
        }, duration);
    }

    async toggleConnection() {
        if (this.isConnected) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        try {
            // パスワード認証チェック
            if (!window.authManager) {
                this.showStatus('Authentication system not ready', 3000);
                return;
            }

            if (!window.authManager.isAuthenticated()) {
                const result = await window.authManager.authenticate();
                if (!result.success) {
                    // エラータイプに応じたメッセージを表示
                    const errorMessages = {
                        'empty_password': 'Please enter password in Settings first',
                        'invalid_password': 'Invalid password. Please check Settings',
                        'network_error': 'Network error. Please check server connection',
                        'system_error': 'Authentication system error'
                    };
                    const message = errorMessages[result.error] || 'Authentication failed';
                    this.showStatus(message, 3000);
                    return;
                }
            }

            this.connectBtn.disabled = true;
            this.showStatus('Connecting...');

            // RealtimeAgentの作成
            this.agent = new RealtimeAgent({
                name: 'Assistant',
                instructions: this.settings.instructions,
                tools: [webSearchTool]
            });

            // AudioContextの初期化
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // カスタムaudioElementを作成
            this.audioElement = document.createElement('audio');
            this.audioElement.autoplay = true;

            // RealtimeSessionの作成（カスタムトランスポートを使用）
            const { OpenAIRealtimeWebRTC } = await import('@openai/agents/realtime');
            const transport = new OpenAIRealtimeWebRTC({
                audioElement: this.audioElement
            });

            this.session = new RealtimeSession(this.agent, {
                model: this.settings.model,
                transport: transport,
                config: {
                    audio: {
                        output: { voice: this.settings.voice }
                    }
                }
            });

            // サーバーからエフェメラルキーを取得
            this.showStatus('Generating token...');
            const tokenResponse = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOKEN}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    voice: this.settings.voice,
                    instructions: this.settings.instructions,
                    model: this.settings.model
                })
            });

            if (!tokenResponse.ok) {
                throw new Error('Failed to generate ephemeral token');
            }

            const tokenData = await tokenResponse.json();
            const ephemeralKey = tokenData.value;

            // イベントリスナーを接続前に設定
            this.setupSessionEvents();

            // エフェメラルキーで接続
            await this.session.connect({
                apiKey: ephemeralKey
            });

            this.isConnected = true;
            this.connectBtn.textContent = 'Disconnect';
            this.connectBtn.classList.add('connected');
            this.connectBtn.disabled = false;
            this.showStatus('Connected');

            // トークン数をリセットして表示
            this.tokenUsage.inputTokens = 0;
            this.tokenUsage.outputTokens = 0;
            this.updateSessionInfo();

            // トークン使用量のポーリングを開始
            this.startTokenUsagePolling();

            // AI音声出力の解析を設定（ループを避けるため、出力のみ）
            await this.setupAudioVisualization();

        } catch (error) {
            console.error('Connection error:', error);
            this.showStatus('Connection failed: ' + error.message, 4000);
            this.connectBtn.disabled = false;
        }
    }

    setupSessionEvents() {
        // 注: 音声の色変更は音量ベースの検出を使用（startAudioVisualization内）

        // ツール実行時のステータス表示
        this.session.on('agent_tool_start', (event) => {
            console.log('🔧 Tool started:', event);
            this.showStatus('Searching...', 5000);
        });

        this.session.on('agent_tool_end', (event) => {
            console.log('✅ Tool completed:', event);
            // ツール完了後にトークン使用量を更新
            this.updateTokenUsageFromSession();
        });

        // 会話アイテムが作成されたときにトークン使用量を更新
        this.session.on('conversation.item.created', () => {
            this.updateTokenUsageFromSession();
        });

        // エラーハンドリング
        this.session.on('error', (error) => {
            console.error('❌ Session error:', error);
            this.showStatus('Error: ' + error.message, 4000);
        });

        // 接続状態の監視
        this.session.on('disconnected', () => {
            console.log('🔌 Session disconnected');
            if (this.isConnected) {
                this.isConnected = false;
                this.connectBtn.textContent = 'Connect';
                this.connectBtn.classList.remove('connected');
                this.showStatus('Disconnected');
                this.updateSessionInfo();
            }
        });
    }

    // 音声ビジュアライゼーション設定（AI出力とマイク入力の両方）
    async setupAudioVisualization() {
        try {
            // 1. AI出力用のアナライザー設定
            const aiStream = this.audioElement.captureStream ?
                this.audioElement.captureStream() :
                this.audioElement.mozCaptureStream();

            const aiSource = this.audioContext.createMediaStreamSource(aiStream);
            this.aiAnalyser = this.audioContext.createAnalyser();
            this.aiAnalyser.fftSize = 256;
            aiSource.connect(this.aiAnalyser);

            console.log('✅ AI output analyzer initialized');

            // 2. マイク入力用のアナライザー設定（ビジュアライゼーション専用）
            // WebRTCが既にマイクをセッションに接続しているので、
            // ここで取得するのは表示のためだけ
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const micSource = this.audioContext.createMediaStreamSource(this.micStream);
            this.micAnalyser = this.audioContext.createAnalyser();
            this.micAnalyser.fftSize = 256;
            micSource.connect(this.micAnalyser);
            // 注意: このマイクストリームはスピーカーに接続しない（フィードバック防止）

            console.log('✅ Microphone analyzer initialized (visualization only)');

            // 解析開始
            this.startAudioVisualization();

            console.log('✅ Audio visualizer fully initialized');
        } catch (error) {
            console.error('❌ Audio visualization setup failed:', error);
            // フォールバック: アニメーションのみ
            this.startAudioVisualization();
        }
    }

    startAudioVisualization() {
        const bufferLength = 128;
        const dataArray = new Uint8Array(bufferLength);
        const micData = new Uint8Array(bufferLength);
        const aiData = new Uint8Array(bufferLength);
        let time = 0;

        const updateVisualizer = () => {
            if (!this.isConnected) return;

            time += 0.02;

            // マイク入力データを取得
            let micVolume = 0;
            if (this.micAnalyser) {
                this.micAnalyser.getByteFrequencyData(micData);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += micData[i];
                }
                micVolume = sum / bufferLength;
            }

            // AI出力データを取得
            let aiVolume = 0;
            if (this.aiAnalyser) {
                this.aiAnalyser.getByteFrequencyData(aiData);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += aiData[i];
                }
                aiVolume = sum / bufferLength;
            }

            // 音量に基づいて3状態の色を切り替え（閾値: 10）
            const speakingThreshold = 10;
            const userSpeakingThreshold = 15;

            if (aiVolume > speakingThreshold) {
                // AIが話している - 青色
                if (!this.isSpeaking) {
                    console.log('🎤 AI started speaking (detected by volume)');
                    this.isSpeaking = true;
                }
                this.visualizer.setColor('ai');
            } else if (micVolume > userSpeakingThreshold) {
                // ユーザーが話している - ピンク/レッド
                if (this.isSpeaking) {
                    console.log('✅ AI stopped speaking (detected by volume)');
                    this.isSpeaking = false;
                }
                this.visualizer.setColor('user');
            } else {
                // 両方無音 - グレー（待機中）
                if (this.isSpeaking) {
                    console.log('✅ AI stopped speaking (detected by volume)');
                    this.isSpeaking = false;
                }
                this.visualizer.setColor('idle');
            }

            // 両方のデータを合成（最大値を取る）
            for (let i = 0; i < bufferLength; i++) {
                dataArray[i] = Math.max(micData[i], aiData[i]);
            }

            // 全体の平均音量を計算
            const totalVolume = Math.max(micVolume, aiVolume);

            // どちらも無音の場合はベースラインアニメーション
            if (totalVolume < 5) {
                for (let i = 0; i < bufferLength; i++) {
                    const wave = Math.sin(time * 2 + i * 0.1) * 10;
                    dataArray[i] = Math.max(dataArray[i], 15 + wave);
                }
            }

            this.visualizer.updateAudioData(dataArray);
            requestAnimationFrame(updateVisualizer);
        };

        updateVisualizer();
    }

    async disconnect() {
        try {
            console.log('🔌 Starting disconnect process...');

            // まず接続状態をfalseにして、ビジュアライゼーションループを停止
            this.isConnected = false;
            this.isSpeaking = false;
            this.connectBtn.disabled = true;
            this.showStatus('Disconnecting...');

            // トークン使用量のポーリングを停止
            this.stopTokenUsagePolling();

            // マイクストリームの停止
            if (this.micStream) {
                console.log('🎤 Stopping microphone stream...');
                this.micStream.getTracks().forEach(track => {
                    track.stop();
                    console.log('✅ Microphone track stopped');
                });
                this.micStream = null;
            }

            // セッションのクリーンアップ
            if (this.session) {
                try {
                    console.log('📞 Disconnecting session...');
                    // session.disconnect() ではなく session.close() を試す
                    if (typeof this.session.close === 'function') {
                        await this.session.close();
                    } else if (typeof this.session.disconnect === 'function') {
                        await this.session.disconnect();
                    } else {
                        console.log('⚠️ No disconnect/close method found on session');
                    }
                    console.log('✅ Session disconnected');
                } catch (e) {
                    console.warn('⚠️ Session disconnect warning:', e);
                }
                this.session = null;
            }

            // オーディオ要素の停止
            if (this.audioElement) {
                console.log('🔊 Stopping audio element...');
                this.audioElement.pause();
                this.audioElement.srcObject = null;
                this.audioElement = null;
            }

            // AudioContextのクリーンアップ
            if (this.audioContext) {
                try {
                    console.log('🎵 Closing AudioContext...');
                    if (this.audioContext.state !== 'closed') {
                        await this.audioContext.close();
                        console.log('✅ AudioContext closed');
                    }
                } catch (e) {
                    console.warn('⚠️ AudioContext close warning:', e);
                }
                this.audioContext = null;
            }

            // その他のクリーンアップ
            this.agent = null;
            this.aiAnalyser = null;
            this.micAnalyser = null;

            // UI更新
            this.connectBtn.textContent = 'Connect';
            this.connectBtn.classList.remove('connected');
            this.connectBtn.disabled = false;
            this.showStatus('Disconnected');

            // ビジュアライザーを元の色に戻す
            this.visualizer.setColor(false);

            console.log('✅ Disconnect completed');
        } catch (error) {
            console.error('❌ Disconnect error:', error);
            this.showStatus('Disconnect failed: ' + error.message, 3000);
            this.connectBtn.disabled = false;
        }
    }

    applyTheme(theme) {
        let actualTheme = theme;

        // システムテーマの場合、実際のテーマを判定
        if (theme === 'system') {
            actualTheme = this.darkModeQuery.matches ? 'dark' : 'light';
        }

        // ビジュアライザーにテーマを適用
        this.visualizer.setTheme(actualTheme);

        // 常にdata-theme属性を設定（システムテーマの場合も判定結果を適用）
        document.documentElement.setAttribute('data-theme', actualTheme);
    }

    applyVisualization(type) {
        const showSphere = type === 'sphere';
        const showRing = type === 'ring';
        const showGrid = type === 'grid';
        this.visualizer.setVisualizationElements(showSphere, showRing, showGrid);
    }

    updateTokenUsageFromSession() {
        if (!this.session || !this.isConnected) return;

        try {
            // RealtimeSession.usageプロパティから直接トークン使用量を取得
            const usage = this.session.usage;

            if (usage) {
                console.log('📊 Session usage:', usage);

                // 使用量を設定（累積ではなく現在の値）
                this.tokenUsage.inputTokens = usage.input_tokens || usage.inputTokens || 0;
                this.tokenUsage.outputTokens = usage.output_tokens || usage.outputTokens || 0;

                this.updateSessionInfo();
            }
        } catch (error) {
            console.error('❌ Error getting usage from session:', error);
        }
    }

    startTokenUsagePolling() {
        // 定期的にトークン使用量を更新
        this.tokenUsageInterval = setInterval(() => {
            this.updateTokenUsageFromSession();
        }, POLLING_INTERVAL_MS);
    }

    stopTokenUsagePolling() {
        if (this.tokenUsageInterval) {
            clearInterval(this.tokenUsageInterval);
            this.tokenUsageInterval = null;
        }
    }

    /**
     * トークン使用量から料金を計算
     * @param {number} inputTokens - 入力トークン数
     * @param {number} outputTokens - 出力トークン数
     * @param {string} model - モデル名
     * @returns {number} 料金（USD）
     */
    calculateCost(inputTokens, outputTokens, model) {
        const rates = PRICING[model];
        if (!rates) {
            console.warn(`Unknown model: ${model}`);
            return 0;
        }
        return (inputTokens * rates.input / TOKENS_PER_MILLION) +
               (outputTokens * rates.output / TOKENS_PER_MILLION);
    }

    updateSessionInfo() {
        const voiceName = this.settings.voice.charAt(0).toUpperCase() + this.settings.voice.slice(1);
        const modelName = this.settings.model;

        if (!this.isConnected) {
            this.sessionInfo.innerHTML =
                `<strong>${voiceName}</strong><br>` +
                `Model: ${modelName}<br>` +
                `0 tokens (in: 0 / out: 0)<br>` +
                `$0.00`;
            return;
        }

        const totalTokens = this.tokenUsage.inputTokens + this.tokenUsage.outputTokens;
        const cost = this.calculateCost(
            this.tokenUsage.inputTokens,
            this.tokenUsage.outputTokens,
            this.settings.model
        );

        this.sessionInfo.innerHTML =
            `<strong>${voiceName}</strong><br>` +
            `Model: ${modelName}<br>` +
            `${totalTokens.toLocaleString()} tokens (in: ${this.tokenUsage.inputTokens.toLocaleString()} / out: ${this.tokenUsage.outputTokens.toLocaleString()})<br>` +
            `$${cost.toFixed(4)}`;
    }
}

// アプリケーションの初期化
const app = new AvatarApp();
