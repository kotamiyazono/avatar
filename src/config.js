/**
 * Application configuration
 * アプリケーション設定定数
 */

export const API_CONFIG = {
    BASE_URL: 'http://localhost:3002',
    ENDPOINTS: {
        AUTH: '/auth',
        TOKEN: '/token',
        SEARCH: '/search'
    }
};

export const AUTH_CONFIG = {
    SESSION_KEY: 'authenticated',
    PASSWORD_PLACEHOLDER: '••••••••'
};

export const DEFAULT_SETTINGS = {
    VOICE: 'alloy',
    INSTRUCTIONS: 'You are a helpful assistant.',
    THEME: 'system',
    VISUALIZATION: 'sphere',
    MODEL: 'gpt-realtime'
};
