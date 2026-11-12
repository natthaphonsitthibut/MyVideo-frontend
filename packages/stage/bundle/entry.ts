/**
 * Entry of the stage bundle (ARCHITECTURE §3/§7): the same compositor the editor mounts, built as one IIFE that
 * sets `window.MyVideoStage`. The backend renderer opens a blank page with `stage.css` + `stage.js`, calls
 * `MyVideoStage.render.load(project, urls)` once and then `render.seek(frame)` for every frame it captures.
 */
import { captionFont, loadCaptionFont, mountStage, type Stage, type StageProject } from '../src/index';

export * from '../src/index';

/** Every weight the stage draws with (captions 600/800, text styles 500/800, CTA 700). */
const WEIGHTS = [400, 500, 600, 700, 800, 900];
const SAMPLE = 'กขฃคฅ ก่ก้ก๊ก๋ ฿%0123456789 AaBb';

async function loadFonts(): Promise<void> {
  await Promise.all(WEIGHTS.map((w) => loadCaptionFont(captionFont('clean').replace(/^\d+/, String(w)))));
  await document.fonts.load(`700 56px "Noto Sans Variable"`, SAMPLE);
  await document.fonts.ready;
}

function mediaReady(el: HTMLMediaElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (el.error) return reject(new Error(`media failed: ${el.currentSrc || el.src} (${el.error.code})`));
    if (el.readyState >= 1) return resolve();
    el.addEventListener('loadedmetadata', () => resolve(), { once: true });
    el.addEventListener(
      'error',
      () => reject(new Error(`media failed: ${el.currentSrc || el.src} (${el.error?.code ?? '?'})`)),
      { once: true },
    );
  });
}

let current: Stage | null = null;

/** Render host: drives the stage frame by frame in a headless page (no clock, no network beyond `urls`). */
export const render = {
  async load(project: StageProject, urls: Record<string, string>): Promise<{ frames: number }> {
    current?.destroy();
    document.documentElement.style.cssText = 'margin:0;padding:0;background:#000;';
    document.body.style.cssText = 'margin:0;padding:0;background:#000;overflow:hidden;';
    const container = document.getElementById('stage') ?? document.body;
    current = mountStage(container, project, (id) => urls[id] ?? '');
    await loadFonts();
    await Promise.all([...current.root.querySelectorAll<HTMLMediaElement>('video,audio')].map(mediaReady));
    return { frames: project.durationFrames };
  },
  async seek(frame: number): Promise<void> {
    if (!current) throw new Error('render.load() first');
    await current.seek(frame);
  },
  destroy(): void {
    current?.destroy();
    current = null;
  },
};
