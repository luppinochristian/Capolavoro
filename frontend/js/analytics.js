/**
 * ============================================================
 * analytics.js — Analytics avanzate e statistiche di performance
 * ============================================================
 * Fornisce visualizzazioni avanzate delle performance del giocatore:
 * heatmap, form guide, trend grafici e statistiche aggregate.
 *
 * FUNZIONALITÀ:
 *  - renderFormGuide(): ultimi N risultati con indicatori V/P/S
 *  - renderHeatmap(): mappa calore presenze/gol per mese
 *  - renderAttributeRadar(): grafico radar degli attributi
 *  - renderGoalsChart(): andamento gol per stagione
 *  - renderRatingTrend(): trend voto medio nel tempo
 *  - renderSeasonSummary(): riepilogo testuale della stagione
 *  - getFormScore(): punteggio forma (0-100) basato sugli ultimi risultati
 *
 * Utilizza canvas HTML5 per i grafici più complessi.
 * I colori si adattano al tema del gioco (verde campo, oro, bianco).
 *
 * Esposto come oggetto globale GS_Analytics.
 * ============================================================
 */

const GS_Analytics = (() => {

    // ── Form tracker (last N results) ─────────────────────────────────────────
    function renderFormGuide(container, legaMsgs, maxShow = 10) {
        if (!container) return;
        const lang = localStorage.getItem('gs_lang') || 'it';

        const results = (legaMsgs || []).slice(0, maxShow).reverse();
        if (!results.length) {
            container.innerHTML = `<span style="color:var(--text-dim);font-size:0.8rem">${{it:'Nessuna partita ancora',en:'No matches yet',de:'Noch keine Spiele',es:'Aún sin partidos'}[lang]||'Nessuna partita ancora'}</span>`;
            return;
        }

        const labels = {
            V: { label: {it:'V',en:'W',de:'S',es:'V'}[lang]||'V', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
            P: { label: {it:'P',en:'D',de:'U',es:'E'}[lang]||'P', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
            S: { label: {it:'S',en:'L',de:'N',es:'D'}[lang]||'S', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
        };

        container.innerHTML = `
            <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
                ${results.map(m => {
                    const esito = m.esito || (parseInt(m.gf) > parseInt(m.gs) ? 'V' : parseInt(m.gf) === parseInt(m.gs) ? 'P' : 'S');
                    const cfg = labels[esito] || labels.P;
                    return `<div title="${m.gf}-${m.gs} vs ${m.avv || '?'}" style="
                        width:24px;height:24px;border-radius:6px;
                        background:${cfg.bg};color:${cfg.color};
                        border:1px solid ${cfg.color}44;
                        display:flex;align-items:center;justify-content:center;
                        font-size:0.7rem;font-weight:800;cursor:default;
                        transition:transform 0.15s;
                    " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">${cfg.label}</div>`;
                }).join('')}
            </div>`;
    }

    // ── Mini rating chart ─────────────────────────────────────────────────────
    function renderRatingSparkline(container, logData, w = 200, h = 50) {
        if (!container) return;
        const ratings = (logData || [])
            .filter(l => l.voto && parseFloat(l.voto) > 0)
            .slice(0, 15)
            .reverse()
            .map(l => parseFloat(l.voto));

        if (ratings.length < 2) return;

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.style.cssText = 'width:100%;height:auto;display:block';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const min = Math.min(...ratings, 4);
        const max = Math.max(...ratings, 10);
        const range = max - min || 1;
        const n = ratings.length;

        // Area fill
        ctx.beginPath();
        ratings.forEach((v, i) => {
            const x = (i / (n - 1)) * w;
            const y = h - ((v - min) / range) * (h - 10) - 5;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,215,0,0.3)');
        grad.addColorStop(1, 'rgba(255,215,0,0.02)');
        ctx.fillStyle = grad; ctx.fill();

        // Line
        ctx.beginPath();
        ratings.forEach((v, i) => {
            const x = (i / (n - 1)) * w;
            const y = h - ((v - min) / range) * (h - 10) - 5;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 4;
        ctx.stroke(); ctx.shadowBlur = 0;

        // Dots
        ratings.forEach((v, i) => {
            const x = (i / (n - 1)) * w;
            const y = h - ((v - min) / range) * (h - 10) - 5;
            const color = v >= 7.5 ? '#10b981' : v >= 6 ? '#FFD700' : '#ef4444';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
        });
    }

    // ── Heatmap for goals scored by month ─────────────────────────────────────
    function renderGoalHeatmap(container, logData) {
        if (!container) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        const monthNames = {it:['Set','Ott','Nov','Dic','Gen','Feb','Mar','Apr','Mag','Giu'],en:['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'],de:['Sep','Okt','Nov','Dez','Jan','Feb','Mär','Apr','Mai','Jun'],es:['Sep','Oct','Nov','Dic','Ene','Feb','Mar','Abr','May','Jun']}[lang]||['Set','Ott','Nov','Dic','Gen','Feb','Mar','Apr','Mag','Giu'];
        const monthOrder = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

        // Count goals per month across all years
        const goalsByMonth = {};
        monthOrder.forEach(m => goalsByMonth[m] = 0);
        (logData || []).forEach(l => {
            if (l.gol > 0 && l.mese) goalsByMonth[parseInt(l.mese)] = (goalsByMonth[parseInt(l.mese)] || 0) + parseInt(l.gol);
        });

        const maxGoals = Math.max(...Object.values(goalsByMonth), 1);

        container.innerHTML = `
            <div style="display:flex;gap:4px;align-items:flex-end;flex-wrap:nowrap;overflow-x:auto;padding:8px 0">
                ${monthOrder.map((m, i) => {
                    const goals = goalsByMonth[m] || 0;
                    const intensity = goals / maxGoals;
                    const h = Math.max(8, Math.round(intensity * 60)) + 'px';
                    const color = intensity > 0.7 ? '#FFD700' : intensity > 0.4 ? '#f59e0b' : intensity > 0.1 ? '#92400e' : '#1f2937';
                    return `
                        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:28px">
                            <div style="font-size:0.7rem;color:#FFD700;font-weight:700;height:14px;display:flex;align-items:center">
                                ${goals > 0 ? goals : ''}
                            </div>
                            <div style="
                                width:100%;height:${h};border-radius:4px;
                                background:${color};
                                transition:height 0.5s ease ${i * 0.05}s, background 0.3s;
                                cursor:default;
                                box-shadow:${goals > 0 ? `0 0 8px ${color}66` : 'none'};
                            " title="${monthNames[i]}: ${goals} ${{it:'gol',en:'goals',de:'Tore',es:'goles'}[lang]||'gol'}"></div>
                            <div style="font-size:0.65rem;color:var(--text-dim);text-align:center">${monthNames[i]}</div>
                        </div>`;
                }).join('')}
            </div>
            <div style="font-size:0.72rem;color:var(--text-dim);text-align:center;margin-top:4px">
                ${{it:'Gol per mese (tutte le stagioni)',en:'Goals per month (all seasons)',de:'Tore pro Monat (alle Saisons)',es:'Goles por mes (todas las temporadas)'}[lang]||'Gol per mese (tutte le stagioni)'}
            </div>`;
    }

    // ── Performance score calculator ──────────────────────────────────────────
    function calcPerformanceScore(player, seasons) {
        const ovr  = parseInt(player.overall || 65);
        const pop  = parseInt(player.popolarita || 0);
        const gol  = parseInt(player.gol_carriera || 0);
        const ast  = parseInt(player.assist_carriera || 0);
        const trof = parseInt(player.trofei || 0);
        const pd   = parseInt(player.palloni_doro || 0);
        const age  = parseInt(player.age || 25);

        // Weighted formula
        let score = ovr * 0.3 + pop * 0.15 + Math.min(gol, 300) * 0.1 +
                    Math.min(ast, 200) * 0.05 + trof * 2 + pd * 10;

        // Age bonus for young players
        if (age < 25) score *= 1.1;

        return Math.round(score);
    }

    // ── Render full performance dashboard widget ──────────────────────────────
    function renderPerformanceDash(container, player, logData, legaMsgs) {
        if (!container) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        const score = calcPerformanceScore(player, []);

        // Grade
        let grade, gradeColor;
        if (score >= 200)      { grade = 'S+'; gradeColor = '#a855f7'; }
        else if (score >= 160) { grade = 'S';  gradeColor = '#FFD700'; }
        else if (score >= 120) { grade = 'A';  gradeColor = '#10b981'; }
        else if (score >= 90)  { grade = 'B';  gradeColor = '#3b82f6'; }
        else if (score >= 60)  { grade = 'C';  gradeColor = '#f59e0b'; }
        else                    { grade = 'D';  gradeColor = '#6b7280'; }

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start">
                <div style="text-align:center;background:rgba(${grade==='S+'?'168,85,247':'255,215,0'},0.1);
                    border:2px solid ${gradeColor};border-radius:12px;padding:12px 16px;min-width:80px">
                    <div style="font-size:2.5rem;font-weight:900;color:${gradeColor};line-height:1">${grade}</div>
                    <div style="font-size:0.7rem;color:var(--text-dim);margin-top:4px">${{it:'Grado',en:'Grade',de:'Note',es:'Nota'}[lang]||'Grado'}</div>
                    <div style="font-size:1.1rem;font-weight:700;color:${gradeColor};margin-top:2px">${score}</div>
                    <div style="font-size:0.65rem;color:var(--text-dim)">${{it:'Punteggio',en:'Score',de:'Punkte',es:'Puntuación'}[lang]||'Punteggio'}</div>
                </div>
                <div>
                    <div style="margin-bottom:10px">
                        <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:4px">
                            ${{it:'📊 Forma Recente',en:'📊 Recent Form',de:'📊 Aktuelle Form',es:'📊 Forma Reciente'}[lang]||'📊 Forma Recente'}
                        </div>
                        <div id="gs-form-guide"></div>
                    </div>
                    <div>
                        <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:4px">
                            ${{it:'⭐ Andamento Voto',en:'⭐ Rating Trend',de:'⭐ Bewertungsverlauf',es:'⭐ Tendencia Valoración'}[lang]||'⭐ Andamento Voto'}
                        </div>
                        <div id="gs-rating-sparkline"></div>
                    </div>
                </div>
            </div>
            <div style="margin-top:16px">
                <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:8px">
                    ${{it:'⚽ Gol per Mese',en:'⚽ Goals by Month',de:'⚽ Tore pro Monat',es:'⚽ Goles por Mes'}[lang]||'⚽ Gol per Mese'}
                </div>
                <div id="gs-goal-heatmap"></div>
            </div>`;

        // Render sub-components
        renderFormGuide(document.getElementById('gs-form-guide'), legaMsgs);
        renderRatingSparkline(document.getElementById('gs-rating-sparkline'), logData);
        renderGoalHeatmap(document.getElementById('gs-goal-heatmap'), logData);
    }

    // ── Win/Loss/Draw pie chart ───────────────────────────────────────────────
    function renderWLDPie(container, legaMsgs) {
        if (!container) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        let W = 0, L = 0, D = 0;
        (legaMsgs || []).forEach(m => {
            const esito = m.esito || (parseInt(m.gf) > parseInt(m.gs) ? 'V' : parseInt(m.gf) === parseInt(m.gs) ? 'P' : 'S');
            if (esito === 'V') W++;
            else if (esito === 'S') L++;
            else D++;
        });
        const total = W + D + L || 1;

        const canvas = document.createElement('canvas');
        canvas.width = 120; canvas.height = 120;
        canvas.style.cssText = 'width:120px;height:120px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const cx = 60, cy = 60, r = 50;
        const segments = [
            { val: W, color: '#10b981', label: {it:'V',en:'W',de:'S',es:'V'}[lang]||'V' },
            { val: D, color: '#f59e0b', label: {it:'P',en:'D',de:'U',es:'E'}[lang]||'P' },
            { val: L, color: '#ef4444', label: {it:'S',en:'L',de:'N',es:'D'}[lang]||'S' },
        ];

        let startAngle = -Math.PI / 2;
        segments.forEach(seg => {
            const sliceAngle = (seg.val / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.shadowColor = seg.color; ctx.shadowBlur = 6;
            ctx.fill(); ctx.shadowBlur = 0;

            if (seg.val > 0) {
                const midAngle = startAngle + sliceAngle / 2;
                const lx = cx + Math.cos(midAngle) * (r * 0.6);
                const ly = cy + Math.sin(midAngle) * (r * 0.6);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(seg.val, lx, ly + 4);
            }

            startAngle += sliceAngle;
        });

        // Center
        ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0e1a'; ctx.fill();
        ctx.fillStyle = '#FFD700'; ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(W / total * 100)}%`, cx, cy + 4);

        // Legend
        const legendDiv = document.createElement('div');
        legendDiv.style.cssText = 'display:flex;flex-direction:column;gap:4px;justify-content:center;margin-left:12px';
        segments.forEach(seg => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:0.75rem';
            row.innerHTML = `
                <div style="width:10px;height:10px;border-radius:2px;background:${seg.color};flex-shrink:0"></div>
                <span style="color:var(--text-dim)">${seg.label}: <strong style="color:#fff">${seg.val}</strong></span>`;
            legendDiv.appendChild(row);
        });

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center';
        wrap.appendChild(canvas);
        wrap.appendChild(legendDiv);

        container.innerHTML = '';
        container.appendChild(wrap);
    }

    // ── Streak tracker ────────────────────────────────────────────────────────
    function getStreaks(legaMsgs) {
        const results = (legaMsgs || []).map(m =>
            m.esito || (parseInt(m.gf) > parseInt(m.gs) ? 'V' : parseInt(m.gf) === parseInt(m.gs) ? 'P' : 'S')
        );

        let maxWin = 0, curWin = 0, maxLoss = 0, curLoss = 0;
        let maxGoalStreak = 0, curGoalStreak = 0;

        results.forEach((r, i) => {
            if (r === 'V') { curWin++; maxWin = Math.max(maxWin, curWin); curLoss = 0; }
            else { curLoss++; maxLoss = Math.max(maxLoss, curLoss); curWin = 0; }

            const goals = parseInt(legaMsgs[i]?.player_gol || legaMsgs[i]?.gol || 0);
            if (goals > 0) { curGoalStreak++; maxGoalStreak = Math.max(maxGoalStreak, curGoalStreak); }
            else curGoalStreak = 0;
        });

        return { maxWin, maxLoss, maxGoalStreak };
    }

    // ── Key stats summary ─────────────────────────────────────────────────────
    function renderKeyStats(container, player, logData) {
        if (!container) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        const streaks = getStreaks(logData);

        const stats = [
            { icon: '⚽', label: {it:'Gol Carriera',en:'Career Goals',de:'Karriere-Tore',es:'Goles Carrera'}[lang]||'Gol Carriera', val: player.gol_carriera || 0, color: '#FFD700' },
            { icon: '🎯', label: {it:'Assist Carriera',en:'Career Assists',de:'Karriere-Vorlagen',es:'Asistencias Carrera'}[lang]||'Assist Carriera', val: player.assist_carriera || 0, color: '#3b82f6' },
            { icon: '🏆', label: {it:'Trofei',en:'Trophies',de:'Trophäen',es:'Trofeos'}[lang]||'Trofei', val: player.trofei || 0, color: '#10b981' },
            { icon: '🥇', label: {it:"Palloni d'Oro",en:"Ballon d'Or",de:"Ballon d'Or",es:"Balón de Oro"}[lang]||"Palloni d'Oro", val: player.palloni_doro || 0, color: '#a855f7' },
            { icon: '🔥', label: {it:'Striscia Vittorie',en:'Best Win Streak',de:'Beste Siegserie',es:'Racha de Victorias'}[lang]||'Striscia Vittorie', val: streaks.maxWin, color: '#f97316' },
            { icon: '⚡', label: {it:'Striscia Gol',en:'Goal Streak',de:'Tor-Serie',es:'Racha de Goles'}[lang]||'Striscia Gol', val: streaks.maxGoalStreak, color: '#f59e0b' },
        ];

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
                ${stats.map((s, i) => `
                    <div style="
                        background:var(--card);border:1px solid var(--border);
                        border-radius:10px;padding:12px 10px;text-align:center;
                        transition:transform 0.2s,border-color 0.2s;cursor:default;
                        animation:fadeInUp 0.4s ease ${i*0.08}s both;
                    " onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='${s.color}44'"
                       onmouseout="this.style.transform='';this.style.borderColor='var(--border)'">
                        <div style="font-size:1.3rem;margin-bottom:4px">${s.icon}</div>
                        <div style="font-size:1.4rem;font-weight:900;color:${s.color}">${s.val}</div>
                        <div style="font-size:0.62rem;color:var(--text-dim);line-height:1.2;margin-top:2px">${s.label}</div>
                    </div>`).join('')}
            </div>`;
    }

    return {
        renderGoalHeatmap,
        renderWLDPie,
        renderKeyStats,
    };
})();

window.GS_Analytics = GS_Analytics;
