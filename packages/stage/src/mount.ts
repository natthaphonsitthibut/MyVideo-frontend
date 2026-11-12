import { frameToMs } from '@myvideo/timeline-core';
import { type BrandTheme, brandVars } from './brand';
import { applyActiveWord, buildCaptionNode } from './captions';
import { frameState, type VisibleElement } from './frame-state';
import { animationKeyframes } from './presets';
import { textStyleFor } from './styles';
import type { AssetResolver, StageElement, StageProject } from './types';
import { type VideoGroup, videoGroups } from './video-groups';

type Node = {
  box: HTMLElement;
  /** Inner wrapper animated by in/out presets (the box itself carries the transform). */
  inner: HTMLElement;
  media?: HTMLVideoElement | HTMLAudioElement;
  anims: Animation[];
};

export type Stage = {
  readonly root: HTMLElement;
  readonly frame: number;
  /** Draws `frame`; resolves once every visible video shows it (frame-exact, order-independent). */
  seek(frame: number): Promise<void>;
  /**
   * Draws `frame` for playback, seeking reused video nodes at cut boundaries. Returns the visible media and
   * required source times; hidden media are paused.
   */
  draw(frame: number): { el: HTMLMediaElement; time: number }[];
  /** Live edit: replace (or remove with null) one element without rebuilding the stage. */
  patch(id: string, element: StageElement | null): void;
  /** Every `apply` (seek/patch) notifies listeners with the frame. */
  onFrame(fn: (frame: number) => void): () => void;
  /** Resolves when bundled fonts are ready (text layout depends on them). */
  ready(): Promise<void>;
  destroy(): void;
};

const HALF_FRAME = 0.5;

/** Element volume for the preview: a muted track (advanced timeline) is silent, as in the render. */
function trackMuted(p: StageProject, trackId: string): boolean {
  return p.tracks.some((t) => t.id === trackId && t.muted);
}

function transformCss(e: StageElement, v: Record<string, number>): string {
  if (!('transform' in e)) return '';
  const t = e.transform;
  const x = v['transform.x'] ?? t.x;
  // captions are placed in the safe area from transform.y at build time; don't offset them twice
  const y = e.type === 'caption' ? 0 : (v['transform.y'] ?? t.y);
  const s = v['transform.scale'] ?? t.scale;
  const r = v['transform.rotation'] ?? t.rotation;
  return `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;
}

/**
 * The stage (ARCHITECTURE §7): framework-free DOM for a Project JSON. Everything visible is a pure function of
 * the frame (`frameState`); animations are paused WAAPI effects whose time is set from the frame — never the
 * wall clock — so preview and render draw the same pixels for the same frame.
 */
export function mountStage(
  container: HTMLElement,
  project: StageProject,
  resolve: AssetResolver,
  /** The merchant's current brand kit: brand tokens in element styles resolve to it (E08-F08). */
  theme?: Partial<BrandTheme>,
): Stage {
  let p = structuredClone(project);
  const root = document.createElement('div');
  root.dataset.stage = '';
  root.style.cssText = `position:relative;width:${p.width}px;height:${p.height}px;overflow:hidden;background:#000;contain:strict;${brandVars(theme)};`;
  container.appendChild(root);
  const volumeOf = (e: { trackId: string; volume: number }) =>
    trackMuted(p, e.trackId) ? 0 : Math.min(1, e.volume);
  const nodes = new Map<string, Node>();
  const videos = new Map<string, { group: VideoGroup; el: HTMLVideoElement; active?: string }>();
  const listeners = new Set<(f: number) => void>();
  let current = 0;
  const ms = (frames: number) => frameToMs(frames, p.fps);

  function build(e: StageElement): Node {
    const box = document.createElement('div');
    box.dataset.el = e.id;
    box.style.cssText = 'position:absolute;visibility:hidden;';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:100%;height:100%;';
    box.appendChild(inner);
    const node: Node = { box, inner, anims: [] };
    const full = `left:0;top:0;width:${p.width}px;height:${p.height}px;`;
    switch (e.type) {
      case 'video':
        box.style.cssText += full;
        break;
      case 'image': {
        box.style.cssText += full;
        const asset = p.assets[e.assetId];
        const el = document.createElement('img');
        if (asset) el.src = resolve(e.assetId, asset);
        el.style.cssText = `display:block;width:100%;height:100%;object-fit:${e.fit};`;
        if (e.crop)
          el.style.clipPath = `inset(${e.crop.top * 100}% ${e.crop.right * 100}% ${e.crop.bottom * 100}% ${e.crop.left * 100}%)`;
        inner.appendChild(el);
        break;
      }
      case 'audio': {
        const asset = p.assets[e.assetId];
        const el = document.createElement('audio');
        if (asset) el.src = resolve(e.assetId, asset);
        el.preload = 'auto';
        el.muted = true;
        el.volume = volumeOf(e);
        node.media = el;
        inner.appendChild(el);
        break;
      }
      case 'text': {
        box.style.cssText += `left:50%;top:50%;width:${p.width - 160}px;margin-left:${-(p.width - 160) / 2}px;`;
        const style = textStyleFor(e.style, e.styleRef);
        inner.style.cssText += `font-family:${style.fontFamily};font-weight:${style.fontWeight};font-size:${style.fontSize}px;line-height:1.25;color:${style.color};text-align:${style.align};white-space:pre-wrap;transform:translateY(-50%);`;
        if (style.background) {
          // a label, not a banner: the box hugs its (pre-broken) lines with a little padding
          inner.style.background = style.background;
          inner.style.cssText +=
            'width:fit-content;max-width:100%;margin:0 auto;padding:0.12em 0.45em;border-radius:0.3em;box-sizing:border-box;';
        }
        inner.textContent = e.content;
        break;
      }
      case 'shape': {
        const w = e.width ?? 100;
        const h = e.height ?? 100;
        box.style.cssText += `left:50%;top:50%;width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;`;
        inner.style.background = e.fill ?? '#ffffff';
        inner.style.borderRadius = e.shape === 'ellipse' ? '50%' : `${e.radius ?? 0}px`;
        break;
      }
      case 'cta': {
        box.style.cssText += 'left:50%;top:50%;';
        inner.style.cssText =
          'transform:translate(-50%,-50%);white-space:nowrap;padding:24px 56px;border-radius:999px;background:#ffffff;color:#111111;font-family:"Noto Sans Thai Variable","Noto Sans Variable",sans-serif;font-weight:700;font-size:56px;';
        inner.textContent = e.label;
        break;
      }
      case 'caption':
        box.dataset.caption = '';
        buildCaptionNode(box, inner, e, p.width, p.height);
        break;
    }
    const anim = (preset: StageElement['animationIn'], dir: 'in' | 'out') => {
      if (!preset) return;
      const kf = animationKeyframes(preset.presetId, dir);
      const delay = dir === 'in' ? 0 : ms(e.durationFrames - preset.durationFrames);
      const a = inner.animate(kf, {
        duration: ms(preset.durationFrames),
        delay,
        fill: 'both',
        easing: 'linear',
      });
      a.pause();
      node.anims.push(a);
    };
    anim(e.animationIn, 'in');
    anim(e.animationOut, 'out');
    root.appendChild(box);
    return node;
  }

  function rebuild(id: string) {
    const old = nodes.get(id);
    if (old) {
      if (old.media) {
        old.media.pause();
        old.media.removeAttribute('src');
      }
      for (const a of old.anims) a.cancel();
      old.box.remove();
      nodes.delete(id);
    }
    const e = p.elements[id];
    if (e) nodes.set(id, build(e));
  }

  for (const id of Object.keys(p.elements)) nodes.set(id, build(p.elements[id] as StageElement));

  function syncVideos() {
    const groups = videoGroups(p);
    const keep = new Set(groups.map((g) => g.id));
    for (const [id, video] of videos) {
      if (keep.has(id) && groups.find((g) => g.id === id)?.assetId === video.group.assetId) continue;
      video.el.pause();
      video.el.removeAttribute('src');
      video.el.remove();
      videos.delete(id);
    }
    for (const group of groups) {
      const existing = videos.get(group.id);
      if (existing) {
        existing.group = group;
        if (!root.contains(existing.el)) nodes.get(group.id)?.inner.appendChild(existing.el);
        continue;
      }
      const el = document.createElement('video');
      const asset = p.assets[group.assetId];
      if (asset) el.src = resolve(group.assetId, asset);
      el.muted = true;
      el.playsInline = true;
      el.preload = 'auto';
      el.style.cssText = 'display:block;width:100%;height:100%;';
      nodes.get(group.id)?.inner.appendChild(el);
      videos.set(group.id, { group, el });
    }
  }
  syncVideos();

  /** Applies the pure frame state to the DOM; returns the visible media that must be at a time. */
  function apply(frame: number, playback = false): { el: HTMLMediaElement; time: number }[] {
    current = frame;
    const state = frameState(p, frame);
    const on = new Map<string, VisibleElement>(state.visible.map((v) => [v.id, v]));
    const waits: { el: HTMLMediaElement; time: number }[] = [];
    const visibleVideos = new Map<string, HTMLVideoElement>();
    for (const video of videos.values()) {
      const id = video.group.elementIds.find((id) => on.has(id));
      const v = id === undefined ? undefined : on.get(id);
      if (v?.element.type !== 'video') {
        if (!video.el.paused) video.el.pause();
        video.active = undefined;
        continue;
      }
      const e = v.element;
      const changed = video.active !== id;
      const inner = nodes.get(v.id)?.inner;
      if (inner && video.el.parentElement !== inner) inner.appendChild(video.el);
      video.el.style.objectFit = e.fit;
      video.el.style.clipPath = e.crop
        ? `inset(${e.crop.top * 100}% ${e.crop.right * 100}% ${e.crop.bottom * 100}% ${e.crop.left * 100}%)`
        : '';
      video.el.playbackRate = e.playbackRate;
      video.el.volume = volumeOf(e);
      // re-seek at a cut only when the source jumps: a zoom cut continues the same time and must not stutter
      if (
        playback &&
        changed &&
        v.mediaTime !== undefined &&
        Math.abs(video.el.currentTime - v.mediaTime) > (2 * p.fps.den) / p.fps.num
      )
        video.el.currentTime = v.mediaTime;
      video.active = id;
      visibleVideos.set(v.id, video.el);
    }
    for (const [id, n] of nodes) {
      const v = on.get(id);
      if (!v) {
        if (n.box.style.visibility !== 'hidden') n.box.style.visibility = 'hidden';
        if (n.media && !n.media.paused) n.media.pause();
        if (n.box.dataset.caption !== undefined) applyActiveWord(n.inner, -1);
        continue;
      }
      const e = v.element;
      n.box.style.visibility = 'visible';
      n.box.style.zIndex = String(v.z);
      n.box.style.transform = transformCss(e, v.values);
      n.box.style.opacity = String(v.values.opacity ?? e.opacity ?? 1);
      for (const a of n.anims) a.currentTime = ms(v.local);
      if (v.activeWord !== undefined) {
        const start = e.type === 'caption' ? (e.words[v.activeWord]?.startFrame ?? v.local) : v.local;
        applyActiveWord(n.inner, v.activeWord, v.local - start);
      }
      const video = visibleVideos.get(id);
      if (video && v.mediaTime !== undefined) waits.push({ el: video, time: v.mediaTime });
      if (n.media && v.mediaTime !== undefined) waits.push({ el: n.media, time: v.mediaTime });
    }
    for (const l of listeners) l(frame);
    return waits;
  }

  /**
   * Seeks one media element and resolves when the target frame is not only decoded (`seeked`) but PRESENTED:
   * a video that was hidden keeps compositing its old picture until a new frame is presented, which
   * `requestVideoFrameCallback` reports. Where unavailable, decoding plus the caller's paint is the fallback.
   */
  const seekMedia = (el: HTMLMediaElement, time: number): Promise<void> =>
    new Promise((res) => {
      const frameS = (p.fps.den / p.fps.num) * HALF_FRAME;
      if (!el.seeking && Math.abs(el.currentTime - time) < frameS && el.readyState >= 2) return res();
      let seeked = false;
      let presented = !(el instanceof HTMLVideoElement) || !('requestVideoFrameCallback' in el);
      let fallback: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (!seeked || !presented) return;
        if (fallback) clearTimeout(fallback);
        res();
      };
      if (!presented) {
        // A shared node (jump cuts) may still present a frame from the previous element: wait for one near the
        // target. Presented times are frame starts, so allow a whole frame (2 × half) of difference.
        const onPresented: VideoFrameRequestCallback = (_now, metadata) => {
          if (Math.abs(metadata.mediaTime - time) >= 2 * frameS) {
            (el as HTMLVideoElement).requestVideoFrameCallback(onPresented);
            return;
          }
          presented = true;
          finish();
        };
        (el as HTMLVideoElement).requestVideoFrameCallback(onPresented);
      }
      el.addEventListener(
        'seeked',
        () => {
          seeked = true;
          // last resort, never hang a render: no matching frame reported 1.5 s after the seek → trust the decode
          if (!presented)
            fallback = setTimeout(() => {
              presented = true;
              finish();
            }, 1500);
          finish();
        },
        { once: true },
      );
      // aim at the middle of the frame so decoders never land on the previous one
      el.currentTime = time + frameS / 2;
    });

  return {
    root,
    get frame() {
      return current;
    },
    draw(frame) {
      return apply(frame, true);
    },
    async seek(frame) {
      const waits = apply(frame);
      await Promise.all(waits.map((w) => seekMedia(w.el, w.time)));
      // one paint so the decoded frames are on screen before the caller captures/continues
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    },
    patch(id, element) {
      if (element) p.elements[id] = structuredClone(element);
      else delete p.elements[id];
      p = { ...p };
      rebuild(id);
      syncVideos();
      apply(current);
    },
    onFrame(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async ready() {
      await document.fonts.ready;
    },
    destroy() {
      for (const video of videos.values()) {
        video.el.pause();
        video.el.removeAttribute('src');
      }
      videos.clear();
      for (const id of [...nodes.keys()]) {
        const n = nodes.get(id);
        n?.media?.pause();
        n?.media?.removeAttribute('src');
        for (const a of n?.anims ?? []) a.cancel();
      }
      nodes.clear();
      listeners.clear();
      root.remove();
    },
  };
}
