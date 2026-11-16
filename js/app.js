// Start-up: load what's saved on this device, draw the app, and register the
// offline helper so it opens without a signal.
import { load, state, setErrorHandler, activeWorkout } from './store.js';
import { ui, render, toast, applyThemeColor } from './core.js';
import './home.js';
import './log.js';
import './library.js';
import './insights.js';
import './history.js';
import { showImportResult } from './settings.js';
import * as io from './io.js';
import * as stats from './stats.js';

setErrorHandler(() => toast("Couldn't save that — this device's storage may be full"));

await load();
const act = activeWorkout();
if (act) { ui.openId = act.id; ui.tab = 'log'; } // reopen straight into a workout in progress
applyThemeColor();
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Offline mode unavailable', e));
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'update') toast('Update downloaded — close and reopen Setlist to use it');
  });
}

// Handy for troubleshooting from the browser console
window.Setlist = { state, ui, io, stats, render, showImportResult };
