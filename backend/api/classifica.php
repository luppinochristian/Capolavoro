<?php
/**
 * ============================================================
 * classifica.php — Classifiche campionato e Champions
 * ============================================================
 * Restituisce le classifiche aggiornate dei campionati:
 *
 *  - get_standings: classifica del campionato del giocatore
 *                   con punti, gol fatti/subiti, posizione
 *  - get_all_leagues: panoramica di tutte le leghe attive
 *  - get_champions_standings: classifiche dei gironi Champions
 *
 * I dati vengono calcolati in tempo reale dalla tabella
 * "lega_risultati" nel database SQLite.
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

$player_id = getAuthPlayerId();
if (!$player_id) { echo json_encode(['error' => t('Non autenticato','Not authenticated','Nicht authentifiziert','No autenticado')]); exit; }

$action = $_GET['action'] ?? '';
switch ($action) {
    case 'get':          getClassifica();                   break;
    case 'champions':    getChampions();                    break;
    case 'capocannonieri': getCapocannonieri($player_id);   break;
    default: echo json_encode(['error' => t('Azione non trovata','Action not found','Aktion nicht gefunden','Acción no encontrada')]);
}

/**
 * Classifica marcatori e migliori per voto della lega del giocatore.
 * Combina le statistiche REALI del giocatore con marcatori NPC simulati
 * in modo deterministico (seed basato su team_id+anno) così la classifica
 * resta coerente tra una chiamata e l'altra nello stesso anno.
 */
function getCapocannonieri($player_id) {
    $db = getDB();
    $lega_id = intval($_GET['lega_id'] ?? 0);
    $anno    = intval($_GET['anno'] ?? 0);
    if (!$lega_id || !$anno) {
        echo json_encode(['error' => t('Parametri mancanti','Missing parameters','Fehlende Parameter','Parámetros faltantes')]); return;
    }

    // Dati reali del giocatore
    $stmt = $db->prepare("SELECT player_name, team_id, gol_carriera FROM players WHERE id=?");
    $stmt->execute([$player_id]);
    $pl = $stmt->fetch();
    if (!$pl) {
        echo json_encode(['error' => t('Giocatore non trovato','Player not found','Spieler nicht gefunden','Jugador no encontrado')]); return;
    }

    // Gol/voto REALI del giocatore in questa stagione (dalla tabella log)
    $stmt = $db->prepare("SELECT COALESCE(SUM(gol),0) gol, COALESCE(SUM(assist),0) assist, COALESCE(AVG(NULLIF(voto,0)),6.0) voto
                          FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo'");
    $stmt->execute([$player_id, $anno]);
    $mine = $stmt->fetch();
    $player_gol  = intval($mine['gol']);
    $player_voto = round(floatval($mine['voto']), 2);

    // Squadre della lega con il loro ovr (forza)
    $stmt = $db->prepare("SELECT id, nome, ovr FROM teams WHERE lega_id=? ORDER BY ovr DESC");
    $stmt->execute([$lega_id]);
    $teams = $stmt->fetchAll();

    // Nomi-fittizi per i bomber NPC (1 bomber per squadra, forza ∝ ovr team)
    $nomi = ['M. Silva','A. Kovač','L. Bauer','R. Costa','D. Novak','J. Romero','K. Andersson',
             'P. Moreau','T. Rossi','S. Müller','N. Petrov','E. Lindqvist','F. Dubois','G. Esposito',
             'V. Horvat','O. Nielsen','C. Fernández','H. Yilmaz','B. Kowalski','W. Janssen'];

    $rows = [];
    foreach ($teams as $i => $t) {
        // bomber NPC deterministico: seed da team_id+anno
        mt_srand($t['id'] * 100 + $anno);
        $forza = intval($t['ovr']);
        // gol stagionali stimati: scala con forza (team forte ⇒ bomber prolifico)
        $base = max(2, intval(round(($forza - 50) * 0.7)));
        $gol  = max(0, $base + mt_rand(-3, 4));
        $voto = round(6.2 + ($forza - 60) * 0.035 + mt_rand(-15, 15) / 100, 2);
        $voto = max(5.5, min(8.8, $voto));
        $rows[] = [
            'nome'    => $nomi[$i % count($nomi)],
            'team'    => $t['nome'],
            'gol'     => $gol,
            'voto'    => $voto,
            'is_player' => false,
        ];
    }
    mt_srand(); // ripristina seed casuale

    // Inserisci il giocatore reale
    $team_nome = '';
    foreach ($teams as $t) { if ($t['id'] == $pl['team_id']) { $team_nome = $t['nome']; break; } }
    $rows[] = [
        'nome'    => $pl['player_name'],
        'team'    => $team_nome,
        'gol'     => $player_gol,
        'voto'    => $player_voto,
        'is_player' => true,
    ];

    // Classifica marcatori (per gol) e migliori per voto
    $perGol = $rows;
    usort($perGol, fn($a,$b) => $b['gol'] <=> $a['gol'] ?: $b['voto'] <=> $a['voto']);
    $perVoto = $rows;
    usort($perVoto, fn($a,$b) => $b['voto'] <=> $a['voto'] ?: $b['gol'] <=> $a['gol']);

    // posizione del giocatore
    $pos_gol = 1; foreach ($perGol as $idx => $r) { if ($r['is_player']) { $pos_gol = $idx + 1; break; } }
    $pos_voto = 1; foreach ($perVoto as $idx => $r) { if ($r['is_player']) { $pos_voto = $idx + 1; break; } }

    echo json_encode([
        'top_scorers' => array_slice($perGol, 0, 10),
        'top_rated'   => array_slice($perVoto, 0, 10),
        'player_rank_scorers' => $pos_gol,
        'player_rank_rated'   => $pos_voto,
        'total' => count($rows),
    ]);
}

function getClassifica() {
    $db = getDB();
    $lega_id = intval($_GET['lega_id'] ?? 0);
    $anno    = intval($_GET['anno'] ?? 0);

    if (!$lega_id || !$anno) {
        echo json_encode(['error' => t('Parametri mancanti','Missing parameters','Fehlende Parameter','Parámetros faltantes')]); return;
    }

    // Assicura che tutte le squadre della lega abbiano un record
    initClassifica($db, $lega_id, $anno);

    $stmt = $db->prepare("
        SELECT c.*, t.nome as team_nome, t.stelle, t.ovr,
               (c.gol_fatti - c.gol_subiti) as diff_reti
        FROM classifica c
        JOIN teams t ON c.team_id = t.id
        WHERE c.lega_id = ? AND c.anno = ?
        ORDER BY c.punti DESC, diff_reti DESC, c.gol_fatti DESC, c.vittorie DESC
    ");
    $stmt->execute([$lega_id, $anno]);
    $rows = $stmt->fetchAll();

    // Aggiungi posizione
    foreach ($rows as $i => &$r) {
        $r['posizione'] = $i + 1;
    }
    echo json_encode($rows);
}

function initClassifica($db, $lega_id, $anno) {
    $stmt = $db->prepare("SELECT id FROM teams WHERE lega_id = ?");
    $stmt->execute([$lega_id]);
    $teams = $stmt->fetchAll();
    if (empty($teams)) return;

    // Unica INSERT multi-row invece di N INSERT separati
    $placeholders = implode(',', array_fill(0, count($teams), '(?,?,?)'));
    $params = [];
    foreach ($teams as $t) {
        $params[] = $t['id'];
        $params[] = $lega_id;
        $params[] = $anno;
    }
    $db->prepare("INSERT IGNORE INTO classifica (team_id, lega_id, anno) VALUES {$placeholders}")
       ->execute($params);
}

function getChampions() {
    $db = getDB();
    $anno = intval($_GET['anno'] ?? 0);
    if (!$anno) { echo json_encode(['error' => t('Anno mancante','Year parameter missing','Jahresparameter fehlt','Parámetro de año faltante')]); return; }

    $stmt = $db->prepare("
        SELECT cc.*, t.nome as team_nome, t.stelle, t.ovr,
               l.nome as lega_nome, n.nome as nazione_nome, n.bandiera
        FROM champions_cup cc
        JOIN teams t ON cc.team_id = t.id
        JOIN leghe l ON t.lega_id = l.id
        JOIN nazioni n ON l.nazione_id = n.id
        WHERE cc.anno = ?
        ORDER BY cc.gruppo, cc.punti_gruppo DESC, (cc.gol_fatti_gruppo - cc.gol_subiti_gruppo) DESC, cc.gol_fatti_gruppo DESC, cc.vittorie_gruppo DESC
    ");
    $stmt->execute([$anno]);
    $rows = $stmt->fetchAll();

    // Struttura gironi
    $gironi = [];
    $bracket = []; // squadre nelle fasi ad eliminazione

    foreach ($rows as $r) {
        if ($r['gruppo']) {
            $g = $r['gruppo'];
            if (!isset($gironi[$g])) $gironi[$g] = [];
            $gironi[$g][] = $r;
        }
        // Fasi ad eliminazione: includi solo squadre che hanno raggiunto il tabellone
        // (non le squadre eliminate nel girone = fase ancora 'gironi' con eliminato=1)
        if ($r['fase'] !== 'gironi') {
            $bracket[] = $r;
        }
    }

    // Riordina ogni girone per punti
    foreach ($gironi as &$g) {
        usort($g, fn($a,$b) => $b['punti_gruppo'] <=> $a['punti_gruppo']
            ?: ($b['gol_fatti_gruppo']-$b['gol_subiti_gruppo']) <=> ($a['gol_fatti_gruppo']-$a['gol_subiti_gruppo'])
            ?: $b['gol_fatti_gruppo'] <=> $a['gol_fatti_gruppo']
            ?: $b['vittorie_gruppo'] <=> $a['vittorie_gruppo']);
    }
    unset($g); // evita reference dangling dopo il loop

    echo json_encode([
        'gironi'  => $gironi,
        'bracket' => $bracket,
        'teams'   => $rows, // backward compat
    ]);
}
