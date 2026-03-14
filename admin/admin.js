// ===================================================
// ===== ATTENDANCE — FILIAL FILTR BILAN =============
// ===================================================
async function renderAttendance(main, selectedBranch) {
  selectedBranch = selectedBranch || '';
  main.innerHTML = '<div style="text-align:center;padding:40px;color:#475569">Yuklanmoqda...</div>';

  // Filiallarni yuklaymiz (har safar yangi)
  var bd = await apiFetch('/admin/branches');
  var branches = (bd && bd.branches) ? bd.branches : [];

  // Davomat
  var url = '/admin/attendance/today' + (selectedBranch ? '?branchId=' + selectedBranch : '');
  var d = await apiFetch(url);
  if (!d.ok) { main.innerHTML = '<div style="color:#f87171;padding:20px">Yuklanmadi</div>'; return; }

  var sum   = d.summary;
  var emps  = d.employees || [];
  var today = new Date().toLocaleDateString('uz-UZ', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Filial tugmalar
  var branchBtns =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' +
      '<button onclick="renderAttendance(document.getElementById(\'mainContent\'),\'\')" style="padding:6px 16px;border-radius:8px;border:1px solid ' + (!selectedBranch ? '#3b82f6' : 'rgba(99,179,237,0.2)') + ';background:' + (!selectedBranch ? 'rgba(59,130,246,0.15)' : 'transparent') + ';color:' + (!selectedBranch ? '#60a5fa' : '#64748b') + ';font-size:12px;cursor:pointer;font-family:inherit">🏢 Barchasi</button>' +
      branches.map(function(b) {
        var act = selectedBranch === b._id;
        return '<button onclick="renderAttendance(document.getElementById(\'mainContent\'),\'' + b._id + '\')" style="padding:6px 16px;border-radius:8px;border:1px solid ' + (act ? '#3b82f6' : 'rgba(99,179,237,0.2)') + ';background:' + (act ? 'rgba(59,130,246,0.15)' : 'transparent') + ';color:' + (act ? '#60a5fa' : '#64748b') + ';font-size:12px;cursor:pointer;font-family:inherit">' + b.name + '</button>';
      }).join('') +
    '</div>';

  var rows = emps.map(function(r) {
    var statusColor = r.status === 'keldi' ? '#22c55e' : '#ef4444';
    var lateTag = r.lateMinutes > 0
      ? '<span style="font-size:10px;background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 6px;border-radius:99px;margin-left:6px">+' + r.lateMinutes + ' min</span>'
      : '';
    var workedStr = r.totalMinutes ? formatMins(r.totalMinutes) : (r.checkIn && !r.checkOut ? '<span style="color:#3b82f6">Ishlayapti</span>' : '—');
    return '<tr style="border-bottom:1px solid rgba(99,179,237,0.07)">' +
      '<td style="padding:12px 10px">' +
        '<div style="font-size:13px;font-weight:600;color:#f1f5f9">' + r.employee.name + lateTag + '</div>' +
        '<div style="font-size:11px;color:#64748b">' + (r.employee.position||'—') + '</div>' +
      '</td>' +
      '<td style="padding:12px 10px">' +
        '<span style="font-size:11px;padding:3px 9px;border-radius:99px;background:' + (r.status==='keldi'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)') + ';color:' + statusColor + ';font-weight:600">' +
          (r.status === 'keldi' ? '✅ Keldi' : r.status === 'dam' ? '🌴 Dam' : '❌ Kelmadi') +
        '</span>' +
      '</td>' +
      '<td style="padding:12px 10px;font-size:13px;color:#94a3b8">' + (r.checkIn||'—') + '</td>' +
      '<td style="padding:12px 10px;font-size:13px;color:#94a3b8">' + (r.checkOut||'—') + '</td>' +
      '<td style="padding:12px 10px;font-size:13px;color:#22c55e">' + workedStr + '</td>' +
      '<td style="padding:12px 10px">' +
        '<button onclick="openManualModal(\'' + r.employee._id + '\',\'' + r.employee.name + '\')" style="padding:4px 10px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#60a5fa;border-radius:6px;font-size:11px;cursor:pointer">✏️</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  main.innerHTML =
    '<div class="fade-up">' +
      '<div style="font-size:13px;color:#64748b;margin-bottom:4px;text-transform:capitalize">' + today + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:12px">📋 Bugungi davomat</div>' +
      branchBtns +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">' +
        attSumBox('👥', 'Jami', sum.total, '#3b82f6') +
        attSumBox('✅', 'Keldi', sum.came, '#22c55e') +
        attSumBox('⚠️', 'Kechikdi', sum.late, '#f59e0b') +
        attSumBox('❌', 'Kelmadi', sum.absent, '#ef4444') +
      '</div>' +
      '<div style="background:#1e293b;border:1px solid rgba(99,179,237,0.12);border-radius:12px;overflow:hidden">' +
        '<div style="overflow-x:auto">' +
          '<table style="width:100%;border-collapse:collapse">' +
            '<thead><tr style="background:rgba(99,179,237,0.05)">' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:600">ISHCHI</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:600">HOLAT</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:600">KELDI</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:600">KETDI</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:600">ISHLAGAN</th>' +
              '<th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:600">AMAL</th>' +
            '</tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="6" style="padding:40px;text-align:center;color:#475569">Ishchilar yo\'q</td></tr>') + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div id="manualModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;align-items:center;justify-content:center;padding:16px">' +
        '<div style="background:#1e293b;border:1px solid rgba(99,179,237,0.15);border-radius:16px;padding:24px;width:100%;max-width:380px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
            '<div id="manualTitle" style="font-size:15px;font-weight:700;color:#f1f5f9">Qo\'lda kiritish</div>' +
            '<button onclick="closeManualModal()" style="background:none;border:none;color:#64748b;font-size:20px;cursor:pointer">✕</button>' +
          '</div>' +
          '<div id="manualBody"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ===================================================
// ===== EMP REPORT — FILIAL FILTR BILAN =============
// ===================================================
async function renderEmpReport(main) {
  var now   = new Date();
  var month = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');

  // Filiallarni yuklaymiz
  var bd = await apiFetch('/admin/branches');
  var branches = (bd && bd.branches) ? bd.branches : [];

  var branchOptions = '<option value="">🏢 Barcha filiallar</option>' +
    branches.map(function(b) {
      return '<option value="' + b._id + '">' + b.name + '</option>';
    }).join('');

  main.innerHTML =
    '<div class="fade-up">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">' +
        '<div style="font-size:18px;font-weight:700;color:#f1f5f9">💰 Hisobot & Maosh</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<select id="reportBranch" onchange="loadReport()" style="padding:8px 12px;background:#1e293b;border:1px solid rgba(99,179,237,0.2);border-radius:8px;color:#f1f5f9;font-size:13px;font-family:inherit">' + branchOptions + '</select>' +
          '<input type="month" id="reportMonth" value="' + month + '" onchange="loadReport()" style="padding:8px 12px;background:#1e293b;border:1px solid rgba(99,179,237,0.2);border-radius:8px;color:#f1f5f9;font-size:13px">' +
        '</div>' +
      '</div>' +
      '<div id="reportContent"><div style="text-align:center;padding:40px;color:#475569">Yuklanmoqda...</div></div>' +
    '</div>';

  await loadReport();
}

async function loadReport() {
  var monthEl  = document.getElementById('reportMonth');
  var branchEl = document.getElementById('reportBranch');
  if (!monthEl) return;
  var month    = monthEl.value;
  var branchId = branchEl ? branchEl.value : '';
  var query    = '/admin/attendance/report?month=' + month + (branchId ? '&branchId=' + branchId : '');
  var d = await apiFetch(query);

  var content = document.getElementById('reportContent');
  if (!content) return;
  if (!d || !d.ok || !d.report) {
    content.innerHTML = '<div style="color:#f87171;padding:20px">' + (d && d.error ? d.error : 'Hisobot yuklanmadi') + '</div>';
    return;
  }

  var totalSalary  = d.report.reduce(function(s,r){ return s + (r.stats.earnedSalary||0); }, 0);
  var totalWorkers = d.report.length;

  var chartBars = d.report.map(function(r) {
    var s = r.stats;
    var pct = s.workingDaysInMonth > 0 ? Math.round((s.workedDays / s.workingDaysInMonth) * 100) : 0;
    var color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
    var shortName = r.employee.name.split(' ')[0];
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:40px">' +
      '<div style="font-size:10px;font-weight:600;color:' + color + '">' + pct + '%</div>' +
      '<div style="width:28px;background:#0f172a;border-radius:4px;height:80px;display:flex;align-items:flex-end">' +
        '<div style="width:100%;height:' + pct + '%;background:' + color + ';border-radius:4px;min-height:3px"></div>' +
      '</div>' +
      '<div style="font-size:9px;color:#64748b;text-align:center;max-width:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + shortName + '</div>' +
    '</div>';
  }).join('');

  var heatRows = d.report.map(function(r) {
    var recs = r.records || [];
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var dt = new Date(); dt.setDate(dt.getDate() - i);
      var ds = dt.toISOString().split('T')[0];
      var rec = recs.find(function(x){ return x.date && x.date.startsWith(ds); });
      var color = !rec ? '#1e293b' : rec.status==='keldi' ? '#22c55e' : rec.status==='dam' ? '#a78bfa' : rec.status==='kasal' ? '#60a5fa' : '#ef4444';
      var title = !rec ? 'Maʼlumot yoq' : rec.status==='keldi' ? (rec.checkIn||'')+(rec.checkOut?' → '+rec.checkOut:'') : rec.status;
      days.push('<div title="' + ds + ': ' + title + '" style="width:20px;height:20px;border-radius:4px;background:' + color + '"></div>');
    }
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<div style="font-size:12px;color:#94a3b8;width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.employee.name.split(' ')[0] + '</div>' +
      '<div style="display:flex;gap:3px">' + days.join('') + '</div>' +
    '</div>';
  }).join('');

  var cards = d.report.map(function(r) {
    var e = r.employee;
    var s = r.stats;
    var pct = s.workingDaysInMonth > 0 ? Math.min(100, Math.round((s.workedDays/s.workingDaysInMonth)*100)) : 0;
    var pctColor = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
    return '<div style="background:#1e293b;border:1px solid rgba(99,179,237,0.12);border-radius:12px;padding:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
        '<div><div style="font-size:14px;font-weight:700;color:#f1f5f9">' + e.name + '</div><div style="font-size:11px;color:#64748b;margin-top:2px">' + (e.position||'—') + '</div></div>' +
        '<div style="text-align:right"><div style="font-size:15px;font-weight:700;color:#22c55e">' + fmtSalary(s.earnedSalary) + '</div><div style="font-size:10px;color:#64748b">Oylik: ' + fmtSalary(e.salary) + '</div></div>' +
      '</div>' +
      '<div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:10px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:#64748b">Oy ish kunlari</span><span style="color:#f1f5f9;font-weight:600">' + s.workingDaysInMonth + ' kun</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:#64748b">1 kunlik maosh</span><span style="color:#3b82f6;font-weight:600">' + fmtSalary(s.dailySalary) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#64748b">Kelgan kunlar</span><span style="color:#f1f5f9;font-weight:600">' + s.workedDays + ' / ' + s.workingDaysInMonth + ' kun</span></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">' +
        miniStat('⏱', formatMins(s.totalMinutes), '#22c55e') +
        miniStat('⚠️', s.lateCount + ' kech', '#f59e0b') +
        miniStat('❌', s.absentCount + ' yoq', '#ef4444') +
      '</div>' +
      '<div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:11px;color:#64748b">Davomat</span><span style="font-size:11px;font-weight:600;color:' + pctColor + '">' + pct + '%</span></div>' +
        '<div style="background:#0f172a;border-radius:99px;height:6px"><div style="height:100%;width:' + pct + '%;background:' + pctColor + ';border-radius:99px"></div></div>' +
      '</div>' +
    '</div>';
  }).join('');

  content.innerHTML =
    '<div style="background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(34,197,94,0.08));border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><div style="font-size:11px;color:#64748b;margin-bottom:4px">JAMI MAOSH</div><div style="font-size:24px;font-weight:700;color:#f1f5f9">' + fmtSalary(totalSalary) + '</div></div>' +
        '<div style="text-align:right"><div style="font-size:11px;color:#64748b;margin-bottom:4px">ISHCHILAR</div><div style="font-size:24px;font-weight:700;color:#3b82f6">' + totalWorkers + ' ta</div></div>' +
      '</div>' +
    '</div>' +
    '<div style="background:#1e293b;border:1px solid rgba(99,179,237,0.12);border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<div style="font-size:12px;font-weight:600;color:#64748b;letter-spacing:1px;margin-bottom:16px">📊 DAVOMAT FOIZI</div>' +
      '<div style="display:flex;gap:8px;align-items:flex-end;overflow-x:auto;padding-bottom:4px">' + chartBars + '</div>' +
      '<div style="display:flex;gap:16px;margin-top:12px">' +
        '<span style="font-size:10px;color:#22c55e">● 90%+ yaxshi</span>' +
        '<span style="font-size:10px;color:#f59e0b">● 70–90% o\'rtacha</span>' +
        '<span style="font-size:10px;color:#ef4444">● 70%- past</span>' +
      '</div>' +
    '</div>' +
    '<div style="background:#1e293b;border:1px solid rgba(99,179,237,0.12);border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<div style="font-size:12px;font-weight:600;color:#64748b;letter-spacing:1px;margin-bottom:4px">🗓 OXIRGI 7 KUN</div>' +
      '<div style="display:flex;gap:3px;margin-bottom:10px;padding-left:98px">' +
        (function(){var l=[];for(var i=6;i>=0;i--){var dt=new Date();dt.setDate(dt.getDate()-i);var days=['Ya','Du','Se','Ch','Pa','Ju','Sh'];l.push('<div style="width:20px;text-align:center;font-size:9px;color:#475569">'+days[dt.getDay()]+'</div>');}return l.join('');})() +
      '</div>' +
      heatRows +
      '<div style="display:flex;gap:12px;margin-top:8px">' +
        '<span style="font-size:10px;color:#22c55e">● Keldi</span>' +
        '<span style="font-size:10px;color:#ef4444">● Kelmadi</span>' +
        '<span style="font-size:10px;color:#a78bfa">● Dam kuni</span>' +
        '<span style="font-size:10px;color:#60a5fa">● Kasal</span>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:12px;font-weight:600;color:#64748b;letter-spacing:1px;margin-bottom:10px">👥 ISHCHILAR HISOBOTI</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' + (cards || '<div style="text-align:center;padding:40px;color:#475569">Ma\'lumot yo\'q</div>') + '</div>';
}