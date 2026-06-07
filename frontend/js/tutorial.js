/**
 * ============================================================
 * tutorial.js — Sistema di tutorial interattivo per nuovi utenti
 * ============================================================
 * Guida i nuovi giocatori attraverso le funzionalità principali
 * con un overlay a step progressivi (tooltip + highlight).
 *
 * STEP DEL TUTORIAL:
 *  1. Player Hero: presentazione del giocatore e overall
 *  2. Info Cards: statistiche chiave (soldi, gol, struttura)
 *  3. Griglia Azioni: come scegliere le azioni mensili
 *  4. Pulsante Mese: come avanzare nel tempo
 *  5. Navigazione: come spostarsi tra le sezioni
 *  6. Lingua: come cambiare la lingua del gioco
 *
 * Il tutorial viene mostrato una sola volta (flag in localStorage).
 * Può essere resettato per test tramite GS_Tutorial.reset().
 *
 * API pubblica:
 *  - start(): avvia il tutorial se non già completato
 *  - reset(): cancella il flag "tutorial completato"
 *  - isCompleted(): restituisce true se già visto
 *
 * Esposto come oggetto globale GS_Tutorial.
 * ============================================================
 */

const GS_Tutorial = (() => {
    const KEY = 'gs_tutorial_done_v2';

    const STEPS = {
        it: [
            {
                target: '.player-hero',
                title: '👋 Benvenuto in Golden Striker!',
                text: 'Questo è il tuo giocatore. Qui vedi il tuo Overall, nome, squadra e le statistiche principali. Il tuo obiettivo? Diventare il migliore del mondo! 🌟',
                position: 'bottom',
            },
            {
                target: '.info-cards',
                title: '📊 Le tue statistiche chiave',
                text: 'Qui trovi periodo, soldi, gol e assist stagionali, e la tua struttura di allenamento. Tieni d\'occhio i gol — sono fondamentali per il Pallone d\'Oro!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '⚽ Gioca il Mese',
                text: 'Clicca qui ogni mese per scegliere le tue azioni. Puoi allenarti, fare social media, o riposare. Ogni scelta influenza le tue stats e l\'energia!',
                position: 'bottom',
                highlight: true,
            },
            {
                target: '.stats-grid',
                title: '📈 Statistiche tecniche',
                text: 'Tiro, Velocità, Dribbling, Fisico e Mentalità determinano il tuo Overall (max 125). Più alto è, meglio giochi e più squadre ti vogliono!',
                position: 'right',
            },
            {
                target: '.dash-notizie-box',
                title: '📰 Notizie & Aggiornamenti',
                text: 'Le notizie raccontano la tua carriera: gol segnati, premi vinti, trasferimenti. Tienile d\'occhio per seguire i tuoi progressi!',
                position: 'left',
            },
            {
                target: 'button[data-page="transfer"]',
                title: '🔄 Trasferimenti',
                text: 'Una volta per stagione puoi cambiare squadra. Squadre migliori = più soldi e più popolarità. Ma attento all\'Overall richiesto!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="skilltree"]',
                title: '🌟 Albero delle Abilità',
                text: 'Sblocca abilità speciali come "Tiro Potente", "Turbo" e "Rabona"! Ogni abilità aumenta le tue stats e sblocca mosse di gol uniche.',
                position: 'bottom',
            },
            {
                target: 'button[data-page="achievements"]',
                title: '🏅 Obiettivi & Premi',
                text: 'Sblocca oltre 40 badge completando sfide. Da "Prima Rete" a "Leggenda Mondiale" — c\'è sempre un nuovo traguardo da raggiungere!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '🚀 Inizia la tua avventura!',
                text: 'Tutto pronto! Clicca su "Gioca" e inizia il tuo viaggio verso il Pallone d\'Oro. Buona fortuna, campione! ⚽🏆',
                position: 'bottom',
                isLast: true,
            },
        ],
        en: [
            {
                target: '.player-hero',
                title: '👋 Welcome to Golden Striker!',
                text: 'This is your player. Here you can see your Overall, name, team and main stats. Your goal? Become the best in the world! 🌟',
                position: 'bottom',
            },
            {
                target: '.info-cards',
                title: '📊 Key Statistics',
                text: 'Here you\'ll find your period, money, seasonal goals and assists, and training facility. Keep an eye on goals — they\'re crucial for the Ballon d\'Or!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '⚽ Play the Month',
                text: 'Click here each month to choose your actions. You can train, do social media, or rest. Every choice affects your stats and energy!',
                position: 'bottom',
                highlight: true,
            },
            {
                target: '.stats-grid',
                title: '📈 Technical Stats',
                text: 'Shooting, Speed, Dribbling, Physical and Mental determine your Overall (max 125). Higher = better play and more clubs want you!',
                position: 'right',
            },
            {
                target: '.dash-notizie-box',
                title: '📰 News & Updates',
                text: 'News tells the story of your career: goals scored, awards won, transfers. Keep an eye out to follow your progress!',
                position: 'left',
            },
            {
                target: 'button[data-page="transfer"]',
                title: '🔄 Transfers',
                text: 'Once per season you can change clubs. Better teams = more money and popularity. But watch out for the Overall requirement!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="skilltree"]',
                title: '🌟 Skill Tree',
                text: 'Unlock special skills like "Power Shot", "Turbo" and "Rabona"! Each skill boosts your stats and unlocks unique goal moves.',
                position: 'bottom',
            },
            {
                target: 'button[data-page="achievements"]',
                title: '🏅 Achievements',
                text: 'Unlock 40+ badges by completing challenges. From "First Goal" to "World Legend" — there\'s always a new milestone to reach!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '🚀 Start Your Adventure!',
                text: 'All set! Click "Play" and begin your journey to the Ballon d\'Or. Good luck, champion! ⚽🏆',
                position: 'bottom',
                isLast: true,
            },
        ],
        de: [
            {
                target: '.player-hero',
                title: '👋 Willkommen bei Golden Striker!',
                text: 'Das ist dein Spieler. Hier siehst du deinen Overall, Namen, Verein und wichtigsten Statistiken. Dein Ziel? Der Beste der Welt werden! 🌟',
                position: 'bottom',
            },
            {
                target: '.info-cards',
                title: '📊 Deine Schlüsselwerte',
                text: 'Hier findest du Periode, Geld, Saisontore und -vorlagen sowie deine Trainingsanlage. Behalte die Tore im Blick — sie sind entscheidend für den Ballon d\'Or!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '⚽ Spiele den Monat',
                text: 'Klicke hier jeden Monat, um deine Aktionen zu wählen. Du kannst trainieren, Social Media machen oder dich ausruhen. Jede Wahl beeinflusst deine Werte und Energie!',
                position: 'bottom',
                highlight: true,
            },
            {
                target: '.stats-grid',
                title: '📈 Technische Werte',
                text: 'Schuss, Geschwindigkeit, Dribbling, Körper und Mentalität bestimmen deinen Overall (max 125). Je höher, desto besser spielst du und desto mehr Klubs wollen dich!',
                position: 'right',
            },
            {
                target: '.dash-notizie-box',
                title: '📰 News & Updates',
                text: 'Die News erzählen deine Karrieregeschichte: erzielte Tore, gewonnene Preise, Transfers. Behalte sie im Blick, um deine Fortschritte zu verfolgen!',
                position: 'left',
            },
            {
                target: 'button[data-page="transfer"]',
                title: '🔄 Transfers',
                text: 'Einmal pro Saison kannst du den Verein wechseln. Bessere Teams = mehr Geld und Popularität. Aber achte auf den erforderlichen Overall!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="skilltree"]',
                title: '🌟 Fertigkeitenbaum',
                text: 'Schalte besondere Fähigkeiten wie „Kraftschuss", „Turbo" und „Rabona" frei! Jede Fähigkeit steigert deine Werte und schaltet einzigartige Toraktionen frei.',
                position: 'bottom',
            },
            {
                target: 'button[data-page="achievements"]',
                title: '🏅 Errungenschaften',
                text: 'Schalte über 40 Abzeichen durch das Erfüllen von Herausforderungen frei. Von „Erstes Tor" bis „Weltlegende" — es gibt immer einen neuen Meilenstein!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '🚀 Starte dein Abenteuer!',
                text: 'Alles bereit! Klicke auf „Spielen" und beginne deine Reise zum Ballon d\'Or. Viel Glück, Champion! ⚽🏆',
                position: 'bottom',
                isLast: true,
            },
        ],
        es: [
            {
                target: '.player-hero',
                title: '👋 ¡Bienvenido a Golden Striker!',
                text: 'Este es tu jugador. Aquí verás tu Overall, nombre, equipo y estadísticas principales. ¿Tu objetivo? ¡Convertirte en el mejor del mundo! 🌟',
                position: 'bottom',
            },
            {
                target: '.info-cards',
                title: '📊 Tus estadísticas clave',
                text: 'Aquí encontrarás período, dinero, goles y asistencias de temporada, y tu instalación de entrenamiento. ¡Vigila los goles — son cruciales para el Balón de Oro!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '⚽ Juega el Mes',
                text: 'Haz clic aquí cada mes para elegir tus acciones. Puedes entrenar, hacer redes sociales o descansar. ¡Cada elección afecta tus estadísticas y energía!',
                position: 'bottom',
                highlight: true,
            },
            {
                target: '.stats-grid',
                title: '📈 Estadísticas técnicas',
                text: 'Disparo, Velocidad, Regate, Físico y Mentalidad determinan tu Overall (máx 125). ¡Cuanto mayor, mejor juegas y más clubes te quieren!',
                position: 'right',
            },
            {
                target: '.dash-notizie-box',
                title: '📰 Noticias y actualizaciones',
                text: 'Las noticias cuentan la historia de tu carrera: goles marcados, premios ganados, fichajes. ¡Síguelas para ver tu progreso!',
                position: 'left',
            },
            {
                target: 'button[data-page="transfer"]',
                title: '🔄 Fichajes',
                text: 'Una vez por temporada puedes cambiar de club. Mejores equipos = más dinero y popularidad. ¡Pero vigila el Overall requerido!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="skilltree"]',
                title: '🌟 Árbol de Habilidades',
                text: '¡Desbloquea habilidades especiales como "Disparo Potente", "Turbo" y "Rabona"! Cada habilidad aumenta tus estadísticas y desbloquea movimientos de gol únicos.',
                position: 'bottom',
            },
            {
                target: 'button[data-page="achievements"]',
                title: '🏅 Logros',
                text: '¡Desbloquea más de 40 insignias completando desafíos. Desde "Primer Gol" hasta "Leyenda Mundial" — ¡siempre hay un nuevo hito que alcanzar!',
                position: 'bottom',
            },
            {
                target: 'button[data-page="game"]',
                title: '🚀 ¡Empieza tu aventura!',
                text: '¡Todo listo! Haz clic en "Jugar" y comienza tu viaje hacia el Balón de Oro. ¡Buena suerte, campeón! ⚽🏆',
                position: 'bottom',
                isLast: true,
            },
        ],
    };

    let currentStep = 0;
    let overlayEl   = null;
    let spotlightEl = null;
    let boxEl       = null;
    let lang = 'it';
    let steps = [];

    function isDone() { return !!localStorage.getItem(KEY); }
    function markDone() { localStorage.setItem(KEY, '1'); }
    function reset() { localStorage.removeItem(KEY); }

    function getSteps() {
        lang  = localStorage.getItem('gs_lang') || 'it';
        steps = STEPS[lang] || STEPS.it;
        return steps;
    }

    function start(force = false) {
        if (!force && isDone()) return;
        currentStep = 0;
        getSteps();
        createOverlay();
        showStep(0);
    }

    function createOverlay() {
        if (document.getElementById('gs-tutorial-overlay')) return;

        overlayEl = document.createElement('div');
        overlayEl.id = 'gs-tutorial-overlay';
        overlayEl.style.cssText = `
            position: fixed; inset: 0; z-index: 99990;
            pointer-events: none;
        `;

        // Dark mask
        const mask = document.createElement('div');
        mask.style.cssText = `
            position: absolute; inset: 0;
            background: rgba(0,0,0,0.52);
            backdrop-filter: blur(1px);
        `;
        overlayEl.appendChild(mask);

        // Spotlight hole (transparent cutout)
        spotlightEl = document.createElement('div');
        spotlightEl.id = 'gs-tutorial-spotlight';
        spotlightEl.style.cssText = `
            position: absolute;
            border-radius: 10px;
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.52);
            transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
            border: 2px solid rgba(255,215,0,0.6);
            z-index: 1;
        `;
        overlayEl.appendChild(spotlightEl);

        // Tooltip box
        boxEl = document.createElement('div');
        boxEl.id = 'gs-tutorial-box';
        boxEl.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #1a2235, #0f172a);
            border: 1px solid rgba(255,215,0,0.5);
            border-radius: 16px;
            padding: 20px 22px;
            max-width: 340px;
            min-width: 260px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255,215,0,0.15);
            z-index: 2;
            pointer-events: all;
            transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
        `;
        boxEl.innerHTML = `
            <div id="tut-step-counter" style="font-size:0.7rem;color:rgba(255,215,0,0.6);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px"></div>
            <div id="tut-title" style="font-size:1.05rem;font-weight:800;color:#fff;margin-bottom:8px;line-height:1.3"></div>
            <div id="tut-text" style="font-size:0.85rem;color:#94a3b8;line-height:1.55;margin-bottom:16px"></div>
            <div style="display:flex;gap:8px;align-items:center;justify-content:space-between">
                <div id="tut-dots" style="display:flex;gap:5px"></div>
                <div style="display:flex;gap:8px">
                    <button id="tut-skip" style="background:transparent;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem">Salta</button>
                    <button id="tut-next" style="background:linear-gradient(135deg,#FFD700,#B8860B);color:#000;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:700">Avanti →</button>
                </div>
            </div>
        `;
        overlayEl.appendChild(boxEl);
        document.body.appendChild(overlayEl);

        document.getElementById('tut-skip').addEventListener('click', finish);
        document.getElementById('tut-next').addEventListener('click', nextStep);
    }

    function showStep(idx) {
        if (!overlayEl || idx >= steps.length) { finish(); return; }
        const step = steps[idx];
        const total = steps.length;

        // Update text
        document.getElementById('tut-step-counter').textContent = `${{it:'Passo',en:'Step',de:'Schritt',es:'Paso'}[lang]||'Passo'} ${idx + 1} / ${total}`;
        document.getElementById('tut-title').textContent = step.title;
        document.getElementById('tut-text').textContent  = step.text;

        // Dots
        const dotsEl = document.getElementById('tut-dots');
        dotsEl.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const dot = document.createElement('div');
            dot.style.cssText = `
                width: 6px; height: 6px; border-radius: 50%;
                background: ${i === idx ? '#FFD700' : 'rgba(255,255,255,0.2)'};
                transition: background 0.2s;
            `;
            dotsEl.appendChild(dot);
        }

        // Next button text
        const nextBtn = document.getElementById('tut-next');
        const skipBtn = document.getElementById('tut-skip');
        if (step.isLast) {
            nextBtn.textContent = {it:'🚀 Andiamo!',en:'🚀 Let\'s go!',de:'🚀 Los geht\'s!',es:'🚀 ¡Vamos!'}[lang]||'🚀 Andiamo!';
            skipBtn.style.display = 'none';
        } else {
            nextBtn.textContent = {it:'Avanti →',en:'Next →',de:'Weiter →',es:'Siguiente →'}[lang]||'Avanti →';
            skipBtn.style.display = 'block';
        }

        // Position spotlight on target element
        const targetEl = step.target ? document.querySelector(step.target) : null;
        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const pad = 8;
            spotlightEl.style.left   = `${rect.left - pad}px`;
            spotlightEl.style.top    = `${rect.top - pad}px`;
            spotlightEl.style.width  = `${rect.width + pad * 2}px`;
            spotlightEl.style.height = `${rect.height + pad * 2}px`;
            spotlightEl.style.display = 'block';

            // Position tooltip box
            const boxW = 340, boxH = 200;
            let bx, by;
            const vw = window.innerWidth, vh = window.innerHeight;

            if (step.position === 'bottom') {
                bx = rect.left + rect.width / 2 - boxW / 2;
                by = rect.bottom + 16;
            } else if (step.position === 'top') {
                bx = rect.left + rect.width / 2 - boxW / 2;
                by = rect.top - boxH - 16;
            } else if (step.position === 'right') {
                bx = rect.right + 16;
                by = rect.top + rect.height / 2 - boxH / 2;
            } else {
                bx = rect.left - boxW - 16;
                by = rect.top + rect.height / 2 - boxH / 2;
            }

            // Clamp to viewport
            bx = Math.max(10, Math.min(bx, vw - boxW - 10));
            by = Math.max(10, Math.min(by, vh - boxH - 10));

            boxEl.style.left = `${bx}px`;
            boxEl.style.top  = `${by}px`;

            // Scroll element into view
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } else {
            spotlightEl.style.display = 'none';
            // Center box
            boxEl.style.left = '50%';
            boxEl.style.top  = '50%';
            boxEl.style.transform = 'translate(-50%, -50%)';
        }

        // Animate box in
        boxEl.animate([
            { opacity: 0, transform: boxEl.style.transform + ' scale(0.9)' },
            { opacity: 1, transform: boxEl.style.transform + ' scale(1)' },
        ], { duration: 250, easing: 'ease-out', fill: 'forwards' });
    }

    function nextStep() {
        currentStep++;
        if (currentStep >= steps.length) { finish(); return; }
        showStep(currentStep);
    }

    function finish() {
        markDone();
        if (overlayEl) {
            overlayEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => {
                overlayEl.remove();
                overlayEl = null;
            };
        }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        if (overlayEl) showStep(currentStep);
    });

    // Called by setLanguage() when the user switches language mid-tutorial
    function updateLang() {
        if (!overlayEl || !boxEl) return; // tutorial not active
        getSteps(); // re-reads localStorage lang and re-assigns steps[]
        showStep(currentStep); // re-render current step in new language
    }

    return { start, reset, updateLang };
})();

window.GS_Tutorial = GS_Tutorial;


// ── Advanced tutorial mode ────────────────────────────────────────────────────
const GS_AdvancedTutorial = {
    // Quick tips that pop up contextually during gameplay
    QUICK_TIPS: {
        it: {
            first_injury: "💡 Sei infortunato! Usa 'Riposo e recupero' per guarire prima. Evita allenamenti fisici.",
            low_energy: "💡 Energia bassa! Alto rischio infortuni. Considera di riposare questo mese.",
            low_money: "💡 Pochi soldi! Considera un agente per aumentare lo stipendio.",
            first_win: "🏆 Prima vittoria! I gol e le vittorie aumentano la tua popolarità.",
            high_pop: "⭐ Popolarità alta! Puoi permetterti agenti migliori e club più grandi.",
            season_end: "📅 Fine stagione! Controlla le statistiche e pianifica la prossima stagione.",
            new_skill: "✨ Hai punti abilità! Vai nell'Albero Abilità e sblocca nuove mosse.",
            can_transfer: "✈️ Hai l'Overall per un club migliore! Valuta un trasferimento.",
            low_morale: "😔 Morale basso! Influisce sulle prestazioni. Cerca una vittoria o riposa.",
        },
        en: {
            first_injury: "💡 You're injured! Use 'Rest & Recovery' to heal faster. Avoid physical training.",
            low_energy: "💡 Low energy! High injury risk. Consider resting this month.",
            low_money: "💡 Low funds! Consider an agent to increase your salary.",
            first_win: "🏆 First win! Goals and wins increase your popularity.",
            high_pop: "⭐ High popularity! You can afford better agents and larger clubs.",
            season_end: "📅 Season end! Check the stats and plan your next season.",
            new_skill: "✨ You have skill points! Go to the Skill Tree and unlock new moves.",
            can_transfer: "✈️ You have the Overall for a better club! Consider a transfer.",
            low_morale: "😔 Low morale! It affects your performance. Seek a win or rest.",
        }
    },

    shown: new Set(),

    maybeShowTip(key) {
        if (this.shown.has(key)) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        const tip = this.QUICK_TIPS[lang]?.[key] || this.QUICK_TIPS.it[key];
        if (tip && window.GS_UI) {
            this.shown.add(key);
            GS_UI.toast(tip, 'gold', 5000);
        }
    },

    checkContext(player) {
        if (!player) return;
        if (parseInt(player.infortuni_mesi || 0) > 0) this.maybeShowTip('first_injury');
        if (parseInt(player.energia || 100) < 30) this.maybeShowTip('low_energy');
        if (parseFloat(player.soldi || 0) < 5000) this.maybeShowTip('low_money');
        if (parseInt(player.popolarita || 0) >= 50) this.maybeShowTip('high_pop');
        if (parseInt(player.morale || 75) < 30) this.maybeShowTip('low_morale');
    },
};

if (typeof window !== 'undefined') {
    window.GS_AdvancedTutorial = GS_AdvancedTutorial;
}
