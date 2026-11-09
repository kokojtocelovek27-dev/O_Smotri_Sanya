/* ============================================================
   O_Smotri_Eto_Sanya — frontend
   Данные Twitch читаются из data/twitch.json (обновляется Actions).
   Эмодзи подтягиваются через публичный API streamer-emotes.
   ============================================================ */

const STREAMER = 'o_smotri_eto_sanya';

/* ---------- УТИЛИТЫ ---------- */
async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Ошибка загрузки ${path}: ${res.status}`);
  return res.json();
}

function safeText(str, fallback = '—') {
  return str ? String(str).trim() || fallback : fallback;
}

/* ---------- СТРИМ ---------- */
async function renderStream() {
  const container = document.getElementById('stream-container');

  try {
    const data = await loadJSON('./data/twitch.json');
    const stream = data?.stream;

    if (!stream) {
      container.innerHTML = `<p class="loading">Сейчас стрим не идёт. Заходи позже!</p>`;
      return;
    }

    const thumb = stream.thumbnail_url
      .replace('{width}', '640')
      .replace('{height}', '360');

    container.innerHTML = `
      <article class="card">
        <img class="card__thumb" src="${thumb}" alt="Превью стрима" loading="lazy" />
        <h3 class="card__title">${safeText(stream.title)}</h3>
        <div class="card__meta">
          <span>🎮 ${safeText(stream.game_name, 'Без категории')}</span>
          <span>👀 ${stream.viewer_count ?? 0}</span>
          <span>🔴 LIVE</span>
        </div>
      </article>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="loading error">Не удалось загрузить данные стрима.</p>`;
  }
}

/* ---------- КЛИПЫ ---------- */
let clipsCache = [];

async function renderClips() {
  const container = document.getElementById('clip-container');

  try {
    if (!clipsCache.length) {
      const data = await loadJSON('./data/twitch.json');
      clipsCache = Array.isArray(data?.clips) ? data.clips : [];
    }

    if (!clipsCache.length) {
      container.innerHTML = `<p class="loading">Клипов пока нет.</p>`;
      return;
    }

    const clip = clipsCache[Math.floor(Math.random() * clipsCache.length)];

    const embedUrl = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip.id)}&parent=${location.hostname}&autoplay=false`;

    container.innerHTML = `
      <article class="card" style="grid-column: 1 / -1;">
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">
          <iframe
            src="${embedUrl}"
            style="position:absolute;top:0;left:0;width:100%;height:100%;border:2px solid var(--border);"
            allowfullscreen
            loading="lazy"
            title="Twitch клип"
          ></iframe>
        </div>
        <h3 class="card__title" style="margin-top:0.8rem;">${safeText(clip.title)}</h3>
        <div class="card__meta">
          <span>👀 ${clip.view_count ?? 0} просмотров</span>
          <span>🎮 ${safeText(clip.game_id, '—')}</span>
        </div>
      </article>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="loading error">Не удалось загрузить клипы.</p>`;
  }
}

/* ---------- ЭМОДЗИ (streamer-emotes) ---------- */
async function renderEmotes() {
  const container = document.getElementById('emotes-container');

  try {
    /* streamer-emotes можно подключить через ESM CDN */
    const { getStreamerEmotes } = await import('https://cdn.jsdelivr.net/npm/streamer-emotes@0.1.2/+esm');

    const emotes = await getStreamerEmotes(STREAMER, {
      bttv: true,
      ffz: true,
      sevenTV: true,
      twitch: { globals: false }
    });

    /* Собираем все эмодзи из всех провайдеров */
    const all = [];

    for (const [provider, payload] of Object.entries(emotes || {})) {
      const channel = payload?.channel || [];
      for (const emote of channel) {
        const url = emote?.images?.[0]?.url || emote?.url;
        if (url && emote.name) {
          all.push({ name: emote.name, url, provider });
        }
      }
    }

    if (!all.length) {
      container.innerHTML = `<p class="loading">Эмодзи не найдены.</p>`;
      return;
    }

    /* Перемешиваем и берём топ-50 для красоты */
    all.sort(() => Math.random() - 0.5);
    const slice = all.slice(0, 50);

    container.innerHTML = slice.map((e, i) => `
      <div class="emote-item" style="animation-delay:${(i * 0.02).toFixed(2)}s" title="${e.name} (${e.provider})">
        <img src="${e.url}" alt="${e.name}" loading="lazy" />
        <span class="emote-item__name">${e.name}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Emotes error:', err);
    container.innerHTML = `<p class="loading error">Не удалось загрузить эмодзи. Попробуй обновить страницу.</p>`;
  }
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderStream();
  renderClips();
  renderEmotes();

  const btn = document.getElementById('random-clip-btn');
  if (btn) {
    btn.addEventListener('click', renderClips);
  }
});
