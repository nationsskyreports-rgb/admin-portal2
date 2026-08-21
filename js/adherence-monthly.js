/* ══════════════════════════════════════════════════════════════
   MONTHLY ADHERENCE — Duration-based (industry-standard)
   ──────────────────────────────────────────────────────────────
   PRIMARY metric  : Schedule Adherence % (duration-based)
       Adherence % = (Target − NotLoggedIn − BreakOverrun) ÷ Target
       Target       = scheduled shift length − approved excuses
       NotLoggedIn  = max(0, Target − LoginTime)          // LoginTime = active_sec
       ExtraLogin   = max(0, LoginTime − Target)
       BreakOverrun = max(0, PersonalBreak − Allowance − ExtraLogin)
       Allowance    = 1h paid break/day  (ALLOWANCE_SEC)
       MTD          = Σ Adherent ÷ Σ Target   (NOT the average of daily %)
   SECONDARY metric: Clean Days (day-based punctuality) — for coaching only.
   Requires daily_performance.personal_break_sec (see migration SQL).
══════════════════════════════════════════════════════════════ */

// ── Config ──
const ALLOWANCE_SEC = 3600;   // 1 hour paid personal-break allowance per day (all breaks pooled)
const WC_CAP_SEC    = 900;    // WC (bathroom) hard sub-cap: 15 min. Excess deducted on top of the pool.
const EXCUSE_SEC     = 7200;  // each approved excuse deducts 2h from target (matches Excuses page)

// ── Module-level cache for export ──
let lastMonthlyRows  = [];
let lastMonthlyLabel = '';

// ── Tab switch ──
function switchAdhTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-deviations').style.display = tab === 'deviations' ? 'block' : 'none';
  document.getElementById('tab-monthly').style.display    = tab === 'monthly'    ? 'block' : 'none';
  if (tab === 'monthly') populateMonthAgents();
}

// ── Tolerance settings (localStorage) — used by the secondary Clean-Days view ──
const TOL_KEYS = { login: 'nos_tol_login', break: 'nos_tol_break' };

function loadTolerance() {
  const login = parseInt(localStorage.getItem(TOL_KEYS.login) ?? '4');
  const brk   = parseInt(localStorage.getItem(TOL_KEYS.break) ?? '2');
  document.getElementById('tol-login').value = login;
  document.getElementById('tol-break').value = brk;
  document.getElementById('tol-login-preview').innerText = login;
  document.getElementById('tol-break-preview').innerText = brk;
  document.getElementById('tol-login').oninput = () =>
    document.getElementById('tol-login-preview').innerText = document.getElementById('tol-login').value;
  document.getElementById('tol-break').oninput = () =>
    document.getElementById('tol-break-preview').innerText = document.getElementById('tol-break').value;
}

function saveTolerance() {
  const login = parseInt(document.getElementById('tol-login').value) || 3;
  const brk   = parseInt(document.getElementById('tol-break').value) || 2;
  localStorage.setItem(TOL_KEYS.login, login);
  localStorage.setItem(TOL_KEYS.break, brk);
  showToast('Tolerance settings saved ✅', 'success');
}

function getTolerance() {
  return {
    login: parseInt(localStorage.getItem(TOL_KEYS.login) ?? '4'),
    brk:   parseInt(localStorage.getItem(TOL_KEYS.break) ?? '2'),
  };
}

// ── Init monthly tab ──
(function initMonthly() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const mp = document.getElementById('month-picker');
  if (mp) mp.value = today.slice(0, 7);
  loadTolerance();
})();

function populateMonthAgents() {
  const sel = document.getElementById('month-agent');
  if (sel.options.length > 1) return;
  allAgents.forEach(a => sel.add(new Option(a.formal_name, a.id)));
}

/* ────────────────────────── Time helpers ────────────────────────── */

// "HH:MM:SS" | "HH:MM" → seconds
function timeStrToSec(t) {
  if (!t) return null;
  const p = String(t).split(':').map(Number);
  if (p.some(isNaN)) return null;
  return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
}

// scheduled shift length in seconds (handles overnight shifts)
function shiftLenSec(start, end) {
  const s = timeStrToSec(start), e = timeStrToSec(end);
  if (s === null || e === null) return null;
  let len = e - s;
  if (len <= 0) len += 86400;   // crosses midnight
  return len;
}

function secToHM(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function secToClock(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ─────────────── Secondary (Clean-Days / punctuality) helpers ─────────────── */

function timeToMinsAdh(t) {
  if (!t) return null;
  const p = t.substring(0, 5).split(':');
  return (+p[0]) * 60 + (+p[1]);
}

function checkTime(scheduled, actual, toleranceMins) {
  const sMin = timeToMinsAdh(scheduled);
  const aMin = timeToMinsAdh(actual);
  if (sMin === null || aMin === null) return { status: 'no-data', diff: null };
  const diff = aMin - sMin;
  if (Math.abs(diff) <= toleranceMins) return { status: 'ok', diff };
  if (diff > toleranceMins)            return { status: 'late', diff };
  return                                      { status: 'early', diff };
}

/* ─────────────── Adherence % → colour ─────────────── */
function adhColor(pct) {
  return pct >= 90 ? '#10B981' : pct >= 80 ? '#f59e0b' : '#ef4444';
}
function adhBadge(pct) {
  const c = adhColor(pct);
  return `<span style="font-weight:800;color:${c};font-size:13px;">${pct.toFixed(1)}%</span>`;
}

/* ══════════════════════════ MAIN LOAD ══════════════════════════ */
async function loadMonthlyAdherence() {
  const monthVal  = document.getElementById('month-picker').value; // YYYY-MM
  const agentFilt = document.getElementById('month-agent').value;
  if (!monthVal) { showToast('Select a month first', 'warning'); return; }

  const [year, month] = monthVal.split('-').map(Number);
  const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay    = new Date(year, month, 0).getDate();
  const monthEnd   = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

  const tol = getTolerance();

  document.getElementById('monthly-grid').innerHTML =
    '<div class="loading-wrap" style="padding:40px;"><div class="spinner"></div></div>';
  document.getElementById('monthly-kpis').style.display = 'none';
  document.getElementById('agent-summary-card').style.display = 'none';
  document.getElementById('monthly-row-count').innerText = '';

  try {
    // 1. Schedule (work days + shift start/end)
    let schQ = db.from('schedule')
      .select('agent_id, shift_date, shift_types(start_time, end_time)')
      .gte('shift_date', monthStart)
      .lte('shift_date', monthEnd)
      .eq('day_type', 'Work');
    if (agentFilt) schQ = schQ.eq('agent_id', agentFilt);
    const { data: schedules, error: schErr } = await schQ;
    if (schErr) throw schErr;

    // 2. Breaks (scheduled break times — for the secondary clean-days view)
    let brkQ = db.from('breaks')
      .select('agent_id, break_date, break1, lunch, break2')
      .gte('break_date', monthStart)
      .lte('break_date', monthEnd);
    if (agentFilt) brkQ = brkQ.eq('agent_id', agentFilt);
    const { data: breaks, error: brkErr } = await brkQ;
    if (brkErr) throw brkErr;

    // 3. Daily performance (login duration + personal-break duration + break start times)
    let perfQ = db.from('daily_performance')
      .select('agent_id, perf_date, active_sec, personal_break_sec, wc_sec, login_time, actual_break1, actual_lunch, actual_break2')
      .gte('perf_date', monthStart)
      .lte('perf_date', monthEnd);
    if (agentFilt) perfQ = perfQ.eq('agent_id', agentFilt);
    const { data: perfs, error: perfErr } = await perfQ;
    if (perfErr) throw perfErr;

    // 4. Approved excuses (reduce target — 2h each, matches Excuses page)
    const { data: excuses, error: excErr } = await db.from('excuses')
      .select('agent_id, excuse_date, status')
      .eq('status', 'Approved')
      .gte('excuse_date', monthStart)
      .lte('excuse_date', monthEnd);
    if (excErr) throw excErr;

    // ── Index data ──
    const schedMap = {};
    (schedules || []).forEach(s => { schedMap[s.agent_id + '_' + s.shift_date] = s.shift_types; });

    const brkMap = {};
    (breaks || []).forEach(b => { brkMap[b.agent_id + '_' + b.break_date] = b; });

    const excMap = {}; // "agentId_date" → count of approved excuses
    (excuses || []).forEach(e => {
      const k = e.agent_id + '_' + e.excuse_date;
      excMap[k] = (excMap[k] || 0) + 1;
    });

    // time-adjust offset (applies only to clock-time fields, not durations)
    const offsetHours = (function() {
      const el = document.getElementById('time-adjust');
      return el ? parseInt(el.value, 10) || 0 : 0;
    })();
    const adjT = t => {
      if (!t || offsetHours === 0) return t;
      const parts = t.split(':').map(Number);
      const total = parts[0]*3600 + parts[1]*60 + (parts[2]||0) + offsetHours*3600;
      const a = ((total % 86400) + 86400) % 86400;
      return `${String(Math.floor(a/3600)).padStart(2,'0')}:${String(Math.floor((a%3600)/60)).padStart(2,'0')}:${String(a%60).padStart(2,'0')}`;
    };

    const perfMap = {};
    (perfs || []).forEach(p => {
      perfMap[p.agent_id + '_' + p.perf_date] = {
        active_sec:         p.active_sec,
        personal_break_sec: p.personal_break_sec,
        wc_sec:             p.wc_sec,
        login_time:    adjT(p.login_time),
        actual_break1: adjT(p.actual_break1),
        actual_lunch:  adjT(p.actual_lunch),
        actual_break2: adjT(p.actual_break2),
      };
    });

    const agentIds  = [...new Set((schedules || []).map(s => s.agent_id))];
    const agentObjs = allAgents.filter(a => agentIds.includes(a.id));

    // ── Build one row per scheduled work day ──
    const allRows = [];
    lastMonthlyLabel = monthVal;

    (schedules || []).forEach(s => {
      const agent = agentObjs.find(a => a.id === s.agent_id);
      if (!agent) return;
      const shiftInfo = schedMap[s.agent_id + '_' + s.shift_date];
      const brkRecord = brkMap[s.agent_id + '_' + s.shift_date];
      const perf      = perfMap[s.agent_id + '_' + s.shift_date];

      // ---- target (duration-based) ----
      const rawShift = shiftLenSec(shiftInfo?.start_time, shiftInfo?.end_time) || 28800;
      const excCount = excMap[s.agent_id + '_' + s.shift_date] || 0;
      const excSec   = Math.min(rawShift, excCount * EXCUSE_SEC);
      const target   = Math.max(0, rawShift - excSec);

      // ---- actuals ----
      const hasPerf  = perf && perf.active_sec != null;
      const login    = hasPerf ? perf.active_sec : null;
      const personal = hasPerf ? (perf.personal_break_sec || 0) : 0;   // all four breaks incl WC
      const wc       = hasPerf ? (perf.wc_sec || 0) : 0;

      // ---- duration-based adherence (with WC 15-min sub-cap) ----
      // Pool = Break1 + Break2 + Lunch + min(WC, 15m), against the 1h allowance.
      // WC beyond 15m is a hard overrun on top of the pool (penalised even if pool < 1h).
      let adherentSec = null, adherencePct = null, notLoggedIn = 0, overrun = 0, wcExcess = 0;
      if (hasPerf && target > 0) {
        notLoggedIn      = Math.max(0, target - login);
        const extra      = Math.max(0, login - target);
        const nonWC      = Math.max(0, personal - wc);
        const wcCounted  = Math.min(wc, WC_CAP_SEC);
        wcExcess         = Math.max(0, wc - WC_CAP_SEC);
        const pool       = nonWC + wcCounted;
        const poolOver   = Math.max(0, pool - ALLOWANCE_SEC);
        overrun          = Math.max(0, poolOver + wcExcess - extra);
        adherentSec      = target - notLoggedIn - overrun;
        adherencePct     = (adherentSec / target) * 100;
      }

      // ---- secondary clean-day (punctuality) ----
      const loginRes = checkTime(shiftInfo?.start_time, perf?.login_time,    tol.login);
      const b1Res    = checkTime(brkRecord?.break1,      perf?.actual_break1, tol.brk);
      const lunchRes = checkTime(brkRecord?.lunch,       perf?.actual_lunch,  tol.brk);
      const b2Res    = checkTime(brkRecord?.break2,      perf?.actual_break2, tol.brk);
      const punctChecks = [loginRes, b1Res, lunchRes, b2Res];
      const hasPunct    = punctChecks.some(c => c.status !== 'no-data');
      const lateLogin   = loginRes.status === 'late';
      const lateBreaks  = [b1Res, lunchRes, b2Res].filter(c => c.status === 'late').length;
      const cleanDay    = hasPunct && punctChecks.every(c => c.status === 'ok' || c.status === 'early' || c.status === 'no-data') && overrun === 0 && notLoggedIn === 0;

      let dayStatus = 'no-data';
      if (hasPerf) {
        dayStatus = adherencePct >= 90 ? 'ok' : adherencePct >= 80 ? 'partial' : 'bad';
      }

      allRows.push({
        date: s.shift_date, agentId: s.agent_id, agentName: agent.formal_name,
        shiftStart: shiftInfo?.start_time, shiftEnd: shiftInfo?.end_time,
        rawShift, excSec, target, login, personal,
        notLoggedIn, overrun, adherentSec, adherencePct,
        lateLogin, lateBreaks, cleanDay, hasPerf, dayStatus,
      });
    });

    allRows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 :
      a.agentName.localeCompare(b.agentName)));

    if (!allRows.length) {
      document.getElementById('monthly-grid').innerHTML =
        '<div class="empty-state" style="padding:40px;"><span class="empty-icon">📭</span>No working days found for this month</div>';
      return;
    }

    /* ── KPIs (duration-based headline + clean-days secondary) ── */
    const dataRows  = allRows.filter(r => r.hasPerf);
    const sumAdher  = dataRows.reduce((s, r) => s + r.adherentSec, 0);
    const sumTarget = dataRows.reduce((s, r) => s + r.target, 0);
    const mtdPct    = sumTarget > 0 ? (sumAdher / sumTarget) * 100 : 0;

    const cleanDays   = allRows.filter(r => r.cleanDay).length;
    const deviationDays = dataRows.filter(r => !r.cleanDay).length;
    const noDataDays  = allRows.filter(r => !r.hasPerf).length;
    const lateLogins  = allRows.filter(r => r.lateLogin).length;
    const lateBreaks  = allRows.reduce((s, r) => s + r.lateBreaks, 0);

    document.getElementById('mkpi-rate').innerHTML       = `<span style="color:${adhColor(mtdPct)}">${mtdPct.toFixed(1)}%</span>`;
    document.getElementById('mkpi-adherent').innerText   = cleanDays;      // "Adherent Days" → Clean Days
    document.getElementById('mkpi-nonadherent').innerText= deviationDays;  // "Non-Adherent Days"
    document.getElementById('mkpi-latelogin').innerText  = lateLogins;
    document.getElementById('mkpi-latebreak').innerText  = lateBreaks;
    document.getElementById('mkpi-agents').innerText     = agentIds.length;
    document.getElementById('monthly-kpis').style.display = 'block';
    document.getElementById('monthly-row-count').innerText =
      `${allRows.length} records • MTD adherence ${mtdPct.toFixed(2)}% (Σ adherent ÷ Σ target)`;

    lastMonthlyRows = allRows;
    const exportBtn = document.getElementById('monthly-export-btn');
    if (exportBtn) exportBtn.style.display = allRows.length ? 'inline-flex' : 'none';

    /* ── Main grid (duration-based per-day) ── */
    let html = `<table class="adh-table">
      <thead><tr>
        <th class="left" style="min-width:90px;">Date</th>
        <th class="left" style="min-width:130px;">Agent</th>
        <th style="min-width:90px;">Shift</th>
        <th style="min-width:70px;">Target</th>
        <th style="min-width:70px;">Login</th>
        <th style="min-width:80px;">Personal</th>
        <th style="min-width:80px;" title="Time not logged in vs target">Not Logged</th>
        <th style="min-width:80px;" title="Personal break beyond the 1h allowance">Break Over</th>
        <th style="min-width:90px;">Adherence</th>
        <th style="min-width:70px;">Clean</th>
      </tr></thead><tbody>`;

    let lastDate = '';
    allRows.forEach(r => {
      if (r.date !== lastDate) {
        lastDate = r.date;
        const d = new Date(r.date + 'T00:00:00');
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const label = days[d.getDay()] + ' ' + d.toLocaleDateString('en-GB', {day:'2-digit', month:'short'});
        html += `<tr class="date-group"><td colspan="10">${label}</td></tr>`;
      }

      const dayCls = r.dayStatus === 'ok' ? 'adh-day-ok' : r.dayStatus === 'bad' ? 'adh-day-bad'
                   : r.dayStatus === 'partial' ? 'adh-day-part' : '';
      const shiftTxt = r.shiftStart ? `${(r.shiftStart||'').substring(0,5)}-${(r.shiftEnd||'').substring(0,5)}` : '—';
      const excTag   = r.excSec > 0 ? ` <span style="font-size:9px;color:var(--gold);" title="Excused">−${secToHM(r.excSec)}</span>` : '';

      html += `<tr class="${dayCls}">
        <td class="left"></td>
        <td class="left">
          <div style="display:flex;align-items:center;gap:7px;">
            <div class="agent-avatar" style="width:24px;height:24px;font-size:9px;">${initials(r.agentName)}</div>
            <span style="font-weight:700;font-size:12px;">${r.agentName}</span>
          </div>
        </td>
        <td style="font-family:monospace;font-size:11px;color:var(--muted);">${shiftTxt}</td>
        <td style="font-family:monospace;font-size:11px;">${secToHM(r.target)}${excTag}</td>
        <td style="font-family:monospace;font-size:11px;">${r.hasPerf ? secToHM(r.login) : '—'}</td>
        <td style="font-family:monospace;font-size:11px;">${r.hasPerf ? secToHM(r.personal) : '—'}</td>
        <td style="font-family:monospace;font-size:11px;color:${r.notLoggedIn>0?'#ef4444':'var(--muted)'};">${r.hasPerf ? (r.notLoggedIn>0?'−'+secToHM(r.notLoggedIn):'—') : '—'}</td>
        <td style="font-family:monospace;font-size:11px;color:${r.overrun>0?'#ef4444':'var(--muted)'};">${r.hasPerf ? (r.overrun>0?'−'+secToHM(r.overrun):'—') : '—'}</td>
        <td>${r.hasPerf ? adhBadge(r.adherencePct) : '<span class="adh-chip adh-none">⏳ No Data</span>'}</td>
        <td style="font-size:13px;">${r.hasPerf ? (r.cleanDay ? '✅' : '—') : '⏳'}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('monthly-grid').innerHTML = html;

    /* ── Per-agent summary (duration adherence + clean-days) ── */
    const agentMap = {};
    allRows.forEach(r => {
      if (!agentMap[r.agentId]) agentMap[r.agentId] = {
        name: r.agentName, worked: 0, sumAdher: 0, sumTarget: 0,
        clean: 0, deviation: 0, noData: 0, lateLogins: 0, lateBreaks: 0,
      };
      const a = agentMap[r.agentId];
      a.worked++;
      if (r.hasPerf) { a.sumAdher += r.adherentSec; a.sumTarget += r.target; }
      if (!r.hasPerf)      a.noData++;
      else if (r.cleanDay) a.clean++;
      else                 a.deviation++;
      if (r.lateLogin) a.lateLogins++;
      a.lateBreaks += r.lateBreaks;
    });

    const summaryRows = Object.values(agentMap).sort((a, b) => {
      const pa = a.sumTarget > 0 ? a.sumAdher / a.sumTarget : 1;
      const pb = b.sumTarget > 0 ? b.sumAdher / b.sumTarget : 1;
      return pa - pb; // worst adherence first
    });

    const summaryHTML = summaryRows.map(a => {
      const pct = a.sumTarget > 0 ? (a.sumAdher / a.sumTarget) * 100 : 0;
      const barColor = adhColor(pct);
      return `<tr>
        <td class="left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="agent-avatar" style="width:26px;height:26px;font-size:9px;">${initials(a.name)}</div>
            <span style="font-weight:700;">${a.name}</span>
          </div>
        </td>
        <td>${a.worked}</td>
        <td style="color:#10B981;font-weight:700;">${a.clean}</td>
        <td style="color:#ef4444;font-weight:700;">${a.deviation}</td>
        <td style="color:var(--muted);">${a.noData}</td>
        <td style="color:#f59e0b;font-weight:700;">${a.lateLogins}</td>
        <td style="color:#8b5cf6;font-weight:700;">${a.lateBreaks}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;min-width:120px;">
            <div style="flex:1;">
              <div class="summary-bar"><div class="summary-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
            </div>
            <span style="font-weight:800;color:${barColor};font-size:13px;">${pct.toFixed(1)}%</span>
          </div>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('agent-summary-tbody').innerHTML = summaryHTML;
    document.getElementById('agent-summary-card').style.display = 'block';

  } catch (e) {
    document.getElementById('monthly-grid').innerHTML =
      `<div class="empty-state" style="padding:40px;color:var(--danger);"><span class="empty-icon">❌</span>${e.message}</div>`;
    showToast('Failed: ' + e.message, 'error');
  }
}

/* ══════════════════ EXPORT MONTHLY EXCEL ══════════════════ */
function exportMonthlyExcel() {
  if (!lastMonthlyRows.length) { showToast('No data to export', 'warning'); return; }

  const headers = [
    'Date', 'Agent', 'Shift Start', 'Shift End',
    'Shift (h)', 'Excused (h)', 'Target (h)',
    'Login (h)', 'Personal Break (h)',
    'Not Logged In (h)', 'Break Overrun (h)',
    'Adherent (h)', 'Adherence %', 'Clean Day',
  ];

  const H = s => (s == null ? '' : (s / 3600).toFixed(3)); // seconds → decimal hours

  const rows = lastMonthlyRows.map(r => [
    r.date, r.agentName,
    (r.shiftStart || '').substring(0,5), (r.shiftEnd || '').substring(0,5),
    H(r.rawShift), H(r.excSec), H(r.target),
    r.hasPerf ? H(r.login) : '', r.hasPerf ? H(r.personal) : '',
    r.hasPerf ? H(r.notLoggedIn) : '', r.hasPerf ? H(r.overrun) : '',
    r.hasPerf ? H(r.adherentSec) : '',
    r.hasPerf ? r.adherencePct.toFixed(2) : '',
    r.hasPerf ? (r.cleanDay ? 'Yes' : 'No') : 'No Data',
  ]);

  // MTD summary row
  const dataRows  = lastMonthlyRows.filter(r => r.hasPerf);
  const sumAdher  = dataRows.reduce((s, r) => s + r.adherentSec, 0);
  const sumTarget = dataRows.reduce((s, r) => s + r.target, 0);
  const mtd       = sumTarget > 0 ? (sumAdher / sumTarget) * 100 : 0;
  rows.push([]);
  rows.push(['MTD', '', '', '', '', '', H(sumTarget), '', '', '', '', H(sumAdher), mtd.toFixed(2), '']);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    {wch:12},{wch:22},{wch:11},{wch:11},{wch:9},{wch:11},{wch:10},
    {wch:10},{wch:16},{wch:15},{wch:15},{wch:11},{wch:12},{wch:10},
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Adherence (Duration)');
  XLSX.writeFile(wb, `adherence-monthly-${lastMonthlyLabel}.xlsx`);
  showToast('✅ Export complete', 'success');
}
