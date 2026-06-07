/**
 * ============================================================
 * timeline.js — Timeline visuale della carriera
 * ============================================================
 * Visualizza la storia completa della carriera come una linea
 * del tempo verticale con eventi chiave e milestone.
 *
 * TIPI DI EVENTI TRACCIATI:
 *  - goal_milestone: traguardi gol (50, 100, 200, 500)
 *  - pallone_doro: vittorie del Pallone d'Oro
 *  - champions: fasi raggiunte in Champions Cup
 *  - promoted / relegated: promozioni e retrocessioni
 *  - transfer: trasferimenti tra squadre
 *  - new_season: inizio di ogni nuova stagione
 *  - ovr_milestone: record di overall raggiunti
 *  - injury: infortuni significativi
 *  - trophy: trofei del campionato
 *  - achievement: badge sbloccati
 *
 * API pubblica:
 *  - render(container, events): disegna la timeline completa
 *  - addEvent(type, data): aggiunge un evento alla timeline
 *
 * Esposto come oggetto globale GS_Timeline.
 * ============================================================
 */

const GS_Timeline = (() => {

    // ── Event type configs ────────────────────────────────────────────────────
    const EVENT_TYPES = {
        goal_milestone: { icon: '⚽', color: '#FFD700', label_it: 'Traguardo Gol',        label_en: 'Goal Milestone' },
        pallone_doro:   { icon: '🥇', color: '#FFD700', label_it: "Pallone d'Oro",         label_en: "Ballon d'Or" },
        champions:      { icon: '🏆', color: '#60a5fa', label_it: 'Champions Cup',          label_en: 'Champions Cup' },
        promoted:       { icon: '🚀', color: '#10b981', label_it: 'Promozione',             label_en: 'Promotion' },
        relegated:      { icon: '📉', color: '#ef4444', label_it: 'Retrocessione',          label_en: 'Relegation' },
        transfer:       { icon: '✈️', color: '#8b5cf6', label_it: 'Trasferimento',          label_en: 'Transfer' },
        new_season:     { icon: '📅', color: '#94a3b8', label_it: 'Nuova Stagione',         label_en: 'New Season' },
        ovr_milestone:  { icon: '📈', color: '#f59e0b', label_it: 'Record Overall',         label_en: 'Overall Record' },
        injury:         { icon: '🏥', color: '#ef4444', label_it: 'Infortunio',             label_en: 'Injury' },
        trophy:         { icon: '🏅', color: '#FFD700', label_it: 'Trofeo Campionato',      label_en: 'League Trophy' },
        achievement:    { icon: '🎖️', color: '#a855f7', label_it: 'Badge Sbloccato',        label_en: 'Achievement Unlocked' },
        skill:          { icon: '✨', color: '#38bdf8', label_it: 'Abilità Sbloccata',      label_en: 'Skill Unlocked' },
        agent:          { icon: '🤝', color: '#10b981', label_it: 'Nuovo Agente',           label_en: 'New Agent' },
        facility:       { icon: '🏗️', color: '#f97316', label_it: 'Struttura Migliorata',  label_en: 'Facility Upgraded' },
    };

    // ── Build timeline from career data ───────────────────────────────────────
    function buildTimeline(seasons, player, achievementsData = []) {
        const events = [];
        let prevOvr = 65;
        let prevGol = 0;

        (seasons || []).slice().reverse().forEach((s, i) => {
            const anno = s.anno;

            // New season
            events.push({
                anno, mese: 9, type: 'new_season',
                text_it: `Inizio stagione ${anno}. Squadra: ${s.team_nome || 'N/A'}.`,
                text_en: `Season ${anno} begins. Team: ${s.team_nome || 'N/A'}.`,
            });

            // Goal milestones
            const golCarriera = parseInt(s.gol || 0) + prevGol;
            [10, 25, 50, 75, 100, 150, 200, 300].forEach(milestone => {
                if (prevGol < milestone && golCarriera >= milestone) {
                    events.push({
                        anno, mese: 5, type: 'goal_milestone',
                        text_it: `🎯 ${milestone}° gol in carriera! Un traguardo storico.`,
                        text_en: `🎯 Career goal number ${milestone}! A historic milestone.`,
                    });
                }
            });
            prevGol = golCarriera;

            // Pallone d'oro
            if (s.pallone_doro_pos === 1) {
                events.push({
                    anno, mese: 10, type: 'pallone_doro',
                    text_it: `🥇 Vittoria del Pallone d'Oro ${anno}! Il meglio del mondo.`,
                    text_en: `🥇 Ballon d'Or ${anno} winner! The world's best.`,
                });
            }

            // Champions
            if (s.trofei_vinti > 0) {
                events.push({
                    anno, mese: 6, type: 'trophy',
                    text_it: `🏆 Trofeo vinto nella stagione ${anno}! Campioni.`,
                    text_en: `🏆 Trophy won in season ${anno}! Champions.`,
                });
            }
        });

        // OVR milestones from player
        [70, 75, 80, 85, 90, 95, 100, 105, 110, 115].forEach(milestone => {
            if (parseInt(player.overall || 0) >= milestone) {
                events.push({
                    anno: parseInt(player.anno_corrente || 1),
                    mese: 1,
                    type: 'ovr_milestone',
                    text_it: `📈 Overall ${milestone} raggiunto! La crescita continua.`,
                    text_en: `📈 Overall ${milestone} achieved! The growth continues.`,
                });
            }
        });

        // Achievements unlocked
        achievementsData.filter(a => a.isUnlocked).slice(0, 5).forEach(a => {
            const lang = localStorage.getItem('gs_lang') || 'it';
            events.push({
                anno: parseInt(player.anno_corrente || 1),
                mese: Math.floor(Math.random() * 9) + 1,
                type: 'achievement',
                text_it: `🎖️ Badge sbloccato: "${a.name}"`,
                text_en: `🎖️ Achievement unlocked: "${a.name_en || a.name}"`,
            });
        });

        // Sort by anno desc, mese desc
        events.sort((a, b) => b.anno - a.anno || b.mese - a.mese);
        return events;
    }

    // ── Render timeline HTML ──────────────────────────────────────────────────
    function render(container, seasons, player, achievementsData = []) {
        if (!container) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        const events = buildTimeline(seasons, player, achievementsData);

        if (!events.length) {
            container.innerHTML = `<p style="color:var(--text-dim);padding:20px;text-align:center">
                ${{it:'Gioca di più per costruire la tua timeline!',en:'Play more to build your timeline!',de:'Spiele mehr, um deine Timeline aufzubauen!',es:'¡Juega más para construir tu línea de tiempo!'}[lang]||'Gioca di più per costruire la tua timeline!'}
            </p>`;
            return;
        }

        let html = '<div class="gs-timeline">';

        let lastAnno = null;
        events.forEach((ev, i) => {
            const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.new_season;
            const text = {en:ev.text_en||ev.text_it,de:ev.text_de||ev.text_en||ev.text_it,es:ev.text_es||ev.text_en||ev.text_it,it:ev.text_it}[lang]||ev.text_it;
            const typeLabel = {en:cfg.label_en,de:cfg.label_de||cfg.label_en,es:cfg.label_es||cfg.label_en,it:cfg.label_it}[lang]||cfg.label_it;
            const mesiNames = {
            it:['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
            en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            de:['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
            es:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
        }[lang]||['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
            const mese = mesiNames[ev.mese] || '';

            // Year separator
            if (lastAnno !== ev.anno) {
                html += `
                    <div class="gs-tl-year-sep">
                        <span class="gs-tl-year-badge">${{it:'Anno',en:'Year',de:'Jahr',es:'Año'}[lang]||'Anno'} ${ev.anno}</span>
                    </div>`;
                lastAnno = ev.anno;
            }

            html += `
                <div class="gs-tl-item gs-tl-${ev.type}" style="animation-delay:${i * 0.06}s">
                    <div class="gs-tl-dot" style="background:${cfg.color};box-shadow:0 0 10px ${cfg.color}66">
                        <span>${cfg.icon}</span>
                    </div>
                    <div class="gs-tl-content">
                        <div class="gs-tl-meta">
                            <span class="gs-tl-type" style="color:${cfg.color}">${typeLabel}</span>
                            <span class="gs-tl-date">${mese} A${ev.anno}</span>
                        </div>
                        <div class="gs-tl-text">${text}</div>
                    </div>
                </div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // ── CSS styles for timeline (injected once) ────────────────────────────────
    function injectStyles() {
        if (document.getElementById('gs-timeline-styles')) return;
        const style = document.createElement('style');
        style.id = 'gs-timeline-styles';
        style.textContent = `
            .gs-timeline {
                position: relative;
                padding-left: 40px;
                margin: 0;
            }
            .gs-timeline::before {
                content: '';
                position: absolute;
                left: 15px; top: 0; bottom: 0;
                width: 2px;
                background: linear-gradient(to bottom, var(--gold), rgba(255,215,0,0.1));
                border-radius: 1px;
            }
            .gs-tl-year-sep {
                margin: 20px 0 12px -30px;
                display: flex;
                align-items: center;
            }
            .gs-tl-year-badge {
                background: rgba(255,215,0,0.12);
                border: 1px solid rgba(255,215,0,0.3);
                color: var(--gold);
                font-size: 0.72rem;
                font-weight: 800;
                padding: 3px 10px;
                border-radius: 20px;
                letter-spacing: 0.5px;
            }
            .gs-tl-item {
                display: flex;
                gap: 14px;
                margin-bottom: 16px;
                align-items: flex-start;
                animation: fadeInLeft 0.4s ease both;
            }
            @keyframes fadeInLeft {
                from { opacity: 0; transform: translateX(-15px); }
                to   { opacity: 1; transform: translateX(0); }
            }
            .gs-tl-dot {
                width: 32px; height: 32px;
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 0.9rem;
                flex-shrink: 0;
                margin-left: -40px;
                border: 2px solid rgba(255,255,255,0.1);
                transition: transform 0.2s;
            }
            .gs-tl-item:hover .gs-tl-dot {
                transform: scale(1.15);
            }
            .gs-tl-content {
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 10px 14px;
                flex: 1;
                transition: border-color 0.2s, transform 0.2s;
            }
            .gs-tl-item:hover .gs-tl-content {
                transform: translateX(4px);
                border-color: rgba(255,215,0,0.2);
            }
            .gs-tl-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .gs-tl-type {
                font-size: 0.68rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .gs-tl-date {
                font-size: 0.68rem;
                color: var(--text-dim);
            }
            .gs-tl-text {
                font-size: 0.82rem;
                color: var(--text);
                line-height: 1.4;
            }
            /* Special styling for major events */
            .gs-tl-pallone_doro .gs-tl-content {
                background: linear-gradient(135deg, rgba(255,215,0,0.08), var(--card));
                border-color: rgba(255,215,0,0.3);
            }
            .gs-tl-champions .gs-tl-content {
                background: linear-gradient(135deg, rgba(96,165,250,0.08), var(--card));
                border-color: rgba(96,165,250,0.3);
            }
            .gs-tl-promoted .gs-tl-content {
                background: linear-gradient(135deg, rgba(16,185,129,0.08), var(--card));
                border-color: rgba(16,185,129,0.3);
            }
        `;
        document.head.appendChild(style);
    }

    injectStyles();

    return { render };
})();

window.GS_Timeline = GS_Timeline;
