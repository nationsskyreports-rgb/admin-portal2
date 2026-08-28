/* ══ BREAK CHANGES REPORT ══ */
(function initBC() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const first = today.slice(0,7) + '-01';
  document.getElementById('bc-from').value = first;
  document.getElementById('bc-to').value   = today;
  db.from('agents').select('id,formal_name').eq('status','Active').order('formal_name')
    .then(({ data }) => {
      const sel = document.getElementById('bc-agent');
      (data||[]).forEach(a => sel.add(new Option(a.formal_name, a.id)));
    });
})();

function bcTimeDiff(ref, actual) {
  if (!ref || !actual) return null;
  const [rh, rm] = ref.substring(0,5).split(':').map(Number);
  const [ah, am] = actual.substring(0,5).split(':').map(Number);
  return (ah * 60 + am) - (rh * 60 + rm);
}

function bcChip(diff, threshold) {
  if (diff === null) return '<span style="color:var(--muted);font-size:11px;">N/A</span>';
  const sign  = diff > 0 ? '+' : '';
  const abs   = Math.abs(diff);
  const color = abs <= threshold ? '#10b981' : diff > 0 ? '#ef4444' : '#3b82f6';
  const icon  = abs <= threshold ? '✅' : diff > 0 ? '🔴' : '🔵';
  return `<span style="font-family:monospace;font-size:12px;font-weight:800;color:${color};">${icon} ${sign}${diff}m</span>`;
}

function parseShiftTime(s) {
  if (!s) return { start: null, end: null };
  const p = s.split(' - ');
  return { start: p[0]?.trim() || null, end: p[1]?.trim() || null };
}

/* ── Build an override map from approved Break Change requests ──
   Key: "{agent_id}_{date}_{slot}"  →  approved requested_time string
   slot is one of: break1 | lunch | break2
*/
async function buildBreakOverrides(from, to, agentF) {
  const slotMap = { 'Break 1': 'break1', 'Lunch': 'lunch', 'Break 2': 'break2' };
  const overrides = {};
  try {
    // Pull a slightly wider window so requests submitted just after midnight don't get missed
    const fromTs = from + 'T00:00:00.000Z';
    const toTs   = to   + 'T23:59:59.999Z';
    let q = db.from('requests')
      .select('agent_id, details, status, created_at')
      .eq('type', 'Break Change')
      .in('status', ['Approved', 'Pending'])   // Pending = auto-approved / not yet actioned
      .gte('created_at', fromTs)
      .lte('created_at', toTs);
    if (agentF) q = q.eq('agent_id', agentF);
    const { data } = await q;
    (data || []).forEach(r => {
      try {
        const d = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
        const slot = slotMap[d.break_type];
        const reqTime = d.new_time || d.requested_time; // canonical field is new_time
        if (!slot || !reqTime) return;
        // Prefer an explicit date in the details; fall back to the created_at date in Cairo tz
        const date = d.date || new Date(r.created_at)
          .toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
        overrides[`${r.agent_id}_${date}_${slot}`] = reqTime;
      } catch(e) { /* malformed details — skip */ }
    });
  } catch(e) { /* non-critical — adherence still works without overrides */ }
  return overrides;
}

async function loadBreakChanges() {
  const from    = document.getElementById('bc-from').value;
  const to      = document.getElementById('bc-to').value;
  const agentF  = document.getElementById('bc-agent').value;
  const wrap    = document.getElementById('bc-table-wrap');
  const kpiWrap = document.getElementById('bc-kpis');
  if (!from || !to) { showToast('Select date range','warning'); return; }

  wrap.innerHTML    = '<div class="loading-wrap"><div class="spinner"></div></div>';
  kpiWrap.innerHTML = '';

  const TOL_BRK   = getTolerance().brk;
  const TOL_LOGIN = getTolerance().login;

  try {
    let brkQ = db.from('breaks')
      .select('agent_id, break_date, shift_time, break1, lunch, break2, agents(formal_name)')
      .gte('break_date', from).lte('break_date', to)
      .order('break_date', { ascending: false });
    if (agentF) brkQ = brkQ.eq('agent_id', agentF);
    const { data: brkData, error: brkErr } = await brkQ;
    if (brkErr) throw brkErr;

    let perfQ = db.from('daily_performance')
      .select('agent_id, perf_date, login_time, logout_time, actual_break1, actual_lunch, actual_break2')
      .gte('perf_date', from).lte('perf_date', to);
    if (agentF) perfQ = perfQ.eq('agent_id', agentF);
    const { data: perfData, error: perfErr } = await perfQ;
    if (perfErr) throw perfErr;

    // ── FIX: fetch approved Break Change requests and build override map ──
    const breakOverrides = await buildBreakOverrides(from, to, agentF);
    // Returns: { "agentId_date_slot": "HH:MM" }
    // When an agent had an approved break change, use the requested time as the reference
    // instead of the original scheduled time from the breaks table.
    const getRef = (agentId, date, slot, original) =>
      breakOverrides[`${agentId}_${date}_${slot}`] || original;

    const perfMap = {};
    const offsetHours = (function() {
      const el = document.getElementById('time-adjust');
      return el ? parseInt(el.value, 10) || 0 : 0;
    })();
    const adjT = t => {
      if (!t || offsetHours === 0) return t;
      const parts = t.split(':').map(Number);
      const totalSec = parts[0]*3600 + parts[1]*60 + (parts[2]||0) + offsetHours*3600;
      const adj = ((totalSec % 86400) + 86400) % 86400;
      return `${Math.floor(adj/3600).toString().padStart(2,'0')}:${Math.floor((adj%3600)/60).toString().padStart(2,'0')}:${Math.floor(adj%60).toString().padStart(2,'0')}`;
    };
    (perfData || []).forEach(p => {
      const adjusted = Object.assign({}, p);
      if (offsetHours !== 0) {
        adjusted.login_time    = adjT(p.login_time);
        adjusted.logout_time   = adjT(p.logout_time);
        adjusted.actual_break1 = adjT(p.actual_break1);
        adjusted.actual_lunch  = adjT(p.actual_lunch);
        adjusted.actual_break2 = adjT(p.actual_break2);
      }
      perfMap[p.agent_id + '_' + p.perf_date] = adjusted;
    });

    const fmt = t => t ? t.substring(0,5) : '—';

    const rows = [];
    (brkData || []).forEach(b => {
      const perf  = perfMap[b.agent_id + '_' + b.break_date];
      if (!perf) return;
      const shift = parseShiftTime(b.shift_time);
      const name  = b.agents?.formal_name || '—';

      // Use approved break change times as reference when available
      const b1Ref    = getRef(b.agent_id, b.break_date, 'break1', b.break1);
      const lunchRef = getRef(b.agent_id, b.break_date, 'lunch',  b.lunch);
      const b2Ref    = getRef(b.agent_id, b.break_date, 'break2', b.break2);

      const loginDiff  = bcTimeDiff(shift.start,  perf.login_time);
      const logoutDiff = bcTimeDiff(shift.end,     perf.logout_time);
      const b1Diff     = bcTimeDiff(b1Ref,         perf.actual_break1);
      const lunchDiff  = bcTimeDiff(lunchRef,      perf.actual_lunch);
      const b2Diff     = bcTimeDiff(b2Ref,         perf.actual_break2);

      // Consistent with monthly adherence: late login, late breaks, early logout
      const isLate = [
        loginDiff  !== null && loginDiff  > TOL_LOGIN,     // late login
        b1Diff     !== null && b1Diff     > TOL_BRK,       // late break 1
        lunchDiff  !== null && lunchDiff  > TOL_BRK,       // late lunch
        b2Diff     !== null && b2Diff     > TOL_BRK,       // late break 2
        logoutDiff !== null && logoutDiff < -TOL_LOGIN,    // early logout
      ].some(Boolean);

      rows.push({ agentId: b.agent_id, agent: name, date: b.break_date, shift: b.shift_time || '—',
        loginRef: shift.start, loginAct: fmt(perf.login_time), loginDiff,
        logoutRef: shift.end,  logoutAct: fmt(perf.logout_time), logoutDiff,
        b1Ref: fmt(b1Ref), b1Act: fmt(perf.actual_break1), b1Diff,
        lunchRef: fmt(lunchRef), lunchAct: fmt(perf.actual_lunch), lunchDiff,
        b2Ref: fmt(b2Ref), b2Act: fmt(perf.actual_break2), b2Diff,
        isLate,
      });
    });

    const total      = rows.length;
    const lateCount  = rows.filter(r => r.isLate).length;
    const lateLogins = rows.filter(r => r.loginDiff !== null && r.loginDiff > TOL_LOGIN).length;
    const lateBreaks = rows.reduce((s,r) =>
      s + [r.b1Diff,r.lunchDiff,r.b2Diff].filter(d => d !== null && d > TOL_BRK).length, 0);
    const agentCount = [...new Set(rows.map(r => r.agent))].length;

    kpiWrap.innerHTML = [
      ['Days Tracked',    total,      'var(--gold)'],
      ['❌ Has Violation', lateCount,  '#ef4444'],
      ['✅ All On Time',   total-lateCount, '#10b981'],
      ['⏰ Late Logins',  lateLogins, '#f59e0b'],
      ['☕ Late Breaks',  lateBreaks, '#8b5cf6'],
      ['👥 Agents',       agentCount, 'var(--blue)'],
    ].map(([label, val, color]) => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">${label}</div>
        <div style="font-size:26px;font-weight:800;color:${color};">${val}</div>
      </div>`).join('');

    if (!rows.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:32px;"><span class="empty-icon">📭</span>No xCALLY data — import a report first</div>';
      return;
    }

    let html = `<table class="nos-table" style="width:100%;font-size:12px;">
      <thead>
        <tr>
          <th rowspan="2" style="text-align:left;min-width:130px;">Agent</th>
          <th rowspan="2">Date</th>
          <th rowspan="2">Shift</th>
          <th colspan="3" style="border-left:2px solid var(--border);background:rgba(59,130,246,.08);">⏰ Login In</th>
          <th colspan="3" style="border-left:2px solid var(--border);background:rgba(59,130,246,.04);">🚪 Login Out</th>
          <th colspan="3" style="border-left:2px solid var(--border);background:rgba(212,175,55,.08);">☕ Break 1</th>
          <th colspan="3" style="border-left:2px solid var(--border);background:rgba(16,185,129,.08);">🍽️ Lunch</th>
          <th colspan="3" style="border-left:2px solid var(--border);background:rgba(139,92,246,.08);">🫖 Break 2</th>
          <th rowspan="2"></th>
        </tr>
        <tr>
          <th style="border-left:2px solid var(--border);">Sched</th><th>Actual</th><th>Diff</th>
          <th style="border-left:2px solid var(--border);">Sched</th><th>Actual</th><th>Diff</th>
          <th style="border-left:2px solid var(--border);">Sched</th><th>Actual</th><th>Diff</th>
          <th style="border-left:2px solid var(--border);">Sched</th><th>Actual</th><th>Diff</th>
          <th style="border-left:2px solid var(--border);">Sched</th><th>Actual</th><th>Diff</th>
        </tr>
      </thead><tbody>`;

    rows.forEach(r => {
      const rowBg = r.isLate ? 'background:rgba(239,68,68,.04);' : '';
      html += `<tr style="${rowBg}">
        <td style="text-align:left;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="agent-avatar" style="width:26px;height:26px;font-size:9px;">${initials(r.agent)}</div>
            <strong>${r.agent}</strong>
          </div>
        </td>
        <td style="color:var(--gold);font-weight:700;white-space:nowrap;">${r.date}</td>
        <td style="font-size:11px;color:var(--muted);white-space:nowrap;">${r.shift}</td>

        <td style="border-left:2px solid var(--border);font-family:monospace;font-size:11px;">${r.loginRef||'—'}</td>
        <td style="font-family:monospace;font-size:11px;font-weight:700;">${r.loginAct}</td>
        <td>${bcChip(r.loginDiff, TOL_LOGIN)}</td>

        <td style="border-left:2px solid var(--border);font-family:monospace;font-size:11px;">${r.logoutRef||'—'}</td>
        <td style="font-family:monospace;font-size:11px;font-weight:700;">${r.logoutAct}</td>
        <td>${bcChip(r.logoutDiff, TOL_LOGIN)}</td>

        <td style="border-left:2px solid var(--border);font-family:monospace;font-size:11px;">${r.b1Ref}</td>
        <td style="font-family:monospace;font-size:11px;font-weight:700;">${r.b1Act}</td>
        <td>${bcChip(r.b1Diff, TOL_BRK)}</td>

        <td style="border-left:2px solid var(--border);font-family:monospace;font-size:11px;">${r.lunchRef}</td>
        <td style="font-family:monospace;font-size:11px;font-weight:700;">${r.lunchAct}</td>
        <td>${bcChip(r.lunchDiff, TOL_BRK)}</td>

        <td style="border-left:2px solid var(--border);font-family:monospace;font-size:11px;">${r.b2Ref}</td>
        <td style="font-family:monospace;font-size:11px;font-weight:700;">${r.b2Act}</td>
        <td>${bcChip(r.b2Diff, TOL_BRK)}</td>

        <td>${r.isLate
          ? `<button class="btn btn-ghost btn-sm" onclick="addDeviationFromBreak('${r.agent}','${r.date}','Break','${r.loginRef||''}','${r.loginAct}',${r.loginDiff||0})">
               <i class="fas fa-plus"></i> Deviation</button>`
          : ''}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;

  } catch(e) {
    wrap.innerHTML = `<div class="empty-state" style="padding:32px;color:var(--danger);">❌ ${e.message}</div>`;
  }
}

async function addDeviationFromBreak(agentName, date, breakType, sched, actual, diffMins) {
  const session  = checkAuth();
  const agentRes = await db.from('agents').select('id').eq('formal_name', agentName).single();
  if (!agentRes.data) { showToast('Agent not found','error'); return; }

  openModal(
    'Add Deviation',
    `Add deviation for ${agentName}?\n${breakType} on ${date}: Committed ${sched} — Actual ${actual} (${diffMins > 0 ? '+' : ''}${diffMins} min)`,
    async () => {
      const { error } = await db.from('adherence_deviations').insert({
        agent_id:          agentRes.data.id,
        agent_name:        agentName,
        deviation_date:    date,
        deviation_type:    'Long Break',
        scheduled_value:   sched,
        actual_value:      actual,
        deviation_minutes: Math.abs(diffMins),
        notes:             `xCALLY: ${breakType} — Committed ${sched} → Actual ${actual}`,
        source:            'Manual',
        created_by:        session?.username || 'Admin',
      });
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      logAudit({ module: 'Adherence', action: 'INSERT', targetTable: 'adherence_deviations',
        description: `Added Long Break deviation for ${agentName} on ${date}: ${breakType} — committed ${sched} → actual ${actual} (${Math.abs(diffMins)} min)` });
      showToast('Deviation added ✅', 'success');
    }
  );
}
