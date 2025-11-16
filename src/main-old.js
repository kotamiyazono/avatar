import { AudioVisualizer } from './visualizer.js';

/**
 * Avatar Voice Agent
 * OpenAI Realtime APIを使用した音声エージェント
 */
class AvatarApp {
    constructor() {
        this.isConnected = false;
        this.pc = null; // RTCPeerConnection
        this.dc = null; // DataChannel
        this.audioContext = null;
        this.analyser = null;

        // Function callの引数を蓄積するためのバッファ
        this.functionCallBuffer = {};

        // 設定の読み込み
        this.settings = {
            apiKey: localStorage.getItem('openai_api_key') || '',
            voice: localStorage.getItem('voice') || 'alloy',
            instructions: localStorage.getItem('instructions') || 'You are a friendly assistant.',
            theme: localStorage.getItem('theme') || 'system',
            visualization: localStorage.getItem('visualization') || 'both', // both, sphere, ring
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
        this.apiKeyInput = document.getElementById('api-key');
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
        this.apiKeyInput.value = this.settings.apiKey;
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
        this.settings.apiKey = this.apiKeyInput.value;
        this.settings.voice = this.voiceSelect.value;
        this.settings.instructions = this.instructionsInput.value;
        this.settings.theme = this.themeSelect.value;

        // ビジュアライゼーションのラジオボタンから値を取得
        const vizRadio = document.querySelector('input[name="visualization"]:checked');
        this.settings.visualization = vizRadio ? vizRadio.value : 'both';

        localStorage.setItem('openai_api_key', this.settings.apiKey);
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
        if (!this.settings.apiKey) {
            this.showStatus('Please set API key', 3000);
            this.openSettings();
            return;
        }

        try {
            this.connectBtn.disabled = true;
            this.showStatus('Connecting...');

            // 先にisConnectedをtrueにする（音声解析を開始するため）
            this.isConnected = true;

            // エフェメラルキーの取得
            const ephemeralKey = await this.getEphemeralKey();

            // WebRTC接続の確立
            await this.setupWebRTC(ephemeralKey);

            this.connectBtn.textContent = 'Disconnect';
            this.connectBtn.classList.add('connected');
            this.connectBtn.disabled = false;
            this.showStatus('Connected');

        } catch (error) {
            console.error('Connection error:', error);
            this.isConnected = false;
            this.showStatus('Connection failed: ' + error.message, 4000);
            this.connectBtn.disabled = false;
        }
    }

    async disconnect() {
        if (this.dc) {
            this.dc.close();
            this.dc = null;
        }

        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        this.isConnected = false;
        this.connectBtn.textContent = 'Connect';
        this.connectBtn.classList.remove('connected');
        this.showStatus('Disconnected');
    }

    async getEphemeralKey() {
        const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.settings.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session: {
                    type: 'realtime',
                    model: 'gpt-realtime',
                    audio: {
                        output: { voice: this.settings.voice },
                    },
                    instructions: this.settings.instructions,
                    // Note: turn_detection is not supported in WebRTC ephemeral key creation
                    // WebRTC uses default server VAD settings
                    tools: [
                        {
                            type: 'function',
                            name: 'web_search',
                            description: 'Search the web for current information. Use this when you need up-to-date information or facts that are not in your training data.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: {
                                        type: 'string',
                                        description: 'The search query to look up on the web'
                                    }
                                },
                                required: ['query']
                            }
                        }
                    ],
                    tool_choice: 'auto'
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to get ephemeral key');
        }

        const data = await response.json();
        return data.value;
    }

    async setupWebRTC(ephemeralKey) {
        // RTCPeerConnectionの作成
        this.pc = new RTCPeerConnection();

        // マイクの取得（先に）
        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.pc.addTrack(ms.getTracks()[0]);

        // マイク入力を解析（確実に動作する）
        this.setupMicrophoneAnalyzer(ms);

        // AI音声を直接解析
        this.pc.ontrack = (e) => {
            console.log('Received remote track');
            // ストリームから直接解析
            this.setupOutputAnalyzer(e.streams[0]);

            // 音声も再生
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.srcObject = e.streams[0];
            document.body.appendChild(audioEl);
        };

        // DataChannelの作成
        this.dc = this.pc.createDataChannel('oai-events');
        this.setupDataChannel();

        // SDPの交換
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        const baseUrl = 'https://api.openai.com/v1/realtime/calls';
        const sdpResponse = await fetch(baseUrl, {
            method: 'POST',
            body: offer.sdp,
            headers: {
                'Authorization': `Bearer ${ephemeralKey}`,
                'Content-Type': 'application/sdp',
            },
        });

        if (!sdpResponse.ok) {
            throw new Error('SDP exchange failed');
        }

        const sdp = await sdpResponse.text();
        const answer = { type: 'answer', sdp };
        await this.pc.setRemoteDescription(answer);
    }

    async performWebSearch(query) {
        try {
            // Simple web search using DuckDuckGo Instant Answer API
            const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
            const data = await response.json();

            let result = '';
            if (data.Abstract) {
                result = data.Abstract;
            } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                result = data.RelatedTopics.slice(0, 3).map(topic => topic.Text || '').filter(t => t).join('\n');
            } else {
                result = 'No specific results found. Try rephrasing the query.';
            }

            return result || 'No information found.';
        } catch (error) {
            console.error('Web search error:', error);
            return 'Failed to perform web search.';
        }
    }

    setupDataChannel() {
        this.dc.addEventListener('open', () => {
            console.log('DataChannel opened');
            // Note: turn_detection configuration is not supported in WebRTC session.update
            // Using default server VAD settings
        });

        this.dc.addEventListener('message', (e) => {
            const event = JSON.parse(e.data);
            this.handleRealtimeEvent(event);
        });

        this.dc.addEventListener('error', (e) => {
            console.error('DataChannel error:', e);
        });

        this.dc.addEventListener('close', () => {
            console.log('DataChannel closed');
        });
    }

    setupMicrophoneAnalyzer(stream) {
        // マイク入力の解析
        this.audioContext = new AudioContext();
        this.micAnalyser = this.audioContext.createAnalyser();
        this.micAnalyser.fftSize = 1024;
        this.micAnalyser.smoothingTimeConstant = 0.5;
        this.micAnalyser.minDecibels = -90;
        this.micAnalyser.maxDecibels = -10;

        const micSource = this.audioContext.createMediaStreamSource(stream);
        micSource.connect(this.micAnalyser);

        const bufferLength = this.micAnalyser.frequencyBinCount;
        const micData = new Uint8Array(bufferLength);
        const outputData = new Uint8Array(bufferLength);
        const mergedData = new Uint8Array(bufferLength);

        const updateVisualization = () => {
            if (!this.isConnected) return;

            // マイクの周波数データを取得
            this.micAnalyser.getByteFrequencyData(micData);

            // AI出力の周波数データを取得（セットアップされている場合）
            if (this.outputAnalyser) {
                this.outputAnalyser.getByteFrequencyData(outputData);
            }

            // 平均音量を計算してどちらが話しているか判定
            const micAvg = micData.reduce((a, b) => a + b) / bufferLength;
            const outputAvg = outputData.reduce((a, b) => a + b) / bufferLength;

            // どちらが大きいかで色を変更
            if (micAvg > outputAvg && micAvg > 10) {
                // ユーザーが話している（赤）
                this.visualizer.setColor(false);
            } else if (outputAvg > 10) {
                // AIが話している（青）
                this.visualizer.setColor(true);
            }

            // 両方のデータをマージ（最大値を取る）
            for (let i = 0; i < bufferLength; i++) {
                mergedData[i] = Math.max(micData[i], outputData[i]);
            }

            // ビジュアライザーに渡す
            this.visualizer.updateAudioData(mergedData);

            requestAnimationFrame(updateVisualization);
        };

        updateVisualization();
        console.log('Microphone analyzer initialized');
    }

    setupOutputAnalyzer(stream) {
        try {
            // MediaStreamから音声を解析
            this.outputAnalyser = this.audioContext.createAnalyser();
            this.outputAnalyser.fftSize = 1024;
            this.outputAnalyser.smoothingTimeConstant = 0.5;
            this.outputAnalyser.minDecibels = -90;
            this.outputAnalyser.maxDecibels = -10;

            const outputSource = this.audioContext.createMediaStreamSource(stream);

            // アナライザーに接続
            outputSource.connect(this.outputAnalyser);

            console.log('Output analyzer setup - AI speech will be visualized!');
        } catch (error) {
            console.error('Failed to setup output analyzer:', error);
        }
    }

    async handleRealtimeEvent(event) {
        console.log('Realtime event:', event.type);

        switch (event.type) {
            case 'session.created':
                console.log('Session created:', event);
                break;
            case 'session.updated':
                console.log('Session updated:', event);
                break;
            case 'response.output_item.added':
                // Function callアイテムが追加された時
                if (event.item?.type === 'function_call') {
                    console.log('Function call item added:', event.item);
                    // バッファを初期化
                    const callId = event.item.call_id;
                    this.functionCallBuffer[callId] = {
                        call_id: callId,
                        name: event.item.name,
                        arguments: ''
                    };
                }
                break;
            case 'response.function_call_arguments.delta':
                // Function callの引数が段階的に送られてくる
                if (event.call_id && this.functionCallBuffer[event.call_id]) {
                    this.functionCallBuffer[event.call_id].arguments += event.delta;
                }
                break;
            case 'response.function_call_arguments.done':
                // Function callの引数が完全に受信された時
                const bufferedCall = this.functionCallBuffer[event.call_id];
                if (bufferedCall) {
                    await this.handleFunctionCall(bufferedCall);
                    // バッファをクリア
                    delete this.functionCallBuffer[event.call_id];
                }
                break;
            case 'response.output_item.done':
                // Function callアイテムが完了した時
                if (event.item?.type === 'function_call') {
                    console.log('Function call item done:', event.item);
                }
                break;
            case 'response.done':
                console.log('Response done:', event);
                break;
            case 'error':
                console.error('Realtime error:', event);
                this.showStatus('Error: ' + event.error?.message, 4000);
                break;
        }
    }

    async handleFunctionCall(item) {
        const { call_id, name, arguments: args } = item;

        if (name === 'web_search') {
            let parsedArgs;
            try {
                // argsが文字列の場合のみパース
                if (typeof args === 'string') {
                    parsedArgs = JSON.parse(args.trim());
                } else {
                    parsedArgs = args;
                }
            } catch (error) {
                console.error('Failed to parse function arguments:', error);
                this.showStatus('Error parsing function arguments', 3000);
                return;
            }

            const query = parsedArgs.query;
            if (!query) {
                this.showStatus('No search query provided', 3000);
                return;
            }

            this.showStatus(`Searching: ${query}`, 3000);

            // Web検索を実行
            const searchResult = await this.performWebSearch(query);

            // Function call outputをconversationに追加
            const outputItem = {
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: call_id,
                    output: searchResult
                }
            };

            if (this.dc && this.dc.readyState === 'open') {
                this.dc.send(JSON.stringify(outputItem));

                // Outputを送った後、新しいレスポンスを作成
                setTimeout(() => {
                    if (this.dc && this.dc.readyState === 'open') {
                        const createResponse = {
                            type: 'response.create'
                        };
                        this.dc.send(JSON.stringify(createResponse));
                    }
                }, 100);
            }
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

        // body要素の背景色を変更
        if (actualTheme === 'dark') {
            document.body.style.backgroundColor = '#000000';
        } else {
            document.body.style.backgroundColor = '#ffffff';
        }
    }

    applyVisualization(type) {
        const showSphere = type === 'both' || type === 'sphere';
        const showRing = type === 'both' || type === 'ring';
        this.visualizer.setVisualizationElements(showSphere, showRing);
    }
}

// アプリケーションの初期化
const app = new AvatarApp();
