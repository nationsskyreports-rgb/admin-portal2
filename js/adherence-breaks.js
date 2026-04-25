/* ══ BREAK CHANGES REPORT ══ */
(function initBC() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const first = today.slice(0,7) + '-01';
  document.getElementById('bc-from').value = first;
  document.getElementById('bc-to').value   = today;
  // Populate agents dropdown
  db.from('agents').select('id,formal_name').eq('status','Active').order('formal_name')
    .then(({ data }) => {
      const sel = document.getElementById('bc-agent');
      (data||[]).forEach(a => sel.add(new Option(a.formal_name, a.id)));
    });
})();

async function loadBreakChanges() {
  const from    = document.getElementById('bc-from').value;
  const to      = document.getElementById('bc-to').value;
  const agentF  = document.getElementById('bc-agent').value;
  const wrap    = document.getElementById('bc-table-wrap');
  const kpiWrap = document.getElementById('bc-kpis');
  if (!from || !to) { showToast('Select date range','warning'); return; }

  wrap.innerHTML    = '<div class="loading-wrap"><div class="spinner"></div></div>';
  kpiWrap.innerHTML = '';

  const THRESHOLD = getTolerance().brk;

  try {
    // 1. Reference — last committed time per agent (breaks table)
    let brkQ = db.from('breaks')
      .select('agent_id, break_date, shift_time, break1, lunch, break2, agents(formal_name)')
      .gte('break_date', from)
      .lte('break_date', to)
      .order('break_date', { ascending: false });
    if (agentF) brkQ = brkQ.eq('agent_id', agentF);
    const { data: brkData, error: brkErr } = await brkQ;
    if (brkErr) throw brkErr;

    // 2. Actual — from xCALLY via daily_performance
    let perfQ = db.from('daily_performance')
      .select('agent_id, perf_date, actual_break1, actual_lunch, actual_break2')
      .gte('perf_date', from)
      .lte('perf_date', to);
    if (agentF) perfQ = perfQ.eq('agent_id', agentF);
    const { data: perfData, error: perfErr } = await perfQ;
    if (perfErr) throw perfErr;

    const perfMap = {};
    (perfData || []).forEach(p => { perfMap[p.agent_id + '_' + p.perf_date] = p; });

    function timeDiffMins(ref, actual) {
      if (!ref || !actual) return null;
      const [rh, rm] = ref.substring(0,5).split(':').map(Number);
      const [ah, am] = actual.substring(0,5).split(':').map(Number);
      return (ah * 60 + am) - (rh * 60 + rm);
    }

    const rows = [];
    (brkData || []).forEach(b => {
      const name = b.agents?.formal_name || '—';
      const perf = perfMap[b.agent_id + '_' + b.break_date];
      if (!perf) return;
      [
        { type: 'Break 1', ref: b.break1, actual: perf.actual_break1 },
        { type: 'Lunch',   ref: b.lunch,  actual: perf.actual_lunch  },
        { type: 'Break 2', ref: b.break2, actual: perf.actual_break2 },
      ].forEach(br => {
        const diff = timeDiffMins(br.ref, br.actual);
        if (diff === null) return;
        rows.push({
          agentId: b.agent_id,
          agent:   name,
          date:    b.break_date,
          shift:   b.shift_time || '—',
          type:    br.type,
          ref:     br.ref    ? br.ref.substring(0,5)    : '—',
          actual:  br.actual ? br.actual.substring(0,5) : '—',
          diff,
          flag:    Math.abs(diff) > THRESHOLD,
        });
      });
    });

    const total   = rows.length;
    const flagged = rows.filter(r => r.flag).length;
    const ok      = total - flagged;
    const agents  = [...new Set(rows.map(r => r.agent))].length;

    kpiWrap.innerHTML = `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Total Breaks</div>
        <div style="font-size:26px;font-weight:800;color:var(--gold);">${total}</div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Late > ±${THRESHOLD}m ⚠️</div>
        <div style="font-size:26px;font-weight:800;color:#ef4444;">${flagged}</div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">✅ On Time</div>
        <div style="font-size:26px;font-weight:800;color:#10b981;">${ok}</div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Agents</div>
        <div style="font-size:26px;font-weight:800;color:var(--blue);">${agents}</div>
      </div>`;

    if (!rows.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:32px;"><span class="empty-icon">✅</span>No xCALLY data found — import a report first</div>';
      return;
    }

    let html = `<table class="nos-table" style="width:100%;">
      <thead><tr>
        <th>Agent</th><th>Date</th><th>Shift</th><th>Type</th>
        <th>Committed</th><th>Actual (xCALLY)</th><th>Diff</th><th>Status</th><th></th>
      </tr></thead><tbody>`;

    rows.forEach(r => {
      const diffStr   = r.diff > 0 ? `+${r.diff}m` : `${r.diff}m`;
      const diffColor = r.diff > 0 ? '#ef4444' : r.diff < 0 ? '#3b82f6' : '#10b981';
      const status    = r.flag
        ? '<span class="badge badge-danger">⚠️ Late</span>'
        : '<span class="badge badge-success">✅ On Time</span>';
      const addBtn = r.flag
        ? `<button class="btn btn-ghost btn-sm" onclick="addDeviationFromBreak('${r.agent}','${r.date}','${r.type}','${r.ref}','${r.actual}',${r.diff})"><i class="fas fa-plus"></i> Deviation</button>`
        : '';
      html += `<tr>
        <td><div style="display:flex;align-items:center;gap:8px;">
          <div class="agent-avatar" style="width:26px;height:26px;font-size:9px;">${initials(r.agent)}</div>
          <strong>${r.agent}</strong></div></td>
        <td style="color:var(--gold);font-weight:700;">${r.date}</td>
        <td style="font-size:12px;color:var(--muted);">${r.shift}</td>
        <td>${r.type}</td>
        <td style="font-family:monospace;">${r.ref}</td>
        <td style="font-family:monospace;font-weight:700;">${r.actual}</td>
        <td style="color:${diffColor};font-weight:800;font-family:monospace;">${diffStr}</td>
        <td>${status}</td>
        <td>${addBtn}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;

  } catch(e) {
    wrap.innerHTML = `<div class="empty-state" style="padding:32px;color:var(--danger);">❌ ${e.message}</div>`;
  }
}



async function addDeviationFromBreak(agentName, date, breakType, sched, actual, diffMins) {
  const session = checkAuth();
  const agentRes = await db.from('agents').select('id').eq('formal_name', agentName).single();
  if (!agentRes.data) { showToast('Agent not found','error'); return; }

  const confirmed = confirm(`Add Deviation for ${agentName}?\n${breakType}: Scheduled ${sched} — Actual ${actual} (${diffMins > 0 ? '+' : ''}${diffMins} min)`);
  if (!confirmed) return;

  const { error } = await db.from('adherence_deviations').insert({
    agent_id:          agentRes.data.id,
    agent_name:        agentName,
    deviation_date:    date,
    deviation_type:    'Long Break',
    scheduled_value:   sched,
    actual_value:      actual,
    deviation_minutes: Math.abs(diffMins),
    notes:             `Break Change: ${breakType} — Scheduled ${sched} → Actual ${actual}`,
    source:            'Manual',
    created_by:        session?.username || 'Admin',
  });

  if (error) { showToast('Failed: ' + error.message, 'error'); return; }
  showToast('Deviation added ✅', 'success');
}
