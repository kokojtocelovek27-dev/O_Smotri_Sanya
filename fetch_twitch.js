/* fetch_twitch.js — запускается в GitHub Actions, не в браузере */
import fs from 'node:fs/promises';
import path from 'node:path';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const STREAMER_LOGIN = 'o_smotri_eto_sanya';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Не заданы TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET');
  process.exit(1);
}

/* 1. Получаем App Access Token */
async function getAppToken() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });

  if (!res.ok) {
    throw new Error(`Token error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

/* 2. Получаем ID пользователя по логину */
async function getUserId(token) {
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(STREAMER_LOGIN)}`,
    {
      headers: {
        'Client-Id': CLIENT_ID,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Users error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const user = data?.data?.[0];
  if (!user) throw new Error(`Пользователь ${STREAMER_LOGIN} не найден`);
  return user.id;
}

/* 3. Получаем информацию о стриме (если идёт) */
async function getStream(token, userId) {
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(userId)}`,
    {
      headers: {
        'Client-Id': CLIENT_ID,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!res.ok) {
    console.warn(`Streams warning: ${res.status} ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  return data?.data?.[0] || null;
}

/* 4. Получаем последние клипы */
async function getClips(token, userId) {
  const url = new URL('https://api.twitch.tv/helix/clips');
  url.searchParams.set('broadcaster_id', userId);
  url.searchParams.set('first', '20');

  const res = await fetch(url, {
    headers: {
      'Client-Id': CLIENT_ID,
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    console.warn(`Clips warning: ${res.status} ${await res.text()}`);
    return [];
  }

  const data = await res.json();
  return data?.data || [];
}

/* ---------- MAIN ---------- */
async function main() {
  const token = await getAppToken();
  const userId = await getUserId(token);

  const [stream, clips] = await Promise.all([
    getStream(token, userId),
    getClips(token, userId)
  ]);

  const payload = {
    updated_at: new Date().toISOString(),
    streamer: STREAMER_LOGIN,
    stream: stream
      ? {
          id: stream.id,
          title: stream.title,
          game_name: stream.game_name,
          viewer_count: stream.viewer_count,
          thumbnail_url: stream.thumbnail_url,
          started_at: stream.started_at
        }
      : null,
    clips: clips.map((c) => ({
      id: c.id,
      title: c.title,
      view_count: c.view_count,
      game_id: c.game_id,
      created_at: c.created_at,
      thumbnail_url: c.thumbnail_url
    }))
  };

  const outDir = path.resolve('data');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, 'twitch.json'),
    JSON.stringify(payload, null, 2),
    'utf8'
  );

  console.log(`✅ Данные сохранены. Стрим: ${payload.stream ? 'да' : 'нет'}, клипов: ${payload.clips.length}`);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
