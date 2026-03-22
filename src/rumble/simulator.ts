import { setTimeout as sleep } from 'timers/promises';
import { v4 as uuid } from 'uuid';
import { deriveRumbleCreatorId } from './client.js';

const BASE_URL = `http://localhost:${process.env['DASHBOARD_PORT'] ?? 3000}`;
const CREATOR_HANDLE = 'AliceOnRumble';
const CREATOR_ID = deriveRumbleCreatorId(CREATOR_HANDLE);
const VIDEO_ID = 'rumble_video_abc123';

async function post(event: object): Promise<void> {
  await fetch(`${BASE_URL}/rumble/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}

async function runSimulation(): Promise<void> {
  console.log('\n🎬 FLOW × Rumble Simulation Starting...\n');
  console.log('   Tip: link a creator first with /rumble connect AliceOnRumble for full creator-side activity.\n');

  await post({
    event_id: uuid(),
    event_type: 'livestream.started',
    timestamp: new Date().toISOString(),
    creator_id: CREATOR_ID,
    creator_rumble_handle: CREATOR_HANDLE,
    video_id: VIDEO_ID,
    video_title: 'My Exclusive Rumble Livestream',
  });
  console.log('✅ Event: AliceOnRumble started a livestream');
  await sleep(500);

  for (let i = 1; i <= 20; i++) {
    await post({
      event_id: uuid(),
      event_type: 'video.watch_started',
      timestamp: new Date().toISOString(),
      creator_id: CREATOR_ID,
      creator_rumble_handle: CREATOR_HANDLE,
      video_id: VIDEO_ID,
      viewer_id: `viewer_${i}`,
      session_id: uuid(),
      watch_percent: 0,
      watch_seconds: 0,
    });
  }
  console.log('✅ Event: 20 viewers started watching');
  await sleep(500);

  for (let i = 1; i <= 15; i++) {
    await post({
      event_id: uuid(),
      event_type: 'video.watch_progress',
      timestamp: new Date().toISOString(),
      creator_id: CREATOR_ID,
      creator_rumble_handle: CREATOR_HANDLE,
      video_id: VIDEO_ID,
      viewer_id: `viewer_${i}`,
      session_id: uuid(),
      watch_percent: 50,
      watch_seconds: 150,
    });
    await sleep(50);
  }
  console.log('✅ Event: 15 viewers hit 50% → auto-tip agent fired for each');
  await sleep(500);

  for (let i = 1; i <= 10; i++) {
    await post({
      event_id: uuid(),
      event_type: 'video.watch_completed',
      timestamp: new Date().toISOString(),
      creator_id: CREATOR_ID,
      creator_rumble_handle: CREATOR_HANDLE,
      video_id: VIDEO_ID,
      viewer_id: `viewer_${i}`,
      session_id: uuid(),
      watch_percent: 100,
      watch_seconds: 300,
    });
    await sleep(50);
  }
  console.log('✅ Event: 10 viewers completed video → completion bonus tips fired');
  await sleep(500);

  await post({
    event_id: uuid(),
    event_type: 'livestream.milestone',
    timestamp: new Date().toISOString(),
    creator_id: CREATOR_ID,
    creator_rumble_handle: CREATOR_HANDLE,
    milestone_type: 'viewer_count',
    milestone_value: 100,
  });
  console.log('✅ Event: Livestream hit 100 viewer milestone → milestone tip triggered');
  await sleep(500);

  for (let i = 1; i <= 3; i++) {
    await post({
      event_id: uuid(),
      event_type: 'livestream.super_chat',
      timestamp: new Date().toISOString(),
      creator_id: CREATOR_ID,
      creator_rumble_handle: CREATOR_HANDLE,
      viewer_id: `whale_viewer_${i}`,
      message: `Amazing stream! #${i}`,
      amount_usd_cents: 500 * i,
      token: i === 3 ? 'XAUT' : 'USDT',
    });
    await sleep(200);
  }
  console.log('✅ Event: 3 super chats received → registered in quadratic round (including 1 premium XAU₮ tip)');
  await sleep(500);

  console.log('\n📊 Simulation complete. Check the dashboard at http://localhost:3000');
  console.log('   The auto-tips from many viewers should outweigh a few whale super chats');
  console.log('   in the quadratic allocation — this is the FLOW × Rumble value proposition.\n');
}

runSimulation().catch(console.error);
