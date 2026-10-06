import './style.css';
import { overview, verses } from './poem';
import type { View } from './poem';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const numerals = ['〇', '一', '二', '三', '四', '五', '六', '七', '八'];
const nav = $('#poem-nav');
const buttons: HTMLButtonElement[] = [];
let world: import('./world').MountainWorld | null = null;
let currentView = overview;

verses.forEach((view, index) => {
  const button = document.createElement('button');
  button.className = 'verse'; button.type = 'button'; button.dataset.view = view.id;
  button.setAttribute('aria-label', `${view.line}，前往${view.name}`); button.setAttribute('aria-current', 'false');
  button.innerHTML = `<span class="verse-number">0${index + 1}</span><span class="verse-text">${view.line}<span class="verse-punctuation">${index % 2 === 0 ? '，' : '。'}</span></span><span class="verse-arrow" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M3 10h13m-5-5 5 5-5 5"/></svg></span>`;
  button.disabled = true;
  button.addEventListener('click', () => select(view));
  nav.appendChild(button); buttons.push(button);
});

function select(view: View) {
  if (!world?.ready) return;
  currentView = view;
  world.setView(view);
  const index = verses.indexOf(view) + 1;
  buttons.forEach(button => button.setAttribute('aria-current', String(button.dataset.view === view.id)));
  $('#view-title').textContent = view.line;
  $('#view-description').textContent = view.description;
  $('#view-number').textContent = numerals[index];
  $('#view-name').textContent = view.name;
  $('#announcement').textContent = `正在前往${view.name}。${view.description}`;
  $('#scene').setAttribute('aria-label', `${view.line}：${view.description}`);
}

$('#overview').addEventListener('click', () => select(overview));
const motionButton = $<HTMLButtonElement>('#motion');
function updateMotion() {
  if (!world) return;
  motionButton.setAttribute('aria-pressed', String(world.paused));
  motionButton.setAttribute('aria-label', world.paused ? '播放景物动画' : '暂停景物动画');
  $('#motion-icon').innerHTML = world.paused ? '<path d="m7 4 8 6-8 6z"/>' : '<path d="M7 5v10M13 5v10"/>';
}
motionButton.addEventListener('click', () => {
  if (!world) return;
  world.paused = !world.paused; updateMotion();
});
window.addEventListener('world-motion-change', updateMotion);
$('#retry').addEventListener('click', () => location.reload());

function showError(message?: string) {
  $('#loading').classList.add('done'); $('#fallback').hidden = false;
  if (message) $('#fallback-message').textContent = message;
  buttons.forEach(button => { button.disabled = true; });
  $<HTMLButtonElement>('#overview').disabled = true; motionButton.disabled = true;
  $('#announcement').textContent = '三维景观暂时无法显示，仍可阅读完整诗文。';
}

window.addEventListener('world-ready', () => {
  $('#loading-progress').style.width = '100%'; $('#loading-text').textContent = '秋山已至';
  buttons.forEach(button => { button.disabled = false; }); updateMotion();
  $('#loading').classList.add('done');
}, { once: true });

async function init() {
  try {
    const { MountainWorld } = await import('./world');
    // Yield once so the poem and loading state paint before constructing the valley.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    world = new MountainWorld($('#scene'), value => { $('#loading-progress').style.width = `${value}%`; }, showError);
    updateMotion();
  } catch (error) {
    console.error('秋山加载失败', error);
    showError();
  }
}

// Read-only scene information is useful for checking camera and loading state.
Object.defineProperty(window, '__mountain', { configurable: true, get: () => world ? { ...world.state, selectedLine: currentView.line } : { ready: false } });
window.addEventListener('pagehide', event => { if (!event.persisted) world?.dispose(); });
void init();
