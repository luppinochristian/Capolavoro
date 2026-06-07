/**
 * ============================================================
 * commentary.js — Motore di commento partite in tempo reale
 * ============================================================
 * Genera testo di telecronaca dinamico durante la simulazione
 * delle partite, in italiano e inglese.
 *
 * POOL DI FRASI (IT/EN):
 *  - kickoff: inizio partita
 *  - possession: azione di centrocampo
 *  - attack: azione offensiva
 *  - shot: tiro in porta
 *  - goal: gol segnato
 *  - miss: occasione mancata
 *  - save: parata del portiere
 *  - foul: fallo e punizione
 *  - freekick: calcio di punizione
 *  - corner: calcio d'angolo
 *  - halftime: intervallo
 *  - final_whistle: fischio finale
 *  - crowd_reaction: reazione del pubblico
 *
 * API pubblica:
 *  - getLine(event, context): riga di commento per l'evento
 *  - buildMatchScript(events): script completo di una partita
 *
 * Esposto come oggetto globale GS_Commentary.
 * ============================================================
 */

const GS_Commentary = (() => {
    const POOLS = {
        it: {
            kickoff: [
                "🎙️ Il fischio d'inizio! La partita è cominciata!",
                "🎙️ Si parte! Le squadre scendono in campo!",
                "🎙️ Fischio del direttore di gara, si comincia!",
                "🎙️ Il pubblico è in fermento, palla al centro!",
            ],
            possession: [
                "🎙️ {player} controlla il pallone a centrocampo.",
                "🎙️ Bello scambio tra i centrocampisti.",
                "🎙️ {player} riceve palla sulla fascia.",
                "🎙️ L'azione si sviluppa sulla trequarti.",
                "🎙️ {player} avanza palla al piede con sicurezza.",
                "🎙️ Buona circolazione palla da parte della {team}.",
                "🎙️ {player} salta un avversario con classe!",
                "🎙️ Il portiere della {team} non ha ancora toccato il pallone.",
                "🎙️ {player} entra in area di rigore — attenzione!",
                "🎙️ Bella triangolazione al limite dell'area.",
                "🎙️ {player} conquista un calcio d'angolo.",
                "🎙️ Il pressing della {team} soffoca gli avversari.",
                "🎙️ Cross dalla destra, {player} ci arriva!",
                "🎙️ {player} ispira tutti: è il trascinatore della {team}.",
                "🎙️ Bella giocata — {player} mantiene il possesso sotto pressione.",
                "🎙️ Tocco preciso di {player}, si riparte in velocità.",
                "🎙️ {team} domina il centrocampo. 70% di possesso palla.",
                "🎙️ Fallo su {player}! L'arbitro fischia.",
                "🎙️ {player} allarga il gioco, ottima visione.",
                "🎙️ La {team} cerca spazi con movimenti continui.",
                "🎙️ {player} si inserisce dalla seconda linea!",
                "🎙️ Bella accelerazione di {player} sulla fascia sinistra.",
                "🎙️ {player} protegge bene il pallone sotto pressione.",
                "🎙️ Rimessa laterale per la {team} — si riparte.",
                "🎙️ Il mister della {team} protesta a bordocampo.",
            ],
            chance: [
                "🎙️ {player} si trova tutto solo davanti al portiere!",
                "🎙️ Grande occasione per {player}!",
                "🎙️ Traversa piena! Sembra rotto il palo!",
                "🎙️ Che parata del portiere! Strepitoso!",
                "🎙️ {player} calcia dal limite, alto di poco!",
                "🎙️ Cross perfetto, ma nessuno ad appoggiarla in rete!",
                "🎙️ Rigore negato! Il VAR dice no.",
                "🎙️ {player} a botta sicura — il portiere vola e la tocca in angolo!",
                "🎙️ Palo! {player} ci va vicino!",
                "🎙️ Incredibile! {player} ha mancato il tap-in!",
                "🎙️ Tiro deviato in extremis dalla difesa avversaria.",
                "🎙️ {player} in area piccola — provvidenziale il portiere!",
                "🎙️ Calcio di punizione — {player} calcia — blocca il portiere!",
                "🎙️ Che tentativo di tacco! {player} ci prova di tutto!",
                "🎙️ Respinta del portiere sulla linea — che salvataggio!",
                "🎙️ {player} salta il portiere ma il tiro è debole — bloccato!",
                "🎙️ Azione magistrale di {player} — conclusione di poco a lato!",
                "🎙️ Il pubblico trattiene il respiro — parata prodigiosa!",
            ],
            goal: [
                "🎙️ ⚽ GOOOOOOL! {player} porta in vantaggio la {team}!",
                "🎙️ ⚽ GOL! Che bel gol di {player}! Il pubblico esplode!",
                "🎙️ ⚽ RETE! {player} è implacabile! {team} avanti!",
                "🎙️ ⚽ GOOOOL! Destro/sinistro perfetto di {player}!",
                "🎙️ ⚽ CHE GOOOOL! La {team} esulta, {player} è on fire!",
            ],
            concede: [
                "🎙️ Gol subito! La difesa si fa sorprendere.",
                "🎙️ Il portiere non ci arriva, gol degli avversari.",
                "🎙️ Segnano gli avversari. Serve una reazione.",
                "🎙️ Gol dell'avversario. Parziale in parità.",
            ],
            halftime: [
                "🎙️ Fine primo tempo. Si va negli spogliatoi.",
                "🎙️ L'arbitro fischia la fine del primo tempo.",
                "🎙️ Primo tempo equilibrato. Tutto ancora aperto.",
            ],
            yellowcard: [
                "🎙️ 🟨 Cartellino giallo per {player}. Attenzione.",
                "🎙️ 🟨 Ammonito {player}! L'arbitro non perdona.",
            ],
            redcard: [
                "🎙️ 🟥 Rosso diretto! {player} deve lasciare il campo!",
                "🎙️ 🟥 Espulsione! La {team} in dieci uomini!",
            ],
            pressure: [
                "🎙️ {team} spinge in avanti alla ricerca del gol.",
                "🎙️ Pressing alto da parte degli avversari.",
                "🎙️ {player} recupera palla e riparte in contropiede.",
                "🎙️ Che ritmo! Il pubblico è in piedi.",
            ],
            fulltime: [
                "🎙️ Fischio finale! Il match è terminato!",
                "🎙️ Fine partita! L'arbitro chiude il gioco.",
                "🎙️ Il direttore di gara fischia tre volte. Finita!",
            ],
        },
        en: {
            kickoff: [
                "🎙️ Kickoff! The match is underway!",
                "🎙️ We're off! Both teams on the pitch!",
                "🎙️ The referee blows the whistle, we're started!",
                "🎙️ The crowd is buzzing, ball to the center!",
            ],
            possession: [
                "🎙️ {player} controls the ball in midfield.",
                "🎙️ Nice exchange between the midfielders.",
                "🎙️ {player} receives on the wing.",
                "🎙️ The move builds in the final third.",
                "🎙️ {player} drives forward with confidence.",
                "🎙️ Good ball circulation from {team}.",
                "🎙️ {player} beats his man with ease!",
                "🎙️ The {team} goalkeeper hasn't been tested yet.",
                "🎙️ {player} cuts inside the box — danger!",
                "🎙️ Nice one-two on the edge of the area.",
                "🎙️ {player} wins a corner kick.",
                "🎙️ The {team} high press is suffocating.",
                "🎙️ Cross from the right, {player} attacks it!",
                "🎙️ {player} is inspiring everyone — the {team} heartbeat.",
                "🎙️ Great skill from {player} keeping the ball under pressure.",
                "🎙️ Precise touch from {player}, quick restart.",
                "🎙️ {team} dominating midfield. 70% possession.",
                "🎙️ Foul on {player}! Referee blows.",
                "🎙️ {player} switches play, excellent vision.",
                "🎙️ {team} probing with continuous movement.",
                "🎙️ {player} bursts forward from deep!",
                "🎙️ Nice burst from {player} down the left.",
                "🎙️ {player} shields the ball well under pressure.",
                "🎙️ Throw-in for {team} — play restarts.",
                "🎙️ The {team} manager is animated on the touchline.",
            ],
            chance: [
                "🎙️ {player} is one-on-one with the keeper!",
                "🎙️ Great chance for {player}!",
                "🎙️ Off the crossbar! So close!",
                "🎙️ What a save! The keeper is outstanding!",
                "🎙️ {player} shoots from range, just over!",
                "🎙️ Perfect cross, but nobody there to convert!",
            ],
            goal: [
                "🎙️ ⚽ GOOOOAL! {player} puts {team} ahead!",
                "🎙️ ⚽ GOAL! What a finish from {player}! The crowd erupts!",
                "🎙️ ⚽ IN THE NET! {player} is ruthless! {team} lead!",
                "🎙️ ⚽ GOOOAL! Stunning strike from {player}!",
                "🎙️ ⚽ WHAT A GOAL! {team} celebrate, {player} is on fire!",
            ],
            concede: [
                "🎙️ Goal conceded! The defense is caught out.",
                "🎙️ The keeper can't reach it, opponents score.",
                "🎙️ Opposition goal. A response is needed.",
                "🎙️ They've equalized. Back to level.",
            ],
            halftime: [
                "🎙️ Half time! The teams head to the dressing room.",
                "🎙️ Referee blows for the break.",
                "🎙️ An even first half. Everything still to play for.",
            ],
            yellowcard: [
                "🎙️ 🟨 Yellow card for {player}. Watch it.",
                "🎙️ 🟨 {player} is booked! The referee won't let that go.",
            ],
            redcard: [
                "🎙️ 🟥 Straight red! {player} has to go!",
                "🎙️ 🟥 Sent off! {team} down to ten men!",
            ],
            pressure: [
                "🎙️ {team} pushing forward for the goal.",
                "🎙️ High press from the opposition.",
                "🎙️ {player} wins it back and breaks forward.",
                "🎙️ What a tempo! The crowd is on their feet.",
            ],
            fulltime: [
                "🎙️ Full time! The match is over!",
                "🎙️ The final whistle! Game done.",
                "🎙️ Three blows of the whistle. It's over!",
            ],
        },
        de: {
            kickoff: [
                "🎙️ Anpfiff! Das Spiel hat begonnen!",
                "🎙️ Los geht's! Beide Teams auf dem Platz!",
                "🎙️ Der Schiedsrichter pfeift an — wir starten!",
                "🎙️ Das Publikum ist begeistert, Ball in der Mitte!",
            ],
            possession: [
                "🎙️ {player} kontrolliert den Ball im Mittelfeld.",
                "🎙️ Schöner Spielzug zwischen den Mittelfeldspielern.",
                "🎙️ {player} nimmt den Ball auf dem Flügel an.",
                "🎙️ Der Angriff entwickelt sich im letzten Drittel.",
                "🎙️ {player} treibt den Ball sicher nach vorne.",
                "🎙️ Gute Ballzirkulation von {team}.",
                "🎙️ {player} lässt einen Gegner stehen!",
                "🎙️ Der Torwart von {team} wurde noch nicht gefordert.",
                "🎙️ {player} dringt in den Strafraum ein — Gefahr!",
                "🎙️ Schöner Doppelpass am Strafraumrand.",
                "🎙️ {player} erkämpft einen Eckball.",
                "🎙️ Das Pressing von {team} erstickt die Gegner.",
                "🎙️ Flanke von rechts, {player} ist zur Stelle!",
                "🎙️ {player} reißt alle mit — das Herz von {team}.",
                "🎙️ Tolle Technik von {player} unter Druck.",
                "🎙️ Präziser Pass von {player}, schneller Neustart.",
                "🎙️ {team} dominiert das Mittelfeld. 70 % Ballbesitz.",
                "🎙️ Foul an {player}! Der Schiedsrichter pfeift.",
                "🎙️ {player} verlagert das Spiel, ausgezeichnete Übersicht.",
                "🎙️ {team} sucht mit kontinuierlichen Bewegungen Räume.",
            ],
            chance: [
                "🎙️ {player} steht allein vor dem Torwart!",
                "🎙️ Große Chance für {player}!",
                "🎙️ An die Latte! So knapp!",
                "🎙️ Was für eine Parade! Der Torwart ist überragend!",
                "🎙️ {player} schießt aus der Distanz, knapp drüber!",
                "🎙️ Perfekte Flanke, aber niemand zum Einschießen!",
                "🎙️ {player} zielt genau — der Torwart fliegt und lenkt ab!",
                "🎙️ Pfosten! {player} war so nah dran!",
            ],
            goal: [
                "🎙️ ⚽ TOOOOR! {player} bringt {team} in Führung!",
                "🎙️ ⚽ TOR! Was für ein Abschluss von {player}! Das Publikum explodiert!",
                "🎙️ ⚽ DRIN! {player} ist gnadenlos! {team} führt!",
                "🎙️ ⚽ TOOOOR! Traumschuss von {player}!",
                "🎙️ ⚽ WELCH EIN TOR! {team} jubelt, {player} ist in Topform!",
            ],
            concede: [
                "🎙️ Gegentor! Die Abwehr wird überrascht.",
                "🎙️ Der Torwart kommt nicht ran, die Gegner treffen.",
                "🎙️ Tor der Gegner. Eine Reaktion ist nötig.",
                "🎙️ Ausgleich. Wieder alles offen.",
            ],
            halftime: [
                "🎙️ Halbzeit! Die Teams gehen in die Kabine.",
                "🎙️ Der Schiedsrichter pfeift Pause.",
                "🎙️ Eine ausgeglichene erste Hälfte. Noch alles offen.",
            ],
            yellowcard: [
                "🎙️ 🟨 Gelbe Karte für {player}. Vorsicht.",
                "🎙️ 🟨 {player} wird verwarnt! Der Schiedsrichter ist streng.",
            ],
            redcard: [
                "🎙️ 🟥 Direkter Platzverweis! {player} muss vom Platz!",
                "🎙️ 🟥 Rote Karte! {team} spielt zu zehnt!",
            ],
            pressure: [
                "🎙️ {team} drängt auf das Tor.",
                "🎙️ Hohes Pressing der Gegner.",
                "🎙️ {player} erkämpft den Ball und startet den Konter.",
                "🎙️ Was für ein Tempo! Das Publikum steht.",
            ],
            fulltime: [
                "🎙️ Abpfiff! Das Spiel ist vorbei!",
                "🎙️ Der Schlusspfiff! Spiel beendet.",
                "🎙️ Dreimal pfeift der Schiedsrichter. Aus und vorbei!",
            ],
        },
        es: {
            kickoff: [
                "🎙️ ¡Pitido inicial! ¡El partido ha comenzado!",
                "🎙️ ¡Arrancamos! ¡Ambos equipos en el campo!",
                "🎙️ ¡El árbitro pita, estamos en marcha!",
                "🎙️ ¡El público está emocionado, balón al centro!",
            ],
            possession: [
                "🎙️ {player} controla el balón en el centro del campo.",
                "🎙️ Bonito intercambio entre los mediocampistas.",
                "🎙️ {player} recibe el balón en la banda.",
                "🎙️ El ataque se desarrolla en el último tercio.",
                "🎙️ {player} avanza con confianza con el balón.",
                "🎙️ Buena circulación de balón del {team}.",
                "🎙️ ¡{player} se deshace de su marcador con clase!",
                "🎙️ El portero del {team} no ha sido exigido aún.",
                "🎙️ {player} entra en el área — ¡peligro!",
                "🎙️ Bonita pared en el borde del área.",
                "🎙️ {player} gana un córner.",
                "🎙️ La presión alta del {team} asfixia a los rivales.",
                "🎙️ Centro desde la derecha, ¡{player} llega!",
                "🎙️ {player} inspira a todos — el corazón del {team}.",
                "🎙️ Gran habilidad de {player} para mantener el balón bajo presión.",
            ],
            chance: [
                "🎙️ ¡{player} se queda solo ante el portero!",
                "🎙️ ¡Gran ocasión para {player}!",
                "🎙️ ¡Al palo! ¡Qué cerca!",
                "🎙️ ¡Qué parada! ¡El portero está espectacular!",
                "🎙️ {player} dispara desde lejos, ¡por poco!",
                "🎙️ ¡Centro perfecto pero nadie para rematar!",
                "🎙️ ¡{player} al poste! ¡Tan cerca!",
            ],
            goal: [
                "🎙️ ⚽ ¡GOOOOOL! ¡{player} pone en ventaja al {team}!",
                "🎙️ ⚽ ¡GOL! ¡Qué remate de {player}! ¡El público explota!",
                "🎙️ ⚽ ¡DENTRO! ¡{player} es imparable! ¡{team} gana!",
                "🎙️ ⚽ ¡GOOOOOL! ¡Disparo perfecto de {player}!",
                "🎙️ ⚽ ¡QUÉ GOLAZO! ¡{team} celebra, {player} está en llamas!",
            ],
            concede: [
                "🎙️ ¡Gol en contra! La defensa es sorprendida.",
                "🎙️ El portero no llega, los rivales marcan.",
                "🎙️ Gol del rival. Se necesita una respuesta.",
                "🎙️ Empate. Todo sigue abierto.",
            ],
            halftime: [
                "🎙️ ¡Descanso! Los equipos se van al vestuario.",
                "🎙️ El árbitro pita el final del primer tiempo.",
                "🎙️ Un primer tiempo equilibrado. Todavía todo por decidir.",
            ],
            yellowcard: [
                "🎙️ 🟨 Tarjeta amarilla para {player}. Cuidado.",
                "🎙️ 🟨 ¡{player} amonestado! El árbitro no perdona.",
            ],
            redcard: [
                "🎙️ 🟥 ¡Roja directa! ¡{player} tiene que irse!",
                "🎙️ 🟥 ¡Expulsado! ¡{team} se queda con diez!",
            ],
            pressure: [
                "🎙️ {team} empuja hacia adelante en busca del gol.",
                "🎙️ Presión alta de los rivales.",
                "🎙️ {player} recupera el balón y sale al contragolpe.",
                "🎙️ ¡Qué ritmo! El público está en pie.",
            ],
            fulltime: [
                "🎙️ ¡Pitido final! ¡El partido ha terminado!",
                "🎙️ ¡El árbitro da por finalizado el encuentro!",
                "🎙️ ¡Tres pitidos del árbitro. Se acabó!",
            ],
        },
    };

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function format(template, player, team) {
        return template
            .replace(/{player}/g, player || 'Il giocatore')
            .replace(/{team}/g,   team   || 'La squadra');
    }

    // ── Generate a commentary sequence for a match ────────────────────────────
    function generateMatchSequence(playerName, teamName, gol, esito, lang = 'it') {
        const pool = POOLS[lang] || POOLS.it;
        const lines = [];
        const totalMinutes = 90;

        // Opening
        lines.push({ min: 1, text: format(pick(pool.kickoff), playerName, teamName) });

        // Build sequence
        let playerGoalsLeft = gol;
        const events = [];

        // Spread player goals across the match
        for (let g = 0; g < playerGoalsLeft; g++) {
            const min = Math.floor(Math.random() * 75) + 10;
            events.push({ min, type: 'player_goal' });
        }

        // Maybe concede
        if (esito === 'P' || esito === 'S') {
            const numConcede = esito === 'S' ? Math.floor(Math.random() * 2) + 1 : 1;
            for (let c = 0; c < numConcede; c++) {
                events.push({ min: Math.floor(Math.random() * 80) + 5, type: 'concede' });
            }
        }

        // Random events
        const randomCount = Math.floor(Math.random() * 4) + 3;
        for (let r = 0; r < randomCount; r++) {
            const types = ['possession', 'chance', 'pressure'];
            events.push({ min: Math.floor(Math.random() * 88) + 1, type: pick(types) });
        }

        // Yellow card chance
        if (Math.random() < 0.35) {
            events.push({ min: Math.floor(Math.random() * 85) + 5, type: 'yellowcard' });
        }

        // Half time
        events.push({ min: 45, type: 'halftime' });

        // Sort by minute
        events.sort((a, b) => a.min - b.min);

        events.forEach(ev => {
            let text = '';
            switch (ev.type) {
                case 'player_goal': text = format(pick(pool.goal), playerName, teamName); break;
                case 'concede':     text = format(pick(pool.concede), playerName, teamName); break;
                case 'halftime':    text = format(pick(pool.halftime), playerName, teamName); break;
                case 'yellowcard':  text = format(pick(pool.yellowcard), playerName, teamName); break;
                case 'chance':      text = format(pick(pool.chance), playerName, teamName); break;
                case 'pressure':    text = format(pick(pool.pressure), playerName, teamName); break;
                default:            text = format(pick(pool.possession), playerName, teamName);
            }
            lines.push({ min: ev.min, text });
        });

        lines.sort((a, b) => a.min - b.min);
        lines.push({ min: 90, text: format(pick(pool.fulltime), playerName, teamName) });

        return lines;
    }

    // ── Render commentary ticker ──────────────────────────────────────────────
    let tickerEl  = null;
    let tickerInt = null;

    function createTicker() {
        if (document.getElementById('gs-commentary-ticker')) return;
        tickerEl = document.createElement('div');
        tickerEl.id = 'gs-commentary-ticker';
        tickerEl.innerHTML = `
            <div class="ct-inner">
                <div class="ct-live-badge">🔴 LIVE</div>
                <div class="ct-lines" id="ct-lines-wrap"></div>
            </div>
        `;
        document.body.appendChild(tickerEl);
    }

    function showTicker() {
        createTicker();
        tickerEl.classList.add('active');
    }

    function hideTicker() {
        if (tickerEl) tickerEl.classList.remove('active');
        if (tickerInt) { clearInterval(tickerInt); tickerInt = null; }
    }

    function addLine(text, isGoal = false) {
        const wrap = document.getElementById('ct-lines-wrap');
        if (!wrap) return;
        const line = document.createElement('div');
        line.className = `ct-line ${isGoal ? 'ct-goal-line' : ''}`;
        line.textContent = text;
        wrap.insertBefore(line, wrap.firstChild);
        // Keep only last 5 lines
        while (wrap.children.length > 5) wrap.removeChild(wrap.lastChild);
        line.classList.add('ct-line-in');
    }

    function playCommentary(sequence, totalDurationMs = 4000) {
        showTicker();
        const intervalMs = totalDurationMs / Math.max(sequence.length, 1);
        let idx = 0;
        tickerInt = setInterval(() => {
            if (idx >= sequence.length) {
                clearInterval(tickerInt);
                tickerInt = null;
                setTimeout(hideTicker, 2000);
                return;
            }
            const line = sequence[idx++];
            const isGoal = line.text.includes('⚽');
            addLine(`${line.min}' ${line.text}`, isGoal);
        }, intervalMs);
    }

    // ── Quick single line ─────────────────────────────────────────────────────
    function quickComment(text) {
        showTicker();
        addLine(text);
        if (tickerInt) clearInterval(tickerInt);
        tickerInt = setTimeout(hideTicker, 3500);
    }

    return { generateMatchSequence, playCommentary };
})();

window.GS_Commentary = GS_Commentary;


// ── Extended commentary pools ───────────────────────────────────────────────
const EXTENDED_COMMENTARY = {
    it: {
        opening: [
            "🎙️ Benvenuti allo stadio! Il pubblico è in delirio per questa sfida!",
            "🎙️ Si parte! Le due squadre scendono in campo tra il boato dei tifosi!",
            "🎙️ Fischio d'avvio! La posta in palio è altissima stanotte!",
            "🎙️ Eccoci! Atmosfera straordinaria allo stadio — inizia la partita!",
            "🎙️ Il terreno di gioco è perfetto, la tensione è alle stelle — SI COMINCIA!",
            "🎙️ Stadio pieno, cori assordanti — il calcio è davvero la religione di questo paese!",
            "🎙️ L'arbitro chiama i capitani al centro, poi fischia. Partenza!",
        ],
        dribbling: [
            "🎙️ Che dribbling! {player} supera l'avversario come se non ci fosse!",
            "🎙️ Finta, controfinta — l'avversario resta sul posto. {player} è irresistibile!",
            "🎙️ {player} entra in area saltando DUE difensori! Il pubblico è in piedi!",
            "🎙️ Che accelerazione di {player}! Lascia il terzino nella polvere!",
            "🎙️ Palleggio stretto, cambio di direzione fulmineo — {player} trova lo spazio!",
            "🎙️ Elastic touch perfetto! {player} beffa il marcatore con eleganza assoluta!",
        ],
        save: [
            "🎙️ CHE PARATA! Il portiere si tuffa alla sua sinistra e respinge in angolo!",
            "🎙️ Traversa! Il legno nega il gol a {player} — incredibile!",
            "🎙️ Paratona del portiere — negato il gol con una mano di ferro!",
            "🎙️ Palo interno! La palla rotola sulla linea e viene spazzata via!",
            "🎙️ Il portiere dice no! Riflesso felino su un tiro ravvicinato!",
            "🎙️ Angolo. Buona uscita del portiere avversario — per ora la porta è inviolata.",
        ],
        corner: [
            "🎙️ Calcio d'angolo per {team}. Si prepara la battuta...",
            "🎙️ Corner! I difensori si posizionano, l'attacco si prepara al secondo palo!",
            "🎙️ Angolo battuto in area — mischia davanti alla porta!",
        ],
        freekick: [
            "🎙️ Punizione dal limite! {player} prende la rincorsa...",
            "🎙️ Fallo tattico! Punizione in zona pericolosa per {team}!",
            "🎙️ Il calcio di punizione si prepara — posizione interessante!",
        ],
        booking: [
            "🎙️ 🟨 Giallo! Proteste eccessive — ammonito.",
            "🎙️ 🟨 Entrata dura, l'arbitro non ci pensa due volte: giallo.",
            "🎙️ 🟨 Cartellino giallo — la partita è calda!",
        ],
        substitution: [
            "🎙️ Sostituzione: il mister vuole cambiare qualcosa nel gioco.",
            "🎙️ Cambio tattico — entra energia fresca.",
            "🎙️ Si scalda il sostituto. Il tecnico vuole più vivacità.",
        ],
        injury_time: [
            "🎙️ ⏱️ Quattro minuti di recupero! Può succedere ancora tutto!",
            "🎙️ ⏱️ Sei minuti di extra time! Le partite non finiscono mai!",
            "🎙️ ⏱️ Tre minuti aggiunti — il portiere si porta avanti sulla punizione!",
        ],
        var_check: [
            "🎙️ 📺 VAR IN CORSO... l'arbitro a bordocampo controlla le immagini.",
            "🎙️ 📺 Interruzione di gioco — si aspetta la decisione del VAR.",
            "🎙️ 📺 Gol in dubbio — il VAR sta analizzando la posizione!",
        ],
        goal_description: [
            "🎙️ ⚽ GOOOOL! Tiro potente di {player} — il portiere non ci arriva!",
            "🎙️ ⚽ RETE! {player} è tutto solo davanti al portiere e non sbaglia!",
            "🎙️ ⚽ CHE GOL! Pallonetto magistrale di {player} — una prodezza!",
            "🎙️ ⚽ RETE DI TESTA! {player} sovrasta i difensori e insacca!",
            "🎙️ ⚽ GOOOOOL! Contropiede fulmineo e {player} chiude tutto con il destro!",
            "🎙️ ⚽ RABONA! {player} ha segnato con la rabona — gol da antologia!",
            "🎙️ ⚽ CURVA PERFETTA! Il tiro a giro di {player} si insacca all'incrocio!",
            "🎙️ ⚽ GOOOOAL! Assist illuminante e {player} la mette in rete a botta sicura!",
            "🎙️ ⚽ CUCCHIAIO! {player} beffa il portiere in uscita con uno scavetto da sogno!",
            "🎙️ ⚽ PRIMA RETE! {player} segna il primo gol della sua carriera!",
            "🎙️ ⚽ TRIPLETTA COMPLETATA! {player} è già in tripla cifra — oggi!",
            "🎙️ ⚽ GOL DEL SORPASSO! {player} ribalta il risultato — tifosi in estasi!",
        ],
        atmosphere: [
            "🎙️ Lo stadio è un catino infernale — i tifosi spingono la squadra!",
            "🎙️ Silenzio assordante per un momento... poi il boato. Atmosfera magica.",
            "🎙️ I fumogeni colorano la curva — spettacolo dentro e fuori dal campo!",
            "🎙️ Cori senza sosta dalla tribuna — il dodicesimo uomo si fa sentire!",
            "🎙️ La tensione è palpabile — ogni palla contesa accende la folla!",
            "🎙️ La curva ultrà: un muro di tifo che fa tremare le pareti dello stadio!",
        ],
        injury_news: [
            "🎙️ 🚨 Il giocatore è a terra — staff medico in campo!",
            "🎙️ 🚨 Brutto intervento! Si teme per le condizioni del calciatore.",
            "🎙️ 🩹 Trattamento a bordo campo — si riprende il gioco.",
        ],
        tactical: [
            "🎙️ {team} sta abbassando il baricentro — vuole sfruttare i contropiedi.",
            "🎙️ Pressing altissimo degli avversari — difficile impostare l'azione.",
            "🎙️ Blocco difensivo compatto — ogni spazio è presidiato.",
            "🎙️ {team} gioca corto e cerca di far girare il pallone rapidamente.",
            "🎙️ Cambio modulo in corso — si nota dal posizionamento dei giocatori.",
        ],
        near_miss: [
            "🎙️ CLAMOROSO! {player} colpisce il palo da due passi! Che beffa!",
            "🎙️ Fuori di poco! Il tiro di {player} sfiora il palo alla sinistra del portiere!",
            "🎙️ Alto! {player} si dispera — non riesce a credere di aver mancato il gol!",
            "🎙️ Incredibile! Palo, traversa... e la palla esce! La sfortuna si accanisce!",
            "🎙️ Il VAR controlla la posizione — sembrava tutto ok, ma è fuorigioco di millimetri!",
        ],
        endgame: [
            "🎙️ Siamo all'80° — il cronometro stringe, le gambe pesano!",
            "🎙️ 85°! Cinque minuti più recupero. Ogni secondo vale oro!",
            "🎙️ Difesa a oltranza — il {team} prova a portare a casa il risultato!",
            "🎙️ Lancio lungo alla disperata — ultima speranza!",
            "🎙️ L'arbitro guarda l'orologio — quasi finita!",
        ],
        post_goal: [
            "🎙️ Esultanza liberatoria! {player} corre verso la curva!",
            "🎙️ Tutti intorno a {player} — la squadra lo travolge di abbracci!",
            "🎙️ La panchina intera scatta in piedi — che gol, che momento!",
            "🎙️ I tifosi sono in delirio — cori, fumogeni, lacrime di gioia!",
        ],
        fulltime: [
            "🎙️ TRIPLICE FISCHIO! La partita è finita!",
            "🎙️ L'arbitro fischia tre volte! Tutto finito!",
            "🎙️ Fine della partita! I giocatori si scambiano le maglie.",
            "🎙️ Fischio finale! Strette di mano, applausi — il calcio è anche questo.",
            "🎙️ Triplice fischio! Il risultato è definitivo!",
        ],
    },
    en: {
        opening: [
            "🎙️ Welcome to the stadium! The crowd is electric for this clash!",
            "🎙️ We're off! Both teams take to the pitch amid thunderous applause!",
            "🎙️ Kickoff! The stakes couldn't be higher tonight!",
            "🎙️ Here we go! The atmosphere is extraordinary — game on!",
            "🎙️ Perfect pitch, maximum tension — IT BEGINS!",
            "🎙️ Packed stadium, deafening chants — football truly is the beautiful game!",
            "🎙️ Referee calls the captains, then the whistle. We're away!",
        ],
        dribbling: [
            "🎙️ What a dribble! {player} beats the defender like he's not even there!",
            "🎙️ Feint, counter-feint — the defender is rooted to the spot. {player} is unstoppable!",
            "🎙️ {player} drives into the box past TWO defenders! The crowd is on its feet!",
            "🎙️ What acceleration from {player}! The full-back is left in his wake!",
            "🎙️ Tight control, lightning direction change — {player} finds the space!",
            "🎙️ Perfect elastic touch! {player} leaves the marker behind with effortless class!",
        ],
        save: [
            "🎙️ WHAT A SAVE! The keeper dives to his left and pushes it wide!",
            "🎙️ Crossbar! The woodwork denies {player} — unbelievable!",
            "🎙️ Stunning save from the keeper — denied with an iron fist!",
            "🎙️ Post! The ball rolls along the line before being cleared!",
            "🎙️ The keeper says no! Feline reflexes on a close-range effort!",
            "🎙️ Corner. Good positioning by the keeper — the goal holds for now.",
        ],
        corner: [
            "🎙️ Corner for {team}. The delivery is being set up...",
            "🎙️ Corner! Defenders get set, attackers position for the second post!",
            "🎙️ Corner delivered into the box — goalmouth scramble!",
        ],
        freekick: [
            "🎙️ Free kick from the edge! {player} takes a run-up...",
            "🎙️ Cynical foul! Dangerous free kick position for {team}!",
            "🎙️ The free kick is being set up — interesting position!",
        ],
        booking: [
            "🎙️ 🟨 Yellow! Excessive protests — he's booked.",
            "🎙️ 🟨 Reckless challenge, the referee doesn't hesitate: yellow card.",
            "🎙️ 🟨 Yellow card — this match is getting heated!",
        ],
        substitution: [
            "🎙️ Substitution: the manager wants to change something.",
            "🎙️ Tactical change — fresh legs coming on.",
            "🎙️ The substitute warms up. The manager wants more dynamism.",
        ],
        injury_time: [
            "🎙️ ⏱️ Four minutes added! Everything can still happen!",
            "🎙️ ⏱️ Six minutes of extra time! Games never end!",
            "🎙️ ⏱️ Three minutes extra — keeper comes forward for set pieces!",
        ],
        var_check: [
            "🎙️ 📺 VAR CHECK... referee heads to the pitchside monitor.",
            "🎙️ 📺 Play stopped — awaiting the VAR decision.",
            "🎙️ 📺 Goal in doubt — VAR is analysing the offside line!",
        ],
        goal_description: [
            "🎙️ ⚽ GOOOAL! Powerful shot from {player} — keeper had no chance!",
            "🎙️ ⚽ IN THE NET! {player} was one-on-one and made no mistake!",
            "🎙️ ⚽ WHAT A GOAL! Exquisite chip from {player} — a masterpiece!",
            "🎙️ ⚽ HEADER! {player} rises above the defenders and nods it in!",
            "🎙️ ⚽ GOOOAL! Lightning counter-attack and {player} finishes with his right!",
            "🎙️ ⚽ RABONA! {player} scored with a rabona — a goal for the ages!",
            "🎙️ ⚽ PERFECT CURL! {player}'s curling effort nestles in the top corner!",
            "🎙️ ⚽ GOOOAL! Brilliant assist and {player} slots it in from close range!",
            "🎙️ ⚽ CHIP! {player} lobs the onrushing keeper — dreamlike finish!",
            "🎙️ ⚽ FIRST GOAL! {player} opens their career account!",
            "🎙️ ⚽ HAT-TRICK COMPLETE! {player} is already at three today!",
            "🎙️ ⚽ THE WINNER! {player} turns the game around — fans are in ecstasy!",
        ],
        atmosphere: [
            "🎙️ The stadium is a cauldron — the fans are driving their team forward!",
            "🎙️ A moment of hushed silence... then a deafening roar. Magical atmosphere.",
            "🎙️ Coloured flares light up the end — a spectacle on and off the pitch!",
            "🎙️ Non-stop chants from the stands — the twelfth man making himself heard!",
            "🎙️ The tension is palpable — every contested ball ignites the crowd!",
            "🎙️ The ultras: a wall of support that makes the stadium shake!",
        ],
        injury_news: [
            "🎙️ 🚨 The player is down — medical staff rush onto the pitch!",
            "🎙️ 🚨 Nasty challenge! Concerns growing for the stricken player.",
            "🎙️ 🩹 Treatment at the touchline — play resumes.",
        ],
        tactical: [
            "🎙️ {team} is dropping deeper — looking to exploit the counter.",
            "🎙️ High press from the opponents — hard to play out from the back.",
            "🎙️ Compact defensive block — every gap is covered.",
            "🎙️ {team} playing short and sharp, trying to circulate the ball quickly.",
            "🎙️ Formation change apparent — you can see it in the positioning.",
        ],
        near_miss: [
            "🎙️ INCREDIBLE! {player} hits the post from two yards! What a miss!",
            "🎙️ Just wide! {player}'s effort grazes the post to the keeper's left!",
            "🎙️ Over! {player} is in disbelief — can't believe they missed that!",
            "🎙️ Post, crossbar... and it stays out! The cruel hand of fate strikes!",
            "🎙️ VAR checks for offside — and it IS offside, by a whisker!",
        ],
        endgame: [
            "🎙️ We're at the 80th — the clock is ticking, legs are heavy!",
            "🎙️ 85 minutes! Five left plus stoppage. Every second is precious!",
            "🎙️ Backs to the wall — {team} trying to hold on for the result!",
            "🎙️ Long ball forward — last throw of the dice!",
            "🎙️ Referee checks his watch — almost there!",
        ],
        post_goal: [
            "🎙️ Scenes of wild celebration! {player} sprints toward the fans!",
            "🎙️ Teammates swarm around {player} — absolutely buried under hugs!",
            "🎙️ The entire bench has leapt to its feet — what a goal, what a moment!",
            "🎙️ Fans are going wild — chants, flares, tears of joy!",
        ],
        fulltime: [
            "🎙️ FULL TIME WHISTLE! The match is over!",
            "🎙️ Three blows of the whistle! It's all done!",
            "🎙️ Game over! Players exchange shirts — mutual respect on display.",
            "🎙️ Final whistle! Handshakes, applause — this is football too.",
            "🎙️ The referee blows for time! The result is confirmed!",
        ],
    },
    de: {
        opening: [
            "🎙️ Willkommen im Stadion! Das Publikum brennt für dieses Duell!",
            "🎙️ Los geht's! Beide Teams betreten das Feld unter tosendem Applaus!",
            "🎙️ Anpfiff! Der Einsatz könnte heute Abend kaum höher sein!",
            "🎙️ Hier sind wir! Außergewöhnliche Atmosphäre — das Spiel beginnt!",
            "🎙️ Perfekter Rasen, maximale Spannung — ES BEGINNT!",
        ],
        dribbling: [
            "🎙️ Was für ein Dribbling! {player} lässt den Verteidiger stehen!",
            "🎙️ Täuschung, Gegentäuschung — der Verteidiger steht wie festgenagelt. {player} ist nicht aufzuhalten!",
            "🎙️ {player} dringt am Strafraum an ZWEI Verteidigern vorbei! Das Publikum steht!",
            "🎙️ Was für eine Beschleunigung von {player}!",
        ],
        save: [
            "🎙️ WAS FÜR EINE PARADE! Der Torwart taucht und wehrt ab!",
            "🎙️ Latte! Das Holz rettet {team} — unglaublich!",
            "🎙️ Überragende Parade — eiskalt abgewehrt!",
            "🎙️ Pfosten! Der Ball rollt an der Linie entlang!",
        ],
        corner: [
            "🎙️ Eckball für {team}. Die Flanke wird vorbereitet...",
            "🎙️ Ecke! Verteidiger formieren sich, Angreifer warten am zweiten Pfosten!",
            "🎙️ Flanke in den Strafraum — wildes Gewühl vor dem Tor!",
        ],
        freekick: [
            "🎙️ Freistoß vom Strafraumrand! {player} nimmt Anlauf...",
            "🎙️ Absichtliches Foul! Gefährliche Freistoßposition für {team}!",
            "🎙️ Der Freistoß wird vorbereitet — interessante Position!",
        ],
        booking: [
            "🎙️ 🟨 Gelb! Zu viele Proteste — er wird verwarnt.",
            "🎙️ 🟨 Rücksichtsloses Foul, der Schiedsrichter zögert nicht: Gelb.",
            "🎙️ 🟨 Gelbe Karte — dieses Spiel wird hitziger!",
        ],
        substitution: [
            "🎙️ Auswechslung: Der Trainer will etwas verändern.",
            "🎙️ Taktischer Wechsel — frische Beine kommen.",
            "🎙️ Der Einwechselspieler wärmt sich auf.",
        ],
        injury_time: [
            "🎙️ ⏱️ Vier Minuten Nachspielzeit! Alles ist noch möglich!",
            "🎙️ ⏱️ Sechs Minuten extra! Spiele enden nie!",
            "🎙️ ⏱️ Drei Minuten Nachspielzeit!",
        ],
        var_check: [
            "🎙️ 📺 VAR-ÜBERPRÜFUNG... Schiedsrichter geht zum Monitor.",
            "🎙️ 📺 Spiel unterbrochen — VAR-Entscheidung steht aus.",
            "🎙️ 📺 Tor in der Diskussion — VAR analysiert die Abseitsposition!",
        ],
        goal_description: [
            "🎙️ ⚽ TOOOOR! Wuchtiger Schuss von {player} — keine Chance für den Torwart!",
            "🎙️ ⚽ DRIN! {player} stand allein und ließ sich nicht bitten!",
            "🎙️ ⚽ WAS EIN TOR! Perfekter Heber von {player}!",
            "🎙️ ⚽ KOPFBALL! {player} steigt über die Abwehr und nickt ein!",
            "🎙️ ⚽ TOOOOR! Blitzschneller Konter und {player} vollendet mit rechts!",
            "🎙️ ⚽ RABONA! {player} trifft mit der Rabona — ein Tor für die Ewigkeit!",
            "🎙️ ⚽ PERFEKTE KURVE! {player} zieht in den Winkel!",
            "🎙️ ⚽ TOOOOR! Geniale Vorlage und {player} schiebt ein!",
            "🎙️ ⚽ ERSTES TOR! {player} eröffnet sein Karrierekonto!",
            "🎙️ ⚽ HATTRICK! {player} steht heute schon bei drei Toren!",
        ],
        atmosphere: [
            "🎙️ Das Stadion ist ein Kessel — die Fans treiben ihr Team an!",
            "🎙️ Moment der Stille... dann ein ohrenbetäubendes Brüllen. Magische Atmosphäre.",
            "🎙️ Nicht endende Gesänge von den Rängen!",
        ],
        injury_news: [
            "🎙️ 🚨 Der Spieler liegt am Boden — der Sanitätsdienst eilt aufs Feld!",
            "🎙️ 🚨 Böses Foul! Sorge um den getroffenen Spieler.",
            "🎙️ 🩹 Behandlung am Spielfeldrand — das Spiel geht weiter.",
        ],
        tactical: [
            "🎙️ {team} zieht sich zurück — will Konter nutzen.",
            "🎙️ Hohes Pressing der Gegner — schwer aufzubauen.",
            "🎙️ Kompakter Defensivblock — jede Lücke ist abgedeckt.",
            "🎙️ {team} spielt kurz und schnell, versucht den Ball laufen zu lassen.",
        ],
        near_miss: [
            "🎙️ UNGLAUBLICH! {player} trifft den Pfosten aus zwei Metern!",
            "🎙️ Knapp vorbei! {player}'s Schuss streift den Pfosten!",
            "🎙️ Drüber! {player} kann es nicht fassen!",
            "🎙️ Pfosten, Latte... und draußen! Das Pech schlägt zu!",
        ],
        endgame: [
            "🎙️ Wir sind in der 80. — die Uhr tickt, die Beine werden schwer!",
            "🎙️ 85 Minuten! Fünf plus Nachspielzeit. Jede Sekunde zählt!",
            "🎙️ {team} hält die Stellung — versucht das Ergebnis zu sichern!",
        ],
        post_goal: [
            "🎙️ Wilde Jubelszenen! {player} rennt zu den Fans!",
            "🎙️ Mitspieler stürmen auf {player} ein — begraben unter Umarmungen!",
            "🎙️ Die gesamte Bank ist aufgesprungen — was für ein Moment!",
        ],
        fulltime: [
            "🎙️ SCHLUSSPFIFF! Das Spiel ist vorbei!",
            "🎙️ Dreimal pfeifen! Alles vorbei!",
            "🎙️ Abgepfiffen! Trikottausch — gegenseitiger Respekt.",
            "🎙️ Abschlusspfiff! Handshakes, Applaus — auch das ist Fußball.",
        ],
    },
    es: {
        opening: [
            "🎙️ ¡Bienvenidos al estadio! ¡El público está en llamas para este duelo!",
            "🎙️ ¡Arrancamos! ¡Ambos equipos saltan al campo entre una ovación ensordecedora!",
            "🎙️ ¡Pitido inicial! ¡Lo que se juega esta noche no puede ser mayor!",
            "🎙️ ¡Aquí estamos! Ambiente extraordinario — ¡que comience el partido!",
            "🎙️ ¡Césped perfecto, tensión máxima — EMPIEZA!",
        ],
        dribbling: [
            "🎙️ ¡Qué regate! ¡{player} deja al defensor como si no existiera!",
            "🎙️ ¡Amago, contra-amago — el defensor está clavado! ¡{player} es imparable!",
            "🎙️ ¡{player} se mete en el área ante DOS defensores! ¡El público en pie!",
            "🎙️ ¡Qué aceleración de {player}!",
        ],
        save: [
            "🎙️ ¡QUÉ PARADA! ¡El portero se lanza y lo desvía!",
            "🎙️ ¡Al larguero! ¡El palo salva a {team}!",
            "🎙️ ¡Parada increíble — detenido con puño de hierro!",
            "🎙️ ¡Al poste! ¡El balón rueda por la línea antes de ser despejado!",
        ],
        corner: [
            "🎙️ Córner para {team}. Se prepara el saque...",
            "🎙️ ¡Córner! Los defensores se colocan, los atacantes esperan en el segundo palo.",
            "🎙️ ¡Saque de esquina al área — barullo en el área pequeña!",
        ],
        freekick: [
            "🎙️ ¡Falta desde el borde del área! {player} toma carrerilla...",
            "🎙️ ¡Falta flagrante! Posición peligrosa de falta directa para {team}.",
            "🎙️ Se prepara la falta — ¡posición interesante!",
        ],
        booking: [
            "🎙️ 🟨 ¡Amarilla! Protestas excesivas — amonestado.",
            "🎙️ 🟨 ¡Entrada temeraria, el árbitro no duda: tarjeta amarilla!",
            "🎙️ 🟨 ¡Tarjeta amarilla — el partido se está calentando!",
        ],
        substitution: [
            "🎙️ Sustitución: el entrenador quiere cambiar algo.",
            "🎙️ Cambio táctico — entran piernas frescas.",
            "🎙️ El sustituto se calienta. El míster quiere más dinamismo.",
        ],
        injury_time: [
            "🎙️ ⏱️ ¡Cuatro minutos añadidos! ¡Todavía puede pasar de todo!",
            "🎙️ ⏱️ ¡Seis minutos extra! ¡Los partidos nunca terminan!",
            "🎙️ ⏱️ ¡Tres minutos de descuento — el portero sube a los córneres!",
        ],
        var_check: [
            "🎙️ 📺 REVISIÓN VAR... el árbitro se dirige al monitor.",
            "🎙️ 📺 Juego detenido — esperando la decisión del VAR.",
            "🎙️ 📺 ¡Gol en duda — el VAR analiza la línea del fuera de juego!",
        ],
        goal_description: [
            "🎙️ ⚽ ¡GOOOOOL! ¡Potente disparo de {player} — el portero no pudo hacer nada!",
            "🎙️ ⚽ ¡DENTRO! ¡{player} estaba solo y no falló!",
            "🎙️ ⚽ ¡QUÉ GOL! ¡Exquisito globo de {player}!",
            "🎙️ ⚽ ¡CABEZAZO! ¡{player} se eleva sobre la defensa y la manda al fondo!",
            "🎙️ ⚽ ¡GOOOOOL! ¡Contraataque relámpago y {player} finaliza con la derecha!",
            "🎙️ ⚽ ¡RABONA! ¡{player} marcó de rabona — un gol para la historia!",
            "🎙️ ⚽ ¡VASELINA PERFECTA! ¡El disparo de {player} se cuela por la escuadra!",
            "🎙️ ⚽ ¡PRIMER GOL! ¡{player} abre su cuenta en carrera!",
            "🎙️ ⚽ ¡HAT-TRICK! ¡{player} ya lleva tres hoy!",
            "🎙️ ⚽ ¡EL GANADOR! ¡{player} le da la vuelta al partido!",
        ],
        atmosphere: [
            "🎙️ ¡El estadio es un caldero — los aficionados empujan a su equipo!",
            "🎙️ Un momento de silencio... luego un rugido ensordecedor. Atmósfera mágica.",
            "🎙️ ¡Cánticos sin parar desde las gradas — el duodécimo jugador se hace sentir!",
        ],
        injury_news: [
            "🎙️ 🚨 ¡El jugador está en el suelo — el cuerpo médico salta al campo!",
            "🎙️ 🚨 ¡Entrada brutal! Preocupación por el estado del jugador.",
            "🎙️ 🩹 Atención en la banda — el juego se reanuda.",
        ],
        tactical: [
            "🎙️ {team} se repliega — quiere aprovechar los contragolpes.",
            "🎙️ Presión alta de los rivales — difícil salir jugando.",
            "🎙️ Bloque defensivo compacto — cada espacio está cubierto.",
            "🎙️ {team} juega corto y rápido, intentando mover el balón velozmente.",
        ],
        near_miss: [
            "🎙️ ¡INCREÍBLE! ¡{player} golpea el palo a dos metros! ¡Qué mala suerte!",
            "🎙️ ¡Por poco! ¡El tiro de {player} roza el poste!",
            "🎙️ ¡Fuera! ¡{player} no puede creer que haya fallado eso!",
            "🎙️ ¡Poste, travesaño... y fuera! ¡La mala suerte se ceba!",
        ],
        endgame: [
            "🎙️ ¡Estamos en el 80° — el reloj aprieta, las piernas pesan!",
            "🎙️ ¡85 minutos! Cinco más el descuento. ¡Cada segundo es oro!",
            "🎙️ ¡{team} aguanta la situación — intenta llevarse el resultado!",
        ],
        post_goal: [
            "🎙️ ¡Escenas de celebración salvaje! ¡{player} corre hacia la afición!",
            "🎙️ ¡Los compañeros rodean a {player} — enterrado bajo abrazos!",
            "🎙️ ¡Todo el banquillo ha saltado — qué gol, qué momento!",
            "🎙️ ¡Los fans enloquecen — cánticos, bengalas, lágrimas de alegría!",
        ],
        fulltime: [
            "🎙️ ¡PITIDO FINAL! ¡El partido ha terminado!",
            "🎙️ ¡Tres pitidos! ¡Todo concluido!",
            "🎙️ ¡Fin del partido! Intercambio de camisetas — respeto mutuo.",
            "🎙️ ¡Pitido final! Apretones de manos, aplausos — esto también es fútbol.",
        ],
    },
};

// ── Enhanced commentary generation ───────────────────────────────────────────
function generateRichCommentary(playerName, teamName, matchData, lang = 'it') {
    const pool = EXTENDED_COMMENTARY[lang] || EXTENDED_COMMENTARY.it;
    const lines = [];
    const t = performance.now();

    function fmt(str) {
        return str.replace(/\{player\}/g, playerName).replace(/\{team\}/g, teamName);
    }

    // Opening
    lines.push({ min: 1, text: fmt(pick(pool.opening)), type: 'opening' });

    // Early action (5-15 min)
    const earlyTypes = ['tactical', 'atmosphere', 'dribbling'];
    const earlyCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < earlyCount; i++) {
        const type = earlyTypes[Math.floor(Math.random() * earlyTypes.length)];
        lines.push({ min: 5 + i * 5, text: fmt(pick(pool[type] || pool.tactical)), type });
    }

    // Midgame events (20-70 min)
    const gol = matchData?.gol || 0;
    const esito = matchData?.esito || 'P';

    // Player goals
    const goalMinutes = [];
    for (let g = 0; g < gol; g++) {
        const min = 20 + Math.floor(Math.random() * 60);
        goalMinutes.push(min);
        lines.push({ min, text: fmt(pick(pool.goal_description || pool.goal)), type: 'goal' });
        if (Math.random() > 0.4) {
            lines.push({ min: min + 1, text: fmt(pick(pool.post_goal)), type: 'post_goal' });
        }
    }

    // Near misses
    const missCount = Math.floor(Math.random() * 3);
    for (let m = 0; m < missCount; m++) {
        lines.push({ min: 15 + Math.floor(Math.random() * 60), text: fmt(pick(pool.near_miss)), type: 'near_miss' });
    }

    // Saves / keeper events
    const saveCount = 1 + Math.floor(Math.random() * 3);
    for (let s = 0; s < saveCount; s++) {
        lines.push({ min: 10 + Math.floor(Math.random() * 70), text: fmt(pick(pool.save)), type: 'save' });
    }

    // Set pieces
    if (Math.random() > 0.5) {
        lines.push({ min: 30 + Math.floor(Math.random() * 40), text: fmt(pick(pool.corner)), type: 'corner' });
    }
    if (Math.random() > 0.6) {
        lines.push({ min: 20 + Math.floor(Math.random() * 50), text: fmt(pick(pool.freekick)), type: 'freekick' });
    }

    // Bookings
    if (Math.random() > 0.55) {
        lines.push({ min: 25 + Math.floor(Math.random() * 55), text: fmt(pick(pool.booking)), type: 'booking' });
    }

    // VAR (random)
    if (Math.random() > 0.75) {
        lines.push({ min: 40 + Math.floor(Math.random() * 30), text: fmt(pick(pool.var_check)), type: 'var' });
    }

    // Injury
    if (Math.random() > 0.7) {
        lines.push({ min: 15 + Math.floor(Math.random() * 60), text: fmt(pick(pool.injury_news)), type: 'injury' });
    }

    // Atmosphere mid-game
    lines.push({ min: 50, text: fmt(pick(pool.atmosphere)), type: 'atmosphere' });

    // Injury time
    lines.push({ min: 90, text: fmt(pick(pool.injury_time)), type: 'injury_time' });

    // Concede events for losses/draws
    if (esito === 'S' || esito === 'P') {
        const concedeCount = esito === 'S' ? 1 + Math.floor(Math.random() * 2) : 1;
        for (let c = 0; c < concedeCount; c++) {
            lines.push({ min: 10 + Math.floor(Math.random() * 75), text: {it:'🎙️ RETE! Segnano gli avversari — pareggio!',en:'🎙️ GOAL! The opposition strikes — equaliser!',de:'🎙️ TOR! Die Gegner treffen — Ausgleich!',es:'🎙️ ¡GOL! El rival marca — ¡empate!'}[lang]||'🎙️ RETE! Segnano gli avversari — pareggio!', type: 'concede' });
        }
    }

    // Endgame
    lines.push({ min: 82, text: fmt(pick(pool.endgame)), type: 'endgame' });

    // Full time
    lines.push({ min: 93, text: fmt(pick(pool.fulltime)), type: 'fulltime' });

    // Sort by minute
    lines.sort((a, b) => a.min - b.min);
    return lines;
}

// Export extended commentary
if (typeof window !== 'undefined') {
    window.EXTENDED_COMMENTARY = EXTENDED_COMMENTARY;
    window.generateRichCommentary = generateRichCommentary;
}

// ── Extended commentary pools ─────────────────────────────────────────────────
const GS_CommentaryExtended = {
    it: {
        nearMiss: [
            "🎙️ Che occasione sprecata! Il pallone sfila di un soffio a lato!",
            "🎙️ Palo pieno! La traversa salva il portiere, il pubblico trattiene il fiato!",
            "🎙️ Miracolo del portiere! Volo plastico per deviare in angolo!",
            "🎙️ {player} calcia al volo, ma il tiro termina alto! Peccato!",
            "🎙️ Azione bellissima, conclusione sbagliata! L'occasione c'era.",
            "🎙️ Il cross è perfetto, ma la deviazione finisce fuori di poco!",
            "🎙️ Riflesso del portiere prodigioso! Ha visto il pallone all'ultimo secondo.",
        ],
        teamwork: [
            "🎙️ Tre passaggi di prima, la {team} gioca a memoria!",
            "🎙️ Uno-due che mette fuori tempo tutta la difesa avversaria.",
            "🎙️ {player} dialoga con il compagno e si smarca in profondità.",
            "🎙️ Pressing organizzato della {team}, recupero palla prezioso!",
            "🎙️ Schema studiato: corner corto, triangolo e tiro a rete!",
        ],
        tactical: [
            "🎙️ Il mister ha cambiato modulo: passaggio al 4-3-3 con {player} largo a destra.",
            "🎙️ La {team} abbassa il baricentro e cerca di ripartire in contropiede.",
            "🎙️ Pressing alto degli avversari, la difesa della {team} deve alzare il suo livello.",
            "🎙️ Il centrocampo della {team} fa da scudo, permettendo a {player} di spingere.",
        ],
        stadium: [
            "🎙️ Lo stadio è in piedi, la curva non si siede dall'inizio della partita!",
            "🎙️ Il pubblico fischia l'arbitro dopo quella decisione controversa.",
            "🎙️ Cori incessanti dagli spalti: i tifosi della {team} spingono a più non posso.",
            "🎙️ Standing ovation per l'uscita di {player}: prestazione da applausi.",
        ],
        weather: [
            "🎙️ La pioggia rende il campo pesante, i giocatori devono adattare il proprio gioco.",
            "🎙️ Vento forte sul rettangolo di gioco: i calci piazzati diventano un'incognita.",
            "🎙️ Terreno perfetto questa sera, ideale per un bel calcio spettacolo.",
        ],
        injury: [
            "🎙️ {player} è a terra dolorante, lo staff medico corre in campo!",
            "🎙️ Brutto scontro di gioco, si spera non sia nulla di grave per {player}.",
            "🎙️ {player} torna in campo dopo le cure, segnale positivo!",
        ],
    },
    en: {
        nearMiss: [
            "🎙️ What a chance wasted! The ball slides just wide!",
            "🎙️ Off the post! The crossbar saves the keeper, the crowd holds its breath!",
            "🎙️ What a save! A flying stop to push it round the corner!",
            "🎙️ {player} volleys it, but the shot goes high! Such a shame!",
            "🎙️ Beautiful move, poor finish! The chance was there.",
            "🎙️ The cross is perfect but the deflection goes just wide!",
            "🎙️ Instinctive keeper save! They saw the ball at the very last moment.",
        ],
        teamwork: [
            "🎙️ Three first-time passes, {team} playing from memory!",
            "🎙️ A one-two that leaves the entire defence wrong-footed.",
            "🎙️ {player} combines with a team-mate and bursts into the box.",
            "🎙️ Organised press from {team}, they win the ball back!",
            "🎙️ Set-piece routine: short corner, triangle, shot on goal!",
        ],
        tactical: [
            "🎙️ The manager has switched shape: {player} now operating wide on the right.",
            "🎙️ {team} drop deep and look to hit on the counter-attack.",
            "🎙️ High press from the opposition, the {team} defence must stay sharp.",
            "🎙️ The midfield shields well, letting {player} push forward freely.",
        ],
        stadium: [
            "🎙️ The stadium is rocking, the home end haven't sat down all match!",
            "🎙️ The fans are unhappy with that decision from the referee.",
            "🎙️ Non-stop chanting from the {team} supporters — they're driving their team on!",
            "🎙️ Standing ovation as {player} comes off — what a performance!",
        ],
        weather: [
            "🎙️ The rain is making the surface heavy — players are having to adapt.",
            "🎙️ Strong wind swirling around the ground — set-pieces become a lottery.",
            "🎙️ Perfect pitch tonight, ideal conditions for some attractive football.",
        ],
        injury: [
            "🎙️ {player} is down in pain, the medical staff sprint onto the pitch!",
            "🎙️ A nasty collision there — hopefully nothing serious for {player}.",
            "🎙️ {player} is back on his feet — a positive sign!",
        ],
    }
};

window.GS_CommentaryExtended = GS_CommentaryExtended;
