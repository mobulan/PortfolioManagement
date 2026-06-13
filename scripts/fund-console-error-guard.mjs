import { readFileSync } from 'node:fs';

const pageSource = readFileSync('app/page.jsx', 'utf8');
const fundApiSource = readFileSync('app/api/fund.js', 'utf8');

if (/console\.error\(`刷新基金 \$\{c\} 失败`,\s*e\)/.test(pageSource)) {
  throw new Error('refresh fallback must not pass Error objects to console.error');
}

if (!fundApiSource.includes('scheduleJsonpCallbackCleanup')) {
  throw new Error('JSONP callbacks need delayed noop cleanup to avoid late script ReferenceError');
}

console.log('fund console error guard passed');
