/**
 * Audio-reactive 3D visualization using Three.js
 * 3D音声ビジュアライゼーション
 */
import * as THREE from 'three';

export class AudioVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.frequencyData = [];
        this.smoothedFrequencyData = [];
        this.isAnimating = false;
        this.numBars = 128;

        // 色の状態管理（初期はグレー）
        this.currentColor = { r: 120, g: 120, b: 120 };
        this.targetColor = { r: 120, g: 120, b: 120 };

        // テーマ管理
        this.theme = 'light';
        this.backgroundColor = new THREE.Color(1, 1, 1);
        this.targetBackgroundColor = new THREE.Color(1, 1, 1);

        // ビジュアライゼーション要素の表示設定
        this.showSphere = true;
        this.showRing = true;

        this.initThree();
        this.resize();
        window.addEventListener('resize', () => this.resize());
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        this.pointLight = new THREE.PointLight(0x787878, 2, 100); // 初期はグレー
        this.pointLight.position.set(0, 0, 3);
        this.scene.add(this.pointLight);

        // 3Dオブジェクトの作成
        this.createVisualizationObjects();
    }

    createVisualizationObjects() {
        // 中心の球体（ワイヤーフレーム）
        const sphereGeometry = new THREE.IcosahedronGeometry(1, 3);
        this.sphereMaterial = new THREE.MeshPhongMaterial({
            color: 0x404040, // より薄いグレー
            wireframe: true,
            emissive: 0x404040,
            emissiveIntensity: 0.2, // 初期発光を低く
            transparent: true,
            opacity: 0.4 // 透明度を上げて薄く
        });
        this.sphere = new THREE.Mesh(sphereGeometry, this.sphereMaterial);
        this.scene.add(this.sphere);

        // 周囲の3Dバー（64本を1つのリングに配置）
        // リング全体を回転させるためのグループ
        this.barsGroup = new THREE.Group();
        this.scene.add(this.barsGroup);

        this.bars = [];
        const barGeometry = new THREE.BoxGeometry(0.04, 0.1, 0.04); // 半分に
        const radius = 2.2;

        for (let i = 0; i < this.numBars; i++) {
            const material = new THREE.MeshPhongMaterial({
                color: 0x404040, // より薄いグレー
                emissive: 0x404040,
                emissiveIntensity: 0.2, // 初期発光を低く
                transparent: true,
                opacity: 0.3 // 透明度を上げて薄く
            });

            const bar = new THREE.Mesh(barGeometry, material);

            const angle = (i / this.numBars) * Math.PI * 2;

            // XZ平面（水平）にリング配置
            bar.position.x = Math.cos(angle) * radius;
            bar.position.z = Math.sin(angle) * radius;
            bar.position.y = 0;

            // バーを中心に向ける
            bar.lookAt(0, 0, 0);
            bar.userData.angle = angle;
            bar.userData.radius = radius;

            this.barsGroup.add(bar);
            this.bars.push(bar);
        }
    }

    setColor(state) {
        // state: 'ai' = AIが話している, 'user' = ユーザーが話している, 'idle' = 待機中
        if (state === 'ai' || state === true) {
            // 水色 - AIが話している
            if (this.theme === 'dark') {
                this.targetColor = { r: 0, g: 230, b: 255 };
            } else {
                this.targetColor = { r: 0, g: 200, b: 255 };
            }
        } else if (state === 'user') {
            // 鮮やかなピンク/レッド - ユーザーが話している
            this.targetColor = { r: 255, g: 68, b: 120 };
        } else {
            // グレー - 待機中（デフォルト）
            if (this.theme === 'dark') {
                this.targetColor = { r: 150, g: 150, b: 150 };
            } else {
                this.targetColor = { r: 120, g: 120, b: 120 };
            }
        }
    }

    setTheme(theme) {
        this.theme = theme;
        if (theme === 'dark') {
            this.targetBackgroundColor = new THREE.Color(0, 0, 0); // 真っ黒
        } else {
            this.targetBackgroundColor = new THREE.Color(1, 1, 1);
        }
    }

    setVisualizationElements(showSphere, showRing) {
        this.showSphere = showSphere;
        this.showRing = showRing;

        // 球体の表示/非表示
        if (this.sphere) {
            this.sphere.visible = showSphere;
        }

        // リングの表示/非表示
        if (this.barsGroup) {
            this.barsGroup.visible = showRing;
        }
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

    animate() {
        if (!this.isAnimating) return;

        // データをスムージング
        for (let i = 0; i < this.frequencyData.length; i++) {
            this.smoothedFrequencyData[i] =
                this.smoothedFrequencyData[i] * 0.7 + this.frequencyData[i] * 0.3;
        }

        // 色をグラデーション的に変化
        this.currentColor.r += (this.targetColor.r - this.currentColor.r) * 0.1;
        this.currentColor.g += (this.targetColor.g - this.currentColor.g) * 0.1;
        this.currentColor.b += (this.targetColor.b - this.currentColor.b) * 0.1;

        // Three.js用の色
        const color = new THREE.Color(
            this.currentColor.r / 255,
            this.currentColor.g / 255,
            this.currentColor.b / 255
        );

        // 背景色を滑らかに変化
        this.backgroundColor.lerp(this.targetBackgroundColor, 0.05);
        this.scene.background = this.backgroundColor;

        // 周波数データを対数スケールでサンプリング
        const barData = [];
        for (let i = 0; i < this.numBars; i++) {
            const logIndex = Math.pow(i / this.numBars, 1.5) * this.smoothedFrequencyData.length;
            const index = Math.floor(logIndex);
            const value = this.smoothedFrequencyData[index] || 0;
            barData.push(value / 255);
        }

        const avgValue = barData.reduce((a, b) => a + b) / barData.length;
        const time = Date.now() * 0.001;

        // 中心の球体を更新（3軸回転と音に応じた変形）
        const baseScale = 0.8 + avgValue * 0.6;

        // 音に応じて各軸のスケールを変える（脈動効果）
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
        this.sphereMaterial.emissiveIntensity = 0.2 + avgValue * 1.8; // 発光強度を大幅に増加
        this.sphereMaterial.opacity = 0.4 + avgValue * 0.6; // 音量に応じて不透明度も上昇

        // リング全体を3軸回転
        this.barsGroup.rotation.x = time * 0.2;
        this.barsGroup.rotation.y = time * 0.3;
        this.barsGroup.rotation.z = time * 0.15;

        // バーを更新
        for (let i = 0; i < this.bars.length; i++) {
            const bar = this.bars[i];
            const value = barData[i];

            // 高さを変更
            bar.scale.y = 0.5 + value * 10;

            // 色を更新
            bar.material.color = color;
            bar.material.emissive = color;
            bar.material.emissiveIntensity = 0.2 + value * 1.5; // 発光強度を追加
            bar.material.opacity = 0.3 + value * 0.7; // 音量反応をより顕著に

            // 位置を若干変更（波のような動き）
            const baseRadius = bar.userData.radius;
            const newRadius = baseRadius + value * 0.4 + Math.sin(time * 2 + i * 0.1) * 0.1;
            const angle = bar.userData.angle;

            bar.position.x = Math.cos(angle) * newRadius;
            bar.position.z = Math.sin(angle) * newRadius;
        }

        // ライトの色と強度を更新
        this.pointLight.color = color;
        const intensityMultiplier = this.theme === 'dark' ? 5.0 : 4.0; // 強度を上げて発光感を増加
        this.pointLight.intensity = 1.0 + avgValue * intensityMultiplier;

        // カメラを微妙に動かす
        this.camera.position.x = Math.sin(time * 0.3) * 0.3;
        this.camera.position.y = Math.cos(time * 0.2) * 0.2;
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}
