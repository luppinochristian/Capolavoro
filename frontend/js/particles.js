/**
 * ============================================================
 * particles.js — Sistema particelle canvas per effetti visivi
 * ============================================================
 * Motore di particelle basato su canvas HTML5 per celebrazioni
 * e feedback visivo degli eventi di gioco importanti.
 *
 * EFFETTI DISPONIBILI:
 *  - celebrate(): esplosione di coriandoli per gol/vittoria
 *  - championsCelebration(): effetto speciale Champions Cup
 *  - palloneroCelebration(): pioggia d'oro per Pallone d'Oro
 *  - subtleEffect(): scintille discrete per azioni positive
 *  - stop(): ferma tutte le particelle attive
 *
 * PALETTE COLORI (tema "Stadio di notte"):
 *  - Verde campo (#00C566, #009950)
 *  - Bianco freddo (#E8EDF2)
 *  - Oro sobrio (#E8B84B)
 *  No arcobaleni generici — palette coerente con il tema.
 *
 * Le particelle usano requestAnimationFrame per performance ottimali
 * e si auto-distruggono dopo la durata configurata.
 *
 * Esposto come oggetto globale GS_Particles.
 * ============================================================
 */

const GS_Particles = (() => {
    let canvas, ctx2d, particles = [], animId = null;
    let W, H;

    function ensureCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.id = 'gs-particle-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;';
        document.body.appendChild(canvas);
        ctx2d = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize, { passive: true });
    }

    function resize() {
        if (!canvas) return;
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    // ── Palette tema ──────────────────────────────────────────────────────────
    const PALETTES = {
        goal:       ['#00C566', '#009950', '#E8EDF2', '#E8B84B', '#00D4FF'],
        celebrate:  ['#00C566', '#00dd75', '#E8EDF2', '#E8B84B', '#ffffff'],
        confetti:   ['#00C566', '#009950', '#E8B84B', '#b8892e', '#E8EDF2', '#3E8FE8'],
        levelUp:    ['#E8B84B', '#b8892e', '#ffffff', '#E8EDF2'],
        transfer:   ['#3E8FE8', '#60a5fa', '#93c5fd', '#ffffff', '#00C566'],
        achievement:['#E8B84B', '#ffffff', '#00C566', '#E8EDF2'],
        money:      ['#00C566', '#009950', '#00dd75'],
        firework:   ['#00C566', '#E8B84B', '#E8EDF2', '#3E8FE8', '#00D4FF'],
    };

    // ── Particle ──────────────────────────────────────────────────────────────
    class Particle {
        constructor(opts) {
            this.x  = opts.x  ?? W / 2;
            this.y  = opts.y  ?? H / 2;
            this.vx = opts.vx ?? (Math.random() - 0.5) * 12;
            this.vy = opts.vy ?? -(Math.random() * 14 + 5);
            this.size     = opts.size     ?? Math.random() * 8 + 4;
            this.color    = opts.color    ?? '#00C566';
            this.alpha    = 1;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.28;
            this.gravity  = opts.gravity  ?? 0.38;
            this.drag     = opts.drag     ?? 0.982;
            this.life     = 1;
            this.decay    = opts.decay    ?? (Math.random() * 0.014 + 0.01);
            this.shape    = opts.shape    ?? 'rect';
            this.glow     = opts.glow     ?? false;
            this.trail    = [];
            this.maxTrail = opts.maxTrail ?? 0;
        }

        update() {
            if (this.maxTrail > 0) {
                this.trail.push({ x: this.x, y: this.y, a: this.life });
                if (this.trail.length > this.maxTrail) this.trail.shift();
            }
            this.x  += this.vx;
            this.y  += this.vy;
            this.vy += this.gravity;
            this.vx *= this.drag;
            this.vy *= this.drag;
            this.rotation += this.rotSpeed;
            this.life  -= this.decay;
            this.alpha  = Math.max(0, this.life);
        }

        draw(ctx) {
            if (this.alpha <= 0) return;
            ctx.save();
            ctx.globalAlpha = this.alpha;

            // trail
            if (this.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(this.trail[0].x, this.trail[0].y);
                this.trail.forEach((p, i) => {
                    ctx.globalAlpha = p.a * 0.25 * (i / this.trail.length);
                    ctx.lineTo(p.x, p.y);
                });
                ctx.strokeStyle = this.color;
                ctx.lineWidth   = this.size * 0.35;
                ctx.stroke();
                ctx.globalAlpha = this.alpha;
            }

            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);

            if (this.glow) {
                ctx.shadowColor = this.color;
                ctx.shadowBlur  = 10;
            }
            ctx.fillStyle = this.color;

            switch (this.shape) {
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'star':
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const a  = (i / 5) * Math.PI * 2 - Math.PI / 2;
                        const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
                        const r  = this.size / 2, r2 = r * 0.4;
                        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                        ctx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
                    }
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(0, -this.size / 2);
                    ctx.lineTo(this.size / 2, this.size / 2);
                    ctx.lineTo(-this.size / 2, this.size / 2);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'ball':
                    ctx.beginPath();
                    ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.strokeStyle = '#1a1a1a';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.fillStyle = '#111';
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const a = (i / 5) * Math.PI * 2;
                        const r = this.size * 0.19;
                        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    }
                    ctx.closePath();
                    ctx.fill();
                    break;
                default: // rect
                    ctx.fillRect(-this.size / 2, -this.size * 0.28, this.size, this.size * 0.56);
            }
            ctx.restore();
        }

        isDead() { return this.life <= 0; }
    }

    // ── Loop ──────────────────────────────────────────────────────────────────
    function loop() {
        ctx2d.clearRect(0, 0, W, H);
        particles = particles.filter(p => { p.update(); p.draw(ctx2d); return !p.isDead(); });
        animId = particles.length > 0 ? requestAnimationFrame(loop) : null;
    }

    function startLoop() { if (!animId) animId = requestAnimationFrame(loop); }

    function spawn(opts) { ensureCanvas(); particles.push(new Particle(opts)); startLoop(); }

    function spawnBurst(count, opts) {
        ensureCanvas();
        for (let i = 0; i < count; i++) particles.push(new Particle({ ...opts }));
        startLoop();
    }

    function pickColor(palette) {
        const p = PALETTES[palette] || PALETTES.celebrate;
        return p[Math.floor(Math.random() * p.length)];
    }

    // ── Effetti nominati ──────────────────────────────────────────────────────
    const effects = {

        // Celebrazione goal — tema verde/bianco/oro
        goalCelebration(x, y) {
            ensureCanvas();
            const cx = x ?? W / 2, cy = y ?? H / 2;

            // Burst principale confetti
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 20 + 7;
                particles.push(new Particle({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 10,
                    size:  Math.random() * 11 + 4,
                    color: pickColor('goal'),
                    shape: ['rect','circle','star','triangle'][Math.floor(Math.random() * 4)],
                    gravity: 0.33,
                    decay:   0.007 + Math.random() * 0.007,
                    glow:    Math.random() > 0.75,
                }));
            }

            // Palloni
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                particles.push(new Particle({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * (Math.random() * 9 + 4),
                    vy: Math.sin(angle) * (Math.random() * 9 + 4) - 7,
                    size: 18, shape: 'ball', gravity: 0.45, decay: 0.006,
                }));
            }

            // Stelle verdi con scia
            for (let i = 0; i < 16; i++) {
                particles.push(new Particle({
                    x: cx + (Math.random() - 0.5) * 80, y: cy,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -(Math.random() * 18 + 9),
                    size: 14, color: '#00C566', shape: 'star',
                    gravity: 0.12, decay: 0.006, glow: true, maxTrail: 7,
                }));
            }
            startLoop();
        },

        // Pioggia confetti (Pallone d'Oro, vittoria campionato)
        confettiRain() {
            ensureCanvas();
            const total = 180;
            let spawned = 0;
            function spawnBatch() {
                if (spawned >= total) return;
                const batch = Math.min(10, total - spawned);
                for (let i = 0; i < batch; i++) {
                    particles.push(new Particle({
                        x: Math.random() * W, y: -20,
                        vx: (Math.random() - 0.5) * 4,
                        vy: Math.random() * 3 + 1.5,
                        size:  Math.random() * 10 + 4,
                        color: pickColor('confetti'),
                        shape: ['rect','circle','triangle'][Math.floor(Math.random() * 3)],
                        gravity: 0.06, drag: 0.996, decay: 0.004,
                    }));
                }
                spawned += batch;
                startLoop();
                if (spawned < total) setTimeout(spawnBatch, 80);
            }
            spawnBatch();
        },

        // Level-up: anello stelle oro
        levelUpBurst(x, y) {
            ensureCanvas();
            const cx = x ?? W / 2, cy = y ?? H / 2;
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 2;
                const speed = 9 + Math.random() * 7;
                particles.push(new Particle({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size:  Math.random() * 13 + 7,
                    color: i % 2 === 0 ? '#E8B84B' : '#E8EDF2',
                    shape: 'star', gravity: 0.08, decay: 0.009, glow: true,
                }));
            }
            // Flash centrale
            for (let i = 0; i < 24; i++) {
                const angle = Math.random() * Math.PI * 2;
                particles.push(new Particle({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * (Math.random() * 7 + 2),
                    vy: Math.sin(angle) * (Math.random() * 7 + 2),
                    size: Math.random() * 5 + 3,
                    color: '#E8B84B', shape: 'circle',
                    gravity: 0, decay: 0.028, glow: true,
                }));
            }
            startLoop();
        },

        // Trasferimento: azzurro-verde
        transferWhoosh(fromEl) {
            ensureCanvas();
            const rect = fromEl?.getBoundingClientRect?.() ?? { left: W * 0.3, top: H / 2, width: 0, height: 0 };
            const cx = rect.left + (rect.width ?? 0) / 2;
            const cy = rect.top  + (rect.height ?? 0) / 2;
            for (let i = 0; i < 36; i++) {
                particles.push(new Particle({
                    x: cx, y: cy,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15,
                    size:  Math.random() * 9 + 4,
                    color: pickColor('transfer'),
                    shape: Math.random() > 0.5 ? 'star' : 'circle',
                    gravity: 0.1, decay: 0.014, glow: true,
                }));
            }
            startLoop();
        },

        // Achievement unlock
        achievementPop(el) {
            ensureCanvas();
            const rect = el?.getBoundingClientRect?.() ?? { left: W/2-50, top: H/2-50, width:100, height:100 };
            const cx = rect.left + rect.width / 2;
            const cy = rect.top;
            for (let i = 0; i < 44; i++) {
                particles.push(new Particle({
                    x: cx + (Math.random() - 0.5) * rect.width,
                    y: cy,
                    vx: (Math.random() - 0.5) * 9,
                    vy: -(Math.random() * 13 + 4),
                    size:  Math.random() * 10 + 4,
                    color: pickColor('achievement'),
                    shape: ['rect','star','circle'][Math.floor(Math.random() * 3)],
                    gravity: 0.28, decay: 0.013,
                    glow: Math.random() > 0.55,
                }));
            }
            startLoop();
        },

        // Sparkle su elemento
        sparkle(el, count = 14) {
            ensureCanvas();
            const rect = el?.getBoundingClientRect?.();
            if (!rect) return;
            for (let i = 0; i < count; i++) {
                particles.push(new Particle({
                    x: rect.left + Math.random() * rect.width,
                    y: rect.top  + Math.random() * rect.height,
                    vx: (Math.random() - 0.5) * 3,
                    vy: -(Math.random() * 4 + 1),
                    size:  Math.random() * 7 + 3,
                    color: Math.random() > 0.5 ? '#00C566' : '#E8EDF2',
                    shape: 'star', gravity: 0.04, decay: 0.022, glow: true,
                }));
            }
            startLoop();
        },

        // Shockwave radiale — cerchio di punti
        shockwave(x, y) {
            ensureCanvas();
            const cx = x ?? W / 2, cy = y ?? H / 2;
            const speed = 14;
            for (let i = 0; i < 48; i++) {
                const angle = (i / 48) * Math.PI * 2;
                particles.push(new Particle({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 5, color: '#00C566',
                    shape: 'circle', gravity: 0, drag: 0.91, decay: 0.055, glow: true,
                }));
            }
            startLoop();
        },

        // Vittoria completa
        victory(cx, cy) {
            const x = cx ?? W / 2, y = cy ?? H * 0.3;
            effects.goalCelebration(x, y);
            setTimeout(() => effects.confettiRain(), 450);
            setTimeout(() => effects.shockwave(x, y), 750);
        },

        // Fuochi d'artificio
        fireworks(count = 5) {
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    const fx = W * 0.2 + Math.random() * W * 0.6;
                    const fy = H * 0.12 + Math.random() * H * 0.45;
                    effects.shockwave(fx, fy);
                    for (let j = 0; j < 36; j++) {
                        const angle = (j / 36) * Math.PI * 2;
                        const speed = 7 + Math.random() * 11;
                        spawn({
                            x: fx, y: fy,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 3,
                            size:  Math.random() * 7 + 3,
                            color: pickColor('firework'),
                            shape: Math.random() > 0.5 ? 'star' : 'circle',
                            gravity: 0.28, decay: 0.009, glow: true,
                        });
                    }
                }, i * 380 + Math.random() * 260);
            }
        },

        // Pioggia di soldi
        moneyRain() {
            let spawned = 0;
            function next() {
                if (spawned >= 28) return;
                spawn({
                    x: Math.random() * W, y: -20,
                    vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 2.5,
                    size: 13, color: '#00C566',
                    shape: 'circle', gravity: 0.04, decay: 0.005, glow: true,
                });
                spawned++;
                setTimeout(next, 90);
            }
            next();
        },

        // Flash goal (angolo campo)
        goalFlash() {
            const x = W * 0.2, y = H * 0.5;
            for (let i = 0; i < 28; i++) {
                spawn({
                    x: x + (Math.random() - 0.5) * 90,
                    y: y + (Math.random() - 0.5) * 55,
                    vx: (Math.random() - 0.5) * 7,
                    vy: -(Math.random() * 6 + 2),
                    size:  Math.random() * 9 + 5,
                    color: Math.random() > 0.5 ? '#00C566' : '#E8EDF2',
                    shape: Math.random() > 0.5 ? 'star' : 'circle',
                    gravity: 0.18, decay: 0.022, glow: true,
                });
            }
        },

        // Level-up da elemento UI
        levelUpRing(el) {
            if (!el) return;
            const rect = el.getBoundingClientRect();
            effects.levelUpBurst(rect.left + rect.width/2, rect.top + rect.height/2);
            effects.shockwave(rect.left + rect.width/2, rect.top + rect.height/2);
        },

        clear() {
            particles = [];
            if (ctx2d) ctx2d.clearRect(0, 0, W, H);
        },
    };

    return { effects };
})();

window.GS_Particles = GS_Particles;
