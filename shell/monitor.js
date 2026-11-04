// Monitor masukan: panel log untuk melihat data mentah dari micro:bit dan kode yang dikirim ke micro:bit.
export function initMonitor(kernel){
  const logEl = document.getElementById('log');
  let paused = false;
  const vis = t => t.replace(/\n/g, '↵').replace(/\r/g, '␍');
  const ts = () => { const d = new Date(); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
  function line(cls, text){
    if (paused) return;
    const d = document.createElement('div');
    d.className = cls; d.textContent = ts() + '  ' + text;
    logEl.appendChild(d);
    while (logEl.children.length > 150) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }
  kernel.on('raw', ({player, text, bytes}) =>
    line('l-rx', 'RX P' + player + '  "' + vis(text) + '"  [' + bytes.map(b => b.toString(16).padStart(2, '0')).join(' ') + ']'));
  kernel.on('input', ({player, cmd, source}) =>
    line(source === 'keyboard' ? 'l-kb' : 'l-cmd', '→ P' + player + '  cmd ' + cmd + '#  (' + source + ')'));
  kernel.on('tx', ({player, text}) => line('l-tx', 'TX P' + player + '  "' + text + '"'));
  kernel.on('warn', t => line('l-warn', 'Peringatan: ' + t));
  kernel.on('players', () =>
    line('l-rx', 'Pemain: ' + kernel.slots.slice(0, kernel.limit).map(s => 'P' + s.n + '=' + (s.type || '-')).join('  ')));
  document.getElementById('logClear').onclick = () => { logEl.innerHTML = ''; };
  document.getElementById('logPause').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Lanjutkan' : 'Jeda'; };
}
