/**
 * Authentication module
 * パスワード認証機能を提供
 */

import { API_CONFIG, AUTH_CONFIG } from './config.js';

/**
 * Password authentication manager
 * パスワード認証マネージャー
 */
export class AuthManager {
    constructor() {
        this.passwordInput = null;
    }

    /**
     * Initialize authentication manager with password input element
     * @param {HTMLInputElement} passwordInput - Password input element
     */
    init(passwordInput) {
        this.passwordInput = passwordInput;
        this.updatePasswordUI();
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if authenticated
     */
    isAuthenticated() {
        return sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY) === 'true';
    }

    /**
     * Hash password using SHA-256
     * @param {string} password - Plain text password
     * @returns {Promise<string>} Hashed password
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Update password input UI based on authentication state
     */
    updatePasswordUI() {
        if (this.isAuthenticated() && this.passwordInput) {
            this.passwordInput.value = AUTH_CONFIG.PASSWORD_PLACEHOLDER;
        }
    }

    /**
     * Authenticate user with password
     * @returns {Promise<{success: boolean, error?: string}>} Authentication result with optional error message
     */
    async authenticate() {
        if (!this.passwordInput) {
            console.error('Password input not initialized');
            return { success: false, error: 'system_error' };
        }

        const password = this.passwordInput.value;

        // Already authenticated
        if (this.isAuthenticated()) {
            return { success: true };
        }

        // No password entered
        if (!password || password === '' || password === AUTH_CONFIG.PASSWORD_PLACEHOLDER) {
            return { success: false, error: 'empty_password' };
        }

        try {
            const hash = await this.hashPassword(password);

            // Call server auth endpoint
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ passwordHash: hash })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                sessionStorage.setItem(AUTH_CONFIG.SESSION_KEY, 'true');
                this.passwordInput.value = AUTH_CONFIG.PASSWORD_PLACEHOLDER;
                return { success: true };
            } else {
                return { success: false, error: 'invalid_password' };
            }
        } catch (error) {
            console.error('Authentication error:', error);
            return { success: false, error: 'network_error' };
        }
    }

    /**
     * Clear authentication state
     */
    clearAuthentication() {
        sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
        if (this.passwordInput) {
            this.passwordInput.value = '';
        }
    }

    /**
     * Check password field and clear auth if changed from placeholder
     * Call this when saving settings
     */
    checkPasswordAndClearIfChanged() {
        if (!this.passwordInput) {
            return;
        }

        const currentValue = this.passwordInput.value;

        // パスワードが空の場合、または認証済みプレースホルダーから変更された場合
        if (!currentValue || currentValue === '' ||
            (this.isAuthenticated() && currentValue !== AUTH_CONFIG.PASSWORD_PLACEHOLDER)) {
            this.clearAuthentication();
        }
    }
}
