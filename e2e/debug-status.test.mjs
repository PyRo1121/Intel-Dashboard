import test from 'node:test';
import { createBrowserContext, captureBrowserArtifacts } from './browser-test-helpers.mjs';

test('debug owner status endpoint', async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;
  try {
    const page = await context.newPage();
    try {
      const res = await page.goto('https://intel.pyro1121.com/api/status', { waitUntil: 'domcontentloaded', timeout: 45000 });
      console.log('STATUS', res?.status());
      console.log(((await page.textContent('body')) || '').slice(0, 4000));
    } catch (error) {
      await captureBrowserArtifacts(page, 'debug-status-endpoint', error);
      throw error;
    } finally {
      await page.close().catch(()=>{});
    }
  } finally {
    await context.close();
    await browser.close();
  }
});
