import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseName = process.argv[2] || 'week1-ig-content-kit';
const htmlPath = path.resolve(__dirname, '..', `${baseName}.html`);
const pdfPath = path.resolve(__dirname, '..', `${baseName}.pdf`);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();
console.log(`PDF saved to: ${pdfPath}`);
