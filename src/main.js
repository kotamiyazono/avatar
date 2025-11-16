import { AudioVisualizer } from './visualizer.js';
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime';
import { z } from 'zod';

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
            // DuckDuckGo Instant Answer APIを使用
            const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
            const data = await response.json();

            let result = '';

            // Abstractがある場合（百科事典的な情報）
            if (data.Abstract && data.Abstract.length > 0) {
                result = `${data.AbstractText}\n\nSource: ${data.AbstractURL}`;
                console.log('✅ Found Abstract:', result);
            }
            // RelatedTopicsがある場合
            else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                const topics = [];
                for (const topic of data.RelatedTopics) {
                    if (topic.Text) {
                        topics.push(topic.Text);
                    } else if (topic.Topics) {
                        // ネストされたトピックも展開
                        for (const subTopic of topic.Topics) {
                            if (subTopic.Text) {
                                topics.push(subTopic.Text);
                            }
                        }
                    }
                }

                if (topics.length > 0) {
                    result = topics.slice(0, 5).join('\n\n');
                    console.log('✅ Found Topics:', topics.length, 'items');
                } else {
                    result = 'No detailed information found for this query.';
                    console.log('⚠️ RelatedTopics empty');
                }
            }
            // Answersがある場合（計算や単位変換など）
            else if (data.Answer && data.Answer.length > 0) {
                result = data.Answer;
                console.log('✅ Found Answer:', result);
            }
            // Definitionがある場合（辞書的な定義）
            else if (data.Definition && data.Definition.length > 0) {
                result = `${data.Definition}\n\nSource: ${data.DefinitionURL || 'DuckDuckGo'}`;
                console.log('✅ Found Definition:', result);
            }
            else {
                result = 'No information found for this query. Try rephrasing or being more specific.';
                console.log('❌ No results found');
                console.log('API Response:', JSON.stringify(data, null, 2));
            }

            return result;
        } catch (error) {
            console.error('❌ Web search error:', error);
            return 'Failed to perform web search due to an error.';
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
        this.applyTheme(this.settings.theme);
        this.applyVisualization(this.settings.visualization);
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
        this.visualizer.start();
    }

    loadSettingsToForm() {
        this.voiceSelect.value = this.settings.voice;
        this.instructionsInput.value = this.settings.instructions;
        this.themeSelect.value = this.settings.theme;

        // ビジュアライゼーションのラジオボタンを設定
        const vizRadio = document.querySelector(`input[name="visualization"][value="${this.settings.visualization}"]`);
        if (vizRadio) vizRadio.checked = true;
    }

    openSettings() {
        this.settingsModal.classList.add('active');
    }

    closeSettings() {
        this.settingsModal.classList.remove('active');
    }

    saveSettings() {
        this.settings.voice = this.voiceSelect.value;
        this.settings.instructions = this.instructionsInput.value;
        this.settings.theme = this.themeSelect.value;

        // ビジュアライゼーションのラジオボタンから値を取得
        const vizRadio = document.querySelector('input[name="visualization"]:checked');
        this.settings.visualization = vizRadio ? vizRadio.value : 'sphere';

        localStorage.setItem('voice', this.settings.voice);
        localStorage.setItem('instructions', this.settings.instructions);
        localStorage.setItem('theme', this.settings.theme);
        localStorage.setItem('visualization', this.settings.visualization);

        this.applyTheme(this.settings.theme);
        this.applyVisualization(this.settings.visualization);

        this.closeSettings();
        this.showStatus('Settings saved');
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
                model: 'gpt-realtime',
                transport: transport,
                config: {
                    audio: {
                        output: { voice: this.settings.voice }
                    }
                }
            });

            // サーバーからエフェメラルキーを取得
            this.showStatus('Generating token...');
            const tokenResponse = await fetch('http://localhost:3002/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    voice: this.settings.voice,
                    instructions: this.settings.instructions
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

            // AI音声出力の解析を設定（ループを避けるため、出力のみ）
            await this.setupAudioVisualization();

        } catch (error) {
            console.error('Connection error:', error);
            this.showStatus('Connection failed: ' + error.message, 4000);
            this.connectBtn.disabled = false;
        }
    }

    setupSessionEvents() {
        // AIが話し始めたとき（複数のイベント名を試す）
        this.session.on('audio_start', (event) => {
            console.log('🎤 AI started speaking (audio_start)', event);
            this.isSpeaking = true;
            this.visualizer.setColor(true); // AI = 青色
        });

        this.session.on('audio_started', (event) => {
            console.log('🎤 AI started speaking (audio_started)', event);
            this.isSpeaking = true;
            this.visualizer.setColor(true); // AI = 青色
        });

        this.session.on('response_audio_start', (event) => {
            console.log('🎤 AI started speaking (response_audio_start)', event);
            this.isSpeaking = true;
            this.visualizer.setColor(true); // AI = 青色
        });

        this.session.on('response.audio_start', (event) => {
            console.log('🎤 AI started speaking (response.audio_start)', event);
            this.isSpeaking = true;
            this.visualizer.setColor(true); // AI = 青色
        });

        // AIが話し終わったとき（元の色に戻す）
        this.session.on('audio_stopped', (event) => {
            console.log('✅ AI stopped speaking', event);
            this.isSpeaking = false;
            this.visualizer.setColor(false); // ユーザー = ピンク/レッド
        });

        // 音声が中断されたとき
        this.session.on('audio_interrupted', (event) => {
            console.log('⚠️ Audio interrupted', event);
            this.isSpeaking = false;
            this.visualizer.setColor(false); // ユーザー = ピンク/レッド
        });

        // レスポンス開始イベント
        this.session.on('response_started', (event) => {
            console.log('📢 Response started', event);
            this.isSpeaking = true;
            this.visualizer.setColor(true); // AI = 青色
        });

        // ツール実行時のステータス表示
        this.session.on('agent_tool_start', (event) => {
            console.log('🔧 Tool started:', event);
            this.showStatus('Searching...', 5000);
        });

        this.session.on('agent_tool_end', (event) => {
            console.log('✅ Tool completed:', event);
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

    startDummyVisualization() {
        const bufferLength = 128;
        const dataArray = new Uint8Array(bufferLength);
        let time = 0;

        const updateVisualizer = () => {
            if (!this.isConnected) return;

            time += 0.05;

            for (let i = 0; i < bufferLength; i++) {
                const wave1 = Math.sin(time * 2 + i * 0.1) * 40;
                const wave2 = Math.sin(time * 3 + i * 0.05) * 30;
                const wave3 = Math.sin(time * 5 + i * 0.2) * 20;
                const noise = Math.random() * 15;
                dataArray[i] = Math.max(0, Math.min(255, 50 + wave1 + wave2 + wave3 + noise));
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

        // HTMLにdata-theme属性を設定してCSS変数を適用
        if (theme === 'system') {
            // システムテーマの場合はdata-theme属性を削除（@media queryに任せる）
            document.documentElement.removeAttribute('data-theme');
        } else {
            // 手動選択の場合はdata-theme属性を設定
            document.documentElement.setAttribute('data-theme', actualTheme);
        }
    }

    applyVisualization(type) {
        const showSphere = type === 'sphere';
        const showRing = type === 'ring';
        this.visualizer.setVisualizationElements(showSphere, showRing);
    }
}

// アプリケーションの初期化
const app = new AvatarApp();
