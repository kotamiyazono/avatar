/**
 * Audio-reactive 3D visualization using Three.js
 * 3D音声ビジュアライゼーション
 */
import * as THREE from 'three';

// 定数定義
const COLORS = {
    AI_DARK: { r: 0, g: 230, b: 255 },
    AI_LIGHT: { r: 0, g: 200, b: 225 },
    USER_DARK: { r: 255, g: 68, b: 120 },
    USER_LIGHT: { r: 230, g: 50, b: 100 },
    IDLE_DARK: { r: 10, g: 10, b: 10 },
    IDLE_LIGHT: { r: 50, g: 50, b: 50 }
};

const LIGHTING = {
    AMBIENT_INTENSITY: 0.5,
    POINT_LIGHT_BASE: 2.0,
    POINT_LIGHT_MULTIPLIER_DARK: 6.0,
    POINT_LIGHT_MULTIPLIER_LIGHT: 5.0
};

const MATERIAL = {
    IDLE_OPACITY: 1.0,
    ACTIVE_OPACITY: 0.4,
    IDLE_EMISSIVE_INTENSITY: 1.5,
    SPHERE_BASE_EMISSIVE: 0.5,
    SPHERE_DYNAMIC_EMISSIVE: 2.5,
    RING_BASE_EMISSIVE: 0.5,
    RING_DYNAMIC_EMISSIVE: 3.0,
    GRID_BASE_INTENSITY_DARK: 0.8,
    GRID_BASE_INTENSITY_LIGHT: 0.2,
    GRID_BASE_OPACITY_DARK: 0.8,
    GRID_BASE_OPACITY_LIGHT: 0.2
};

const ANIMATION = {
    COLOR_LERP_SPEED: 0.1,
    BACKGROUND_LERP_SPEED: 0.05,
    SMOOTHING_FACTOR: 0.7,
    NUM_BARS: 128,
    VOICE_FREQ_MIN: 80,
    VOICE_FREQ_MAX: 8000,
    NYQUIST: 22050
};

export class AudioVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.frequencyData = [];
        this.smoothedFrequencyData = [];
        this.isAnimating = false;
        this.numBars = ANIMATION.NUM_BARS;

        // 色の状態管理
        this.currentColor = { ...COLORS.IDLE_LIGHT };
        this.targetColor = { ...COLORS.IDLE_LIGHT };
        this.currentState = 'idle'; // 'idle', 'ai', 'user'

        // テーマ管理
        this.theme = 'light';
        this.backgroundColor = new THREE.Color(1, 1, 1);
        this.targetBackgroundColor = new THREE.Color(1, 1, 1);

        // ビジュアライゼーション要素の表示設定
        this.showSphere = true;
        this.showRing = true;
        this.showGrid = false;

        this.initThree();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    // ヘルパーメソッド: テーマに応じた待機色を取得
    getIdleColorForTheme(theme) {
        return theme === 'dark' ? { ...COLORS.IDLE_DARK } : { ...COLORS.IDLE_LIGHT };
    }

    // ヘルパーメソッド: テーマに応じた初期色を取得
    getInitialColorHex(theme) {
        return theme === 'dark' ? 0x050505 : 0x787878;
    }

    // ヘルパーメソッド: テーマに応じたグリッドのベース強度を取得
    getGridBaseIntensity(theme) {
        return theme === 'dark' ? MATERIAL.GRID_BASE_INTENSITY_DARK : MATERIAL.GRID_BASE_INTENSITY_LIGHT;
    }

    // ヘルパーメソッド: テーマに応じたグリッドのベース不透明度を取得
    getGridBaseOpacity(theme) {
        return theme === 'dark' ? MATERIAL.GRID_BASE_OPACITY_DARK : MATERIAL.GRID_BASE_OPACITY_LIGHT;
    }

    // ヘルパーメソッド: 共通のPhongMaterial設定を作成
    createPhongMaterial(initialColor, options = {}) {
        return new THREE.MeshPhongMaterial({
            color: initialColor,
            emissive: initialColor,
            emissiveIntensity: options.emissiveIntensity || MATERIAL.IDLE_EMISSIVE_INTENSITY,
            transparent: true,
            opacity: options.opacity || MATERIAL.IDLE_OPACITY,
            wireframe: options.wireframe || false,
            side: options.side || THREE.FrontSide
        });
    }

    initThree() {
        // シーン
        this.scene = new THREE.Scene();

        // カメラ
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 4;

        // レンダラー
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // ライト
        const ambientLight = new THREE.AmbientLight(0xffffff, LIGHTING.AMBIENT_INTENSITY);
        this.scene.add(ambientLight);

        this.pointLight = new THREE.PointLight(0xF0F0F0, LIGHTING.POINT_LIGHT_BASE, 100);
        this.pointLight.position.set(0, 0, 3);
        this.scene.add(this.pointLight);

        // 3Dオブジェクトの作成
        this.createVisualizationObjects();
    }

    createVisualizationObjects() {
        const initialColor = this.getInitialColorHex(this.theme);

        // 中心の球体（ワイヤーフレーム）
        const sphereGeometry = new THREE.IcosahedronGeometry(1, 3);
        this.sphereMaterial = this.createPhongMaterial(initialColor, { wireframe: true });
        this.sphere = new THREE.Mesh(sphereGeometry, this.sphereMaterial);
        this.scene.add(this.sphere);

        // 周囲の3Dバー（リング）
        this.barsGroup = new THREE.Group();
        this.scene.add(this.barsGroup);

        this.bars = [];
        const barGeometry = new THREE.BoxGeometry(0.01, 0.05, 0.01);
        const radius = 1.3;

        for (let i = 0; i < this.numBars; i++) {
            const material = this.createPhongMaterial(initialColor);
            const bar = new THREE.Mesh(barGeometry, material);
            const angle = (i / this.numBars) * Math.PI * 2;

            bar.position.x = Math.cos(angle) * radius;
            bar.position.z = Math.sin(angle) * radius;
            bar.position.y = 0;

            bar.lookAt(0, 0, 0);
            bar.userData.angle = angle;
            bar.userData.radius = radius;

            this.barsGroup.add(bar);
            this.bars.push(bar);
        }

        // グリッドビジュアライゼーション
        this.gridGroup = new THREE.Group();
        this.scene.add(this.gridGroup);
        this.gridSquares = [];

        const aspect = window.innerWidth / window.innerHeight;
        const gridRows = 16;
        const gridCols = Math.ceil(gridRows * aspect);
        const squareSize = 0.5;
        const spacing = 0.52;

        for (let y = 0; y < gridRows; y++) {
            for (let x = 0; x < gridCols; x++) {
                const squareGeometry = new THREE.PlaneGeometry(squareSize, squareSize);
                const material = this.createPhongMaterial(initialColor, {
                    emissiveIntensity: this.getGridBaseIntensity(this.theme),
                    opacity: this.getGridBaseOpacity(this.theme),
                    side: THREE.DoubleSide
                });

                const square = new THREE.Mesh(squareGeometry, material);

                const offsetX = (gridCols - 1) * spacing / 2;
                const offsetY = (gridRows - 1) * spacing / 2;

                square.position.x = x * spacing - offsetX;
                square.position.y = y * spacing - offsetY;
                square.position.z = 0;

                square.userData.originalX = square.position.x;
                square.userData.originalY = square.position.y;
                square.userData.gridIndex = y * gridCols + x;
                square.userData.row = y;
                square.userData.col = x;

                this.gridGroup.add(square);
                this.gridSquares.push(square);
            }
        }

        this.gridRows = gridRows;
        this.gridCols = gridCols;
        this.gridGroup.visible = false;
    }

    setColor(state) {
        // 現在の状態を保存
        if (state === 'ai' || state === true) {
            this.currentState = 'ai';
        } else if (state === 'user') {
            this.currentState = 'user';
        } else {
            this.currentState = 'idle';
        }

        this.updateColorForCurrentState();
    }

    updateColorForCurrentState() {
        if (this.currentState === 'ai') {
            this.targetColor = this.theme === 'dark' ? { ...COLORS.AI_DARK } : { ...COLORS.AI_LIGHT };
        } else if (this.currentState === 'user') {
            this.targetColor = this.theme === 'dark' ? { ...COLORS.USER_DARK } : { ...COLORS.USER_LIGHT };
        } else {
            this.targetColor = this.getIdleColorForTheme(this.theme);
        }
    }

    setTheme(theme) {
        this.theme = theme;
        this.targetBackgroundColor = theme === 'dark'
            ? new THREE.Color(0, 0, 0)
            : new THREE.Color(1, 1, 1);

        const idleColor = this.getIdleColorForTheme(theme);

        if (this.currentState === 'idle') {
            this.currentColor = { ...idleColor };
            this.targetColor = { ...idleColor };
        } else {
            this.updateColorForCurrentState();
        }
    }

    setVisualizationElements(showSphere, showRing, showGrid) {
        this.showSphere = showSphere;
        this.showRing = showRing;
        this.showGrid = showGrid !== undefined ? showGrid : false;

        if (this.sphere) this.sphere.visible = showSphere;
        if (this.barsGroup) this.barsGroup.visible = showRing;
        if (this.gridGroup) this.gridGroup.visible = this.showGrid;
    }

    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    updateAudioData(frequencyData) {
        this.frequencyData = Array.from(frequencyData);

        if (this.smoothedFrequencyData.length === 0) {
            this.smoothedFrequencyData = [...this.frequencyData];
        }
    }

    start() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }

    stop() {
        this.isAnimating = false;
    }

    // データをスムージング
    smoothAudioData() {
        for (let i = 0; i < this.frequencyData.length; i++) {
            this.smoothedFrequencyData[i] =
                this.smoothedFrequencyData[i] * ANIMATION.SMOOTHING_FACTOR +
                this.frequencyData[i] * (1 - ANIMATION.SMOOTHING_FACTOR);
        }
    }

    // 色を滑らかに変化
    updateColors() {
        this.currentColor.r += (this.targetColor.r - this.currentColor.r) * ANIMATION.COLOR_LERP_SPEED;
        this.currentColor.g += (this.targetColor.g - this.currentColor.g) * ANIMATION.COLOR_LERP_SPEED;
        this.currentColor.b += (this.targetColor.b - this.currentColor.b) * ANIMATION.COLOR_LERP_SPEED;

        this.backgroundColor.lerp(this.targetBackgroundColor, ANIMATION.BACKGROUND_LERP_SPEED);
        this.scene.background = this.backgroundColor;

        return new THREE.Color(
            this.currentColor.r / 255,
            this.currentColor.g / 255,
            this.currentColor.b / 255
        );
    }

    // 音声データから周波数バーデータを生成
    generateBarData() {
        const barData = [];
        const dataLength = this.smoothedFrequencyData.length;

        const minBin = Math.max(1, Math.floor((ANIMATION.VOICE_FREQ_MIN / ANIMATION.NYQUIST) * dataLength));
        const maxBin = Math.min(dataLength - 1, Math.floor((ANIMATION.VOICE_FREQ_MAX / ANIMATION.NYQUIST) * dataLength));

        for (let i = 0; i < this.numBars; i++) {
            const t = i / this.numBars;
            const logMin = Math.log(minBin);
            const logMax = Math.log(maxBin);
            const logIndex = logMin + (logMax - logMin) * t;
            const index = Math.floor(Math.exp(logIndex));

            const value = this.smoothedFrequencyData[Math.min(Math.max(index, 0), dataLength - 1)] || 0;
            barData.push(value / 255);
        }

        return barData;
    }

    // 球体を更新
    updateSphere(color, avgValue, time, isConnected, isIdle) {
        const baseScale = 0.8 + avgValue * 0.6;

        const pulseX = 1 + Math.sin(time * 8) * avgValue * 0.15;
        const pulseY = 1 + Math.sin(time * 8 + Math.PI / 3) * avgValue * 0.15;
        const pulseZ = 1 + Math.sin(time * 8 + Math.PI * 2 / 3) * avgValue * 0.15;

        this.sphere.scale.set(
            baseScale * pulseX,
            baseScale * pulseY,
            baseScale * pulseZ
        );

        this.sphere.rotation.x = time * 0.4 + avgValue * 0.5;
        this.sphere.rotation.y = time * 0.5 + avgValue * 0.3;
        this.sphere.rotation.z = time * 0.2;

        this.sphereMaterial.color = color;
        this.sphereMaterial.emissive = color;
        this.sphereMaterial.emissiveIntensity = (isConnected && !isIdle)
            ? (MATERIAL.SPHERE_BASE_EMISSIVE + avgValue * MATERIAL.SPHERE_DYNAMIC_EMISSIVE)
            : MATERIAL.IDLE_EMISSIVE_INTENSITY;
        this.sphereMaterial.opacity = (isConnected && !isIdle)
            ? (MATERIAL.ACTIVE_OPACITY + avgValue * 0.6)
            : MATERIAL.IDLE_OPACITY;
    }

    // リングを更新
    updateRing(color, barData, time, isConnected, isIdle) {
        this.barsGroup.rotation.x = time * 0.2;
        this.barsGroup.rotation.y = time * 0.3;
        this.barsGroup.rotation.z = time * 0.15;

        for (let i = 0; i < this.bars.length; i++) {
            const bar = this.bars[i];
            const value = barData[i];

            bar.scale.y = 0.5 + value * 15;

            bar.material.color = color;
            bar.material.emissive = color;
            bar.material.emissiveIntensity = (isConnected && !isIdle)
                ? (MATERIAL.RING_BASE_EMISSIVE + value * MATERIAL.RING_DYNAMIC_EMISSIVE)
                : MATERIAL.IDLE_EMISSIVE_INTENSITY;
            bar.material.opacity = (isConnected && !isIdle)
                ? (0.5 + value * 0.5)
                : MATERIAL.IDLE_OPACITY;

            const baseRadius = bar.userData.radius;
            const newRadius = baseRadius + value * 0.3 + Math.sin(time * 2 + i * 0.1) * 0.05;
            const angle = bar.userData.angle;

            bar.position.x = Math.cos(angle) * newRadius;
            bar.position.z = Math.sin(angle) * newRadius;
        }
    }

    // グリッドを更新
    updateGrid(color, barData, avgValue, time, isConnected, isIdle) {
        if (!this.showGrid || this.gridSquares.length === 0) return;

        const baseIntensity = this.getGridBaseIntensity(this.theme);
        const baseOpacity = this.getGridBaseOpacity(this.theme);

        for (let i = 0; i < this.gridSquares.length; i++) {
            const square = this.gridSquares[i];
            const gridIndex = square.userData.gridIndex;

            const freqIndex = Math.floor((gridIndex / this.gridSquares.length) * barData.length);
            const value = barData[Math.min(freqIndex, barData.length - 1)];

            const row = square.userData.row;
            const col = square.userData.col;
            const centerX = (this.gridCols - 1) / 2;
            const centerY = (this.gridRows - 1) / 2;
            const distanceFromCenter = Math.sqrt(
                Math.pow(col - centerX, 2) + Math.pow(row - centerY, 2)
            );

            const waveSpeed = 3;
            const waveFrequency = 0.5;
            const wave = Math.sin(distanceFromCenter * waveFrequency - time * waveSpeed);

            const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
            const normalizedDistance = distanceFromCenter / maxDistance;

            const distanceFactor = Math.max(0, 1 - normalizedDistance * 2.5);
            const lift = value * avgValue * 5 * distanceFactor + wave * avgValue * 0.3 * distanceFactor;

            square.position.x = square.userData.originalX;
            square.position.y = square.userData.originalY;
            square.position.z = Math.max(0, lift);

            square.material.color = color;
            square.material.emissive = color;

            const gradientFactor = Math.max(0.1, 1 - normalizedDistance * 0.8);

            if (isConnected && !isIdle) {
                square.material.emissiveIntensity = (baseIntensity + value * 2.0) * gradientFactor;
                square.material.opacity = (baseOpacity + value * 0.8) * gradientFactor;
            } else {
                square.material.emissiveIntensity = baseIntensity * gradientFactor;
                square.material.opacity = baseOpacity * gradientFactor;
            }

            square.rotation.z = 0;
        }
    }

    // ライティングを更新
    updateLighting(color, avgValue) {
        this.pointLight.color = color;
        const intensityMultiplier = this.theme === 'dark'
            ? LIGHTING.POINT_LIGHT_MULTIPLIER_DARK
            : LIGHTING.POINT_LIGHT_MULTIPLIER_LIGHT;
        this.pointLight.intensity = LIGHTING.POINT_LIGHT_BASE + avgValue * intensityMultiplier;
    }

    // カメラを更新
    updateCamera(time) {
        if (this.showGrid) {
            this.camera.position.x = 0;
            this.camera.position.y = 0;
            this.camera.position.z = 4;
        } else {
            this.camera.position.x = Math.sin(time * 0.3) * 0.3;
            this.camera.position.y = Math.cos(time * 0.2) * 0.2;
            this.camera.position.z = 4;
        }
        this.camera.lookAt(0, 0, 0);
    }

    animate() {
        if (!this.isAnimating) return;

        // データのスムージング
        this.smoothAudioData();

        // 色の更新
        const color = this.updateColors();

        // 周波数バーデータの生成
        const barData = this.generateBarData();
        const avgValue = barData.reduce((a, b) => a + b) / barData.length;
        const time = Date.now() * 0.001;

        const isConnected = this.frequencyData.length > 0;
        const isIdle = this.currentState === 'idle';

        // 各要素の更新
        this.updateSphere(color, avgValue, time, isConnected, isIdle);
        this.updateRing(color, barData, time, isConnected, isIdle);
        this.updateGrid(color, barData, avgValue, time, isConnected, isIdle);
        this.updateLighting(color, avgValue);
        this.updateCamera(time);

        // レンダリング
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}
