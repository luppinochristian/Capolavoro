<?php
/**
 * ============================================================
 * extra.php — Funzionalità extra e utility
 * ============================================================
 * Raccoglie endpoint ausiliari non strettamente legati al gioco:
 *
 *  - get_fun_fact: restituisce un fatto curioso sul calcio
 *  - get_tip: suggerimento strategico casuale per il giocatore
 *  - get_quote: citazione motivazionale di calciatori famosi
 *  - get_trivia: domanda di trivia calcistica
 *  - contact: invio messaggi di contatto/feedback via email
 *
 * Tutti i contenuti sono bilingue (italiano/inglese).
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
    case 'notizie':    getNotizie($player_id);         break;
    case 'leggi':      leggiNotizie($player_id);       break;
    case 'obiettivi':  getObiettivi($player_id);       break;
    default: echo json_encode(['error' => t('Azione non trovata','Action not found','Aktion nicht gefunden','Acción no encontrada')]);
}

function getNotizie($player_id) {
    $db   = getDB();
    $lang = getLang();

    // Column mapping for each language
    $langTitoloCol = 'titolo';
    $langTestoCol  = 'testo';
    $langCondition = '';  // pure SQL condition, no AND prefix

    if ($lang === 'en') {
        $langCondition = "titolo_en IS NOT NULL AND titolo_en != ''";
        $langTitoloCol = 'titolo_en';
        $langTestoCol  = 'testo_en';
    } elseif ($lang === 'de') {
        $langCondition = "titolo_de IS NOT NULL AND titolo_de != ''";
        $langTitoloCol = 'titolo_de';
        $langTestoCol  = 'testo_de';
    } elseif ($lang === 'es') {
        $langCondition = "titolo_es IS NOT NULL AND titolo_es != ''";
        $langTitoloCol = 'titolo_es';
        $langTestoCol  = 'testo_es';
    }

    // For non-IT: include news that have the target-lang OR at least an EN version (older news fallback)
    if ($lang !== 'it' && $langCondition) {
        if ($lang === 'en') {
            $whereExtra = "AND ($langCondition)";
        } else {
            $enFallback = "titolo_en IS NOT NULL AND titolo_en != ''";
            $whereExtra = "AND (($langCondition) OR ($enFallback))";
        }
        $stmt = $db->prepare("SELECT * FROM notizie WHERE player_id=? $whereExtra ORDER BY id DESC LIMIT 50");
    } else {
        $whereExtra = '';
        $stmt = $db->prepare("SELECT * FROM notizie WHERE player_id=? ORDER BY id DESC LIMIT 50");
    }
    $stmt->execute([$player_id]);
    $rows = $stmt->fetchAll();

    // Serve the correct language column with fallback chain: target → EN → IT
    $notizie = array_map(function($n) use ($lang, $langTitoloCol, $langTestoCol) {
        if ($lang !== 'it') {
            $titolo = !empty($n[$langTitoloCol]) ? $n[$langTitoloCol]
                    : (!empty($n['titolo_en'])    ? $n['titolo_en'] : $n['titolo']);
            $testo  = !empty($n[$langTestoCol])  ? $n[$langTestoCol]
                    : (!empty($n['testo_en'])     ? $n['testo_en']  : $n['testo']);
            $n['titolo'] = $titolo;
            $n['testo']  = $testo;
        }
        unset($n['titolo_en'], $n['testo_en'], $n['titolo_de'], $n['testo_de'], $n['titolo_es'], $n['testo_es']);
        return $n;
    }, $rows);

    // Unread count with same filter
    $unreadSql = "SELECT COUNT(*) as c FROM notizie WHERE player_id=? AND letto=0" . ($whereExtra ? " $whereExtra" : "");
    $unread = $db->prepare($unreadSql);
    $unread->execute([$player_id]);
    echo json_encode(['notizie' => $notizie, 'unread' => $unread->fetch()['c']]);
}

function leggiNotizie($player_id) {
    $db = getDB();
    $db->prepare("UPDATE notizie SET letto=1 WHERE player_id=?")->execute([$player_id]);
    echo json_encode(['success'=>true]);
}

function getObiettivi($player_id) {
    $db   = getDB();
    $stmt = $db->prepare("SELECT soldi,anno_corrente FROM players WHERE id=?");
    $stmt->execute([$player_id]);
    $p    = $stmt->fetch();
    if (!$p) { echo json_encode([]); return; }

    // Crea obiettivi se non esistono per questo anno
    $anno = $p['anno_corrente'];
    $stmt = $db->prepare("SELECT COUNT(*) as c FROM obiettivi WHERE player_id=? AND anno=?");
    $stmt->execute([$player_id, $anno]);
    if ($stmt->fetch()['c'] == 0) creaObiettivi($db, $player_id, $anno);

    // Aggiorna progressi
    aggiornaProgressi($db, $player_id, $anno);

    $stmt = $db->prepare("SELECT * FROM obiettivi WHERE player_id=? AND anno=? ORDER BY completato ASC, id ASC");
    $stmt->execute([$player_id, $anno]);
    echo json_encode($stmt->fetchAll());
}

function creaObiettivi($db, $player_id, $anno) {
    // Prendi stats giocatore per tarare difficoltà
    $stmt = $db->prepare("SELECT overall, gol_carriera FROM players WHERE id=?");
    $stmt->execute([$player_id]);
    $p = $stmt->fetch();
    if (!$p) return;
    $ov = intval($p['overall']);

    $obiettivi = [
        // Gol stagionali (scala con overall)
        ['gol_stagione', 'Segna '.max(5, intval($ov/5)).' gol in stagione', max(5, intval($ov/5)), 0, max(5000, $ov*500), 10],
        // Assist stagionali
        ['assist_stagione', 'Fornisci '.max(3, intval($ov/7)).' assist in stagione', max(3, intval($ov/7)), 0, max(3000, $ov*300), 8],
        // Voto medio
        ['media_voto', 'Mantieni una media voto ≥ 7.0', 70, 0, 20000, 15],
        // Overall
        ['overall', 'Raggiungi Overall '.min(99, $ov+8), min(99, $ov+8), 0, max(10000, ($ov+8)*200), 5],
        // Popolarità
        ['popolarita', 'Raggiungi 50 di popolarità', 50, 0, 8000, 10],
    ];

    $stmt = $db->prepare("INSERT INTO obiettivi (player_id,anno,tipo,descrizione,target,progresso,completato,premio_soldi,premio_morale) VALUES(?,?,?,?,?,0,0,?,?)");
    foreach ($obiettivi as $ob) {
        $stmt->execute([$player_id, $anno, $ob[0], $ob[1], $ob[2], $ob[4], $ob[5]]);
    }
}

function aggiornaProgressi($db, $player_id, $anno) {
    $stmt = $db->prepare("SELECT * FROM players WHERE id=?");
    $stmt->execute([$player_id]);
    $p = $stmt->fetch();
    if (!$p) return;

    $stmt = $db->prepare("SELECT SUM(gol) as gol, SUM(assist) as assist, AVG(voto)*10 as voto FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo'");
    $stmt->execute([$player_id, $anno]);
    $stats = $stmt->fetch();

    $progressi = [
        'gol_stagione'   => intval($stats['gol']    ?? 0),
        'assist_stagione'=> intval($stats['assist']  ?? 0),
        'media_voto'     => intval($stats['voto']    ?? 60),
        'overall'        => intval($p['overall']),
        'popolarita'     => intval($p['popolarita']),
    ];

    $stmt = $db->prepare("SELECT * FROM obiettivi WHERE player_id=? AND anno=? AND completato=0");
    $stmt->execute([$player_id, $anno]);
    $obiettivi = $stmt->fetchAll();

    foreach ($obiettivi as $ob) {
        $prog = $progressi[$ob['tipo']] ?? 0;
        $db->prepare("UPDATE obiettivi SET progresso=? WHERE id=?")->execute([$prog, $ob['id']]);

        if ($prog >= $ob['target']) {
            $db->prepare("UPDATE obiettivi SET completato=1,progresso=? WHERE id=?")->execute([$ob['target'], $ob['id']]);
            // Premio
            $db->prepare("UPDATE players SET soldi=soldi+?, morale=MIN(100,morale+?) WHERE id=?")
               ->execute([$ob['premio_soldi'], $ob['premio_morale'], $player_id]);
            // Notizia multilingue
            $premio_str_it = "€".number_format($ob['premio_soldi'])." e +{$ob['premio_morale']} morale!";
            $premio_str_en = "€".number_format($ob['premio_soldi'])." and +{$ob['premio_morale']} morale!";
            $premio_str_de = "€".number_format($ob['premio_soldi'])." und +{$ob['premio_morale']} Moral!";
            $premio_str_es = "€".number_format($ob['premio_soldi'])." y +{$ob['premio_morale']} moral!";
            $db->prepare("INSERT INTO notizie (player_id,anno,mese,titolo,testo,titolo_en,testo_en,titolo_de,testo_de,titolo_es,testo_es,tipo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
               ->execute([$player_id, $anno, $p['mese_corrente'],
                   "🎯 Obiettivo completato!",
                   "Hai completato l'obiettivo: \"{$ob['descrizione']}\". Premio: +{$premio_str_it}",
                   "🎯 Objective completed!",
                   "You completed the objective: \"{$ob['descrizione']}\". Reward: +{$premio_str_en}",
                   "🎯 Ziel erreicht!",
                   "Du hast das Ziel erreicht: \"{$ob['descrizione']}\". Belohnung: +{$premio_str_de}",
                   "🎯 ¡Objetivo completado!",
                   "Has completado el objetivo: \"{$ob['descrizione']}\". Premio: +{$premio_str_es}",
                   'obiettivo'
               ]);
        }
    }
}
