<?php
/**
 * ============================================================
 * player.php — Gestione dati del giocatore
 * ============================================================
 * Espone le API per leggere e modificare il profilo del giocatore:
 *
 *  - get_player: restituisce tutti i dati del giocatore (stats,
 *                squadra, lega, strutture, abilità, storico)
 *  - get_news: recupera le ultime notizie della carriera
 *  - get_classifica: classifica del campionato corrente
 *  - get_champions_bracket: tabellone Champions Cup
 *  - update_skin: cambia il tema visivo della player card
 *  - get_leaderboard: classifica globale tra tutti gli utenti
 *
 * I dati restituiti includono statistiche aggregate (gol, assist,
 * trofei) e informazioni sulla squadra e lega corrente.
 * ============================================================
 */
require_once '../config/db.php';

// Cattura errori fatali e restituisce JSON invece di HTML
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore server: ' . $e->getMessage() . ' (L.' . $e->getLine() . ')']);
    exit;
});
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});

$action = $_GET['action'] ?? '';

// Alcune azioni non richiedono player_id
if (in_array($action, ['leghe', 'teams'])) {
    switch ($action) {
        case 'teams': getTeams(); break;
        case 'leghe': getLeghe(); break;
    }
    exit;
}

$player_id = getAuthPlayerId();
if (!$player_id) {
    echo json_encode(['error' => t('Non autenticato','Not authenticated','Nicht authentifiziert','No autenticado')]); exit;
}
if ($player_id < 0) {
    echo json_encode(['error' => t('Seleziona una carriera','Please select a career','Bitte wähle eine Karriere','Por favor selecciona una carrera')]); exit;
}

switch ($action) {
    case 'get':       getPlayer($player_id);  break;
    case 'teams':     getTeams();             break;
    case 'leghe':     getLeghe();             break;
    case 'log':       getLog($player_id);     break;
    case 'season':    getSeason($player_id);  break;
    case 'strutture': getStrutture();         break;
    case 'calendario': getCalendario($player_id); break;
    case 'season_detail': getSeasonDetail($player_id); break;
    case 'update_appearance': updateAppearance($player_id); break;
    default: echo json_encode(['error' => t('Azione non trovata','Action not found','Aktion nicht gefunden','Acción no encontrada')]);
}

function getPlayer($id) {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT p.*, t.nome as team_nome, t.stelle as team_stelle, t.popolarita as team_pop,
               t.moltiplicatore_stipendio, t.lega_id,
               l.nome as lega_nome, l.livello as lega_livello,
               n.nome as nazione_nome, n.bandiera as nazione_bandiera
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.id
        LEFT JOIN leghe l ON t.lega_id = l.id
        LEFT JOIN nazioni n ON l.nazione_id = n.id
        WHERE p.id = ?
    ");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if ($p) { unset($p['password']); echo json_encode($p); }
    else echo json_encode(['error' => t('Giocatore non trovato','Player not found','Spieler nicht gefunden','Jugador no encontrado')]);
}

function getLeghe() {
    $db = getDB();
    $leghe = $db->query("
        SELECT l.*, n.nome as nazione_nome, n.bandiera,
               COUNT(t.id) as num_squadre
        FROM leghe l
        JOIN nazioni n ON l.nazione_id = n.id
        LEFT JOIN teams t ON t.lega_id = l.id
        GROUP BY l.id
        ORDER BY n.id, l.livello
    ")->fetchAll();
    echo json_encode($leghe);
}

function getTeams() {
    $db = getDB();
    $lega_id = intval($_GET['lega_id'] ?? 0);
    if ($lega_id > 0) {
        $stmt = $db->prepare("
            SELECT t.*, l.nome as lega_nome, l.livello as lega_livello,
                   n.nome as nazione_nome, n.bandiera
            FROM teams t
            JOIN leghe l ON t.lega_id = l.id
            JOIN nazioni n ON l.nazione_id = n.id
            WHERE t.lega_id = ?
            ORDER BY t.stelle DESC, t.popolarita DESC
        ");
        $stmt->execute([$lega_id]);
    } else {
        $stmt = $db->query("
            SELECT t.*, l.nome as lega_nome, l.livello as lega_livello,
                   n.nome as nazione_nome, n.bandiera
            FROM teams t
            JOIN leghe l ON t.lega_id = l.id
            JOIN nazioni n ON l.nazione_id = n.id
            ORDER BY n.id, l.livello, t.stelle DESC
        ");
    }
    echo json_encode($stmt->fetchAll());
}

function getLog($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM log_mensile WHERE player_id=? AND avv!='' AND avv!='__riepilogo' ORDER BY id DESC LIMIT 30");
    $stmt->execute([$id]);
    echo json_encode($stmt->fetchAll());
}

function getSeason($id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM stagioni WHERE player_id = ? ORDER BY anno DESC LIMIT 15");
    $stmt->execute([$id]);
    echo json_encode($stmt->fetchAll());
}

function getStrutture() {
    $db = getDB();
    echo json_encode($db->query("SELECT * FROM strutture ORDER BY livello")->fetchAll());
}

function updateAppearance($player_id) {
    $db   = getDB();
    $data = _getCachedBody();
    $allowed_hair = ['short_black','short_brown','short_blonde','short_red','long_black','long_brown','long_blonde','afro_black','afro_brown','bald','curly_black','curly_brown',
                     'short','medium','long','curly','afro','mohawk','bun','rpm','ai'];
    $hair  = in_array($data['skin_hair']  ?? '', $allowed_hair)  ? $data['skin_hair']  : null;
    // skin_color and eye_color can be stored as hex (#rrggbb) or legacy key names
    $skin  = !empty($data['skin_color'])  ? preg_replace('/[^a-zA-Z0-9#_]/', '', $data['skin_color'])  : null;
    $eye   = !empty($data['eye_color'])   ? preg_replace('/[^a-zA-Z0-9#_]/', '', $data['eye_color'])   : null;
    $hair_color = !empty($data['hair_color']) ? preg_replace('/[^a-zA-Z0-9#]/', '', $data['hair_color']) : null;
    $updates = [];
    $params  = [];
    if ($hair)       { $updates[] = 'skin_hair=?';   $params[] = $hair; }
    if ($skin)       { $updates[] = 'skin_color=?';  $params[] = $skin; }
    if ($eye)        { $updates[] = 'eye_color=?';   $params[] = $eye; }
    if ($hair_color) { $updates[] = 'hair_color=?';  $params[] = $hair_color; }
    if ($updates) {
        $params[] = $player_id;
        $db->prepare("UPDATE players SET ".implode(',',$updates)." WHERE id=?")->execute($params);
        echo json_encode(['success'=>true]);
    } else {
        echo json_encode(['error' => t('Nessun campo valido da aggiornare','No valid fields to update','Keine gültigen Felder zum Aktualisieren','No hay campos válidos para actualizar')]);
    }
}

function getSeasonDetail($player_id) {
    $db  = getDB();
    $anno = intval($_GET['anno'] ?? 0);
    if (!$anno) { echo json_encode(['error' => t('Anno mancante','Year parameter missing','Jahresparameter fehlt','Parámetro de año faltante')]); return; }

    // Totali stagionali — esclude righe riepilogo e righe senza avv reale
    $stmt = $db->prepare("SELECT SUM(gol) as gol, SUM(assist) as assist, COUNT(*) as partite FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo'");
    $stmt->execute([$player_id, $anno]);
    $totals = $stmt->fetch();

    // Miglior partita per gol
    $stmt = $db->prepare("SELECT * FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo' ORDER BY gol DESC, voto DESC LIMIT 1");
    $stmt->execute([$player_id, $anno]);
    $best_gol = $stmt->fetch();

    // Miglior partita per assist
    $stmt = $db->prepare("SELECT * FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo' ORDER BY assist DESC, voto DESC LIMIT 1");
    $stmt->execute([$player_id, $anno]);
    $best_assist = $stmt->fetch();

    // Miglior partita per voto
    $stmt = $db->prepare("SELECT * FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo' ORDER BY voto DESC LIMIT 1");
    $stmt->execute([$player_id, $anno]);
    $best_voto = $stmt->fetch();

    // avv è già salvato direttamente nel log — niente JOIN calendario
    if ($best_gol)    $best_gol['avversario']   = $best_gol['avv'] ?: null;
    if ($best_assist) $best_assist['avversario'] = $best_assist['avv'] ?: null;
    if ($best_voto)   $best_voto['avversario']   = $best_voto['avv'] ?: null;

    // Trofei
    $stmt = $db->prepare("SELECT s.*, t.lega_id, l.livello as lega_livello, l.nome as lega_nome FROM stagioni s LEFT JOIN players p ON p.id=s.player_id LEFT JOIN teams t ON p.team_id=t.id LEFT JOIN leghe l ON t.lega_id=l.id WHERE s.player_id=? AND s.anno=? LIMIT 1");
    $stmt->execute([$player_id, $anno]);
    $stagione = $stmt->fetch();

    // Champions vinta
    $stmt = $db->prepare("SELECT cc.fase FROM champions_cup cc JOIN players p ON p.team_id=cc.team_id WHERE p.id=? AND cc.anno=? AND cc.fase='vincitore' AND cc.eliminato=0 LIMIT 1");
    $stmt->execute([$player_id, $anno]);
    $champions_win = $stmt->fetch();

    // Campionato vinto: controlla se la squadra del giocatore è prima in classifica per quell'anno
    $campionato_vinto = null;
    $stmt = $db->prepare("
        SELECT p.team_id, t.lega_id FROM players p JOIN teams t ON p.team_id = t.id WHERE p.id = ?
    ");
    $stmt->execute([$player_id]);
    $pteam = $stmt->fetch();
    if ($pteam) {
        $stmt = $db->prepare("
            SELECT c.team_id, l.nome as lega_nome, l.livello
            FROM classifica c
            JOIN leghe l ON c.lega_id = l.id
            WHERE c.lega_id = ? AND c.anno = ?
            ORDER BY c.punti DESC, (c.gol_fatti - c.gol_subiti) DESC, c.gol_fatti DESC
            LIMIT 1
        ");
        $stmt->execute([$pteam['lega_id'], $anno]);
        $leader = $stmt->fetch();
        if ($leader && intval($leader['team_id']) === intval($pteam['team_id'])) {
            $campionato_vinto = [
                'lega_nome' => ($stagione['lega_nome'] ?? null) ?: $leader['lega_nome'],
                'livello'   => intval($leader['livello']),
            ];
        }
    }

    echo json_encode([
        'anno'             => $anno,
        'gol'              => intval($totals['gol'] ?? 0),
        'assist'           => intval($totals['assist'] ?? 0),
        'partite'          => intval($totals['partite'] ?? 0),
        'best_gol'         => $best_gol ?: null,
        'best_assist'      => $best_assist ?: null,
        'best_voto'        => $best_voto ?: null,
        'champions_win'    => $champions_win ? true : false,
        'campionato_vinto' => $campionato_vinto,
        'pallone_doro_pos' => $stagione ? intval($stagione['pallone_doro_pos']) : 0,
    ]);
}

function getCalendario($player_id) {
    $db = getDB();
    $p  = $db->prepare("SELECT p.team_id, p.anno_corrente, p.mese_corrente, t.lega_id FROM players p LEFT JOIN teams t ON p.team_id=t.id WHERE p.id=?");
    $p->execute([$player_id]);
    $player = $p->fetch();
    if (!$player) { echo json_encode([]); return; }

    $lega_id = $player['lega_id'];
    $anno    = $player['anno_corrente'];

    // Recupera tutte le partite del calendario con i nomi delle squadre
    $stmt = $db->prepare("
        SELECT c.*, 
               th.nome as home_nome, ta.nome as away_nome,
               th.ovr as home_ovr, ta.ovr as away_ovr
        FROM calendario c
        JOIN teams th ON c.home_id = th.id
        JOIN teams ta ON c.away_id = ta.id
        WHERE c.lega_id=? AND c.anno=?
        ORDER BY c.giornata
    ");
    $stmt->execute([$lega_id, $anno]);
    $partite = $stmt->fetchAll();

    echo json_encode([
        'partite'  => $partite,
        'team_id'  => $player['team_id'],
        'mese'     => $player['mese_corrente'],
        'anno'     => $anno
    ]);
}
