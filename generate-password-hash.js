#!/usr/bin/env node
import crypto from 'crypto';

/**
 * パスワードハッシュ生成ツール
 * 使い方: node generate-password-hash.js <your-password>
 */

const password = process.argv[2];

if (!password) {
    console.error('Usage: node generate-password-hash.js <your-password>');
    process.exit(1);
}

// SHA-256ハッシュを生成
const hash = crypto.createHash('sha256').update(password).digest('hex');

console.log('\n==============================================');
console.log('Password Hash Generator');
console.log('==============================================\n');
console.log('Password:', password);
console.log('SHA-256 Hash:', hash);
console.log('\nCopy this hash to index.html:');
console.log(`const PASSWORD_HASH = '${hash}';`);
console.log('\n==============================================\n');
