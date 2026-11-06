import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openStore, need, Problem } from './lib/store.mjs';
import { verifyPassword, hashPassword, sessionToken, digest } from './lib/auth.mjs';
import { createAccounts } from './lib/accounts.mjs';
import { createGoogleAuth } from './lib/google.mjs';
import { createRecovery } from './lib/recovery.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
const dummyHash = await hashPassword('not-a-real-password-dummy');
const assets = {
  '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/accounts.js': 'accounts.js', '/google.js': 'google.js', '/recovery.js': 'recovery.js', '/features.js': 'features.js', '/styles.css': 'styles.css',
  '/sw.js': 'sw.js', '/manifest.webmanifest': 'manifest.webmanifest', '/icon.svg': 'icon.svg',
  '/icon-192.png': 'icon-192.png', '/icon-512.png': 'icon-512.png',
  '/icon.png': 'icon.png',
  '/assets/handari_logo.png': 'assets/handari_logo.png', '/assets/facebook_qr.png': 'assets/facebook_qr.png'
};
