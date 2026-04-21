import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TABS } from '../src/components/TopNav';

test('admin dashboard is available as a separate navigation tab', () => {
  assert.ok(TABS.some((tab) => tab.id === 'admin' && tab.label === '관리자'));
});

test('default dashboard does not embed the RAG admin panel', () => {
  const dashboardSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Dashboard.tsx'), 'utf8');

  assert.equal(dashboardSource.includes('RagAdminPanel'), false);
});
