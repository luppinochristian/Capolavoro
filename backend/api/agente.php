<?php
/**
 * ============================================================
 * agente.php — Sistema agente personale
 * ============================================================
 * Gestisce l'agente del giocatore, un personaggio che offre
 * bonus e servizi speciali durante la carriera:
 *
 *  - get_agent: restituisce l'agente attuale e i suoi bonus
 *  - hire_agent: ingaggia un nuovo agente (costo in denaro)
 *  - fire_agent: licenzia l'agente corrente
 *  - get_agent_offer: genera un'offerta casuale dall'agente
 *
 * Gli agenti hanno livelli diversi e forniscono bonus su stipendio,
 * trasferimenti, morale e probabilità di vittoria.
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

$data = _getCachedBody();
$action = $data['action'] ?? $_GET['action'] ?? '';

// =====================================================
// DEFINISCI AGENTI PRIMA DELLO SWITCH (fix "risposta non valida")
// =====================================================
if (!defined('AGENTI')) {
    define('AGENTI', [
        1 => ['nome'=>'Marco Ferretti',    'costo'=>15000,  'costo_up'=>30000,  'bonus_stipendio'=>0.10,'bonus_ovr_sconto'=>2.5,  'pop_richiesta'=>0,  'descr_it'=>'Agente locale. +10% stipendio, -2.5% OVR richiesto per trasferimenti.', 'descr_en'=>'Local agent. +10% salary, -2.5% OVR required for transfers.'],
        2 => ['nome'=>'Carlos Mendez',     'costo'=>40000,  'costo_up'=>80000,  'bonus_stipendio'=>0.20,'bonus_ovr_sconto'=>5.0,  'pop_richiesta'=>25, 'descr_it'=>'Agente internazionale. +20% stipendio, -5% OVR. Sblocca a 25 popolarità.', 'descr_en'=>'International agent. +20% salary, -5% OVR. Unlocks at 25 popularity.'],
        3 => ['nome'=>'James Whitfield',   'costo'=>100000, 'costo_up'=>180000, 'bonus_stipendio'=>0.35,'bonus_ovr_sconto'=>7.5,  'pop_richiesta'=>50, 'descr_it'=>'Agente top europeo. +35% stipendio, -7.5% OVR. Sblocca a 50 popolarità.', 'descr_en'=>'Top European agent. +35% salary, -7.5% OVR. Unlocks at 50 popularity.'],
        4 => ['nome'=>'Alexandre Dupont',  'costo'=>250000, 'costo_up'=>500000, 'bonus_stipendio'=>0.50,'bonus_ovr_sconto'=>10.0, 'pop_richiesta'=>75, 'descr_it'=>'Super-agente. +50% stipendio, -10% OVR. Solo per star: 75 popolarità.', 'descr_en'=>'Super-agent. +50% salary, -10% OVR. Stars only: 75 popularity.'],
        5 => ['nome'=>'Giovanni El-Fares',  'costo'=>600000, 'costo_up'=>0,      'bonus_stipendio'=>0.75,'bonus_ovr_sconto'=>15.0, 'pop_richiesta'=>90, 'descr_it'=>'Leggenda degli agenti. +75% stipendio, -15% OVR. Riservato alle icone: 90 popolarità.', 'descr_en'=>'Agent legend. +75% salary, -15% OVR. Reserved for icons: 90 popularity.'],
    ]);
}

switch ($action) {
    case 'get':     getAgente($player_id);           break;
    case 'assumi':  assumiAgente($player_id, $data);  break;
    case 'upgrade': upgradeAgente($player_id);        break;
    default: echo json_encode(['error' => t('Azione non trovata','Action not found','Aktion nicht gefunden','Acción no encontrada')]);
}

function getAgente($player_id) {
    $db   = getDB();
    $stmt = $db->prepare("SELECT a.*, p.popolarita, p.soldi FROM agente a JOIN players p ON a.player_id=p.id WHERE a.player_id=?");
    $stmt->execute([$player_id]);
    $ag   = $stmt->fetch();

    if (!$ag) {
        $stmt2 = $db->prepare("SELECT popolarita, soldi FROM players WHERE id=?");
        $stmt2->execute([$player_id]);
        $p = $stmt2->fetch();
        echo json_encode([
            'livello'    => 0,
            'nome'       => null,
            'agenti'     => AGENTI,
            'popolarita' => (int)($p['popolarita'] ?? 0),
            'soldi'      => (float)($p['soldi'] ?? 0),
        ]);
        return;
    }
    echo json_encode(array_merge($ag, [
        'agenti' => AGENTI,
        'info'   => AGENTI[$ag['livello']] ?? null,
    ]));
}

function assumiAgente($player_id, $data) {
    $db      = getDB();
    $livello = intval($data['livello'] ?? 1);
    if (!isset(AGENTI[$livello])) { echo json_encode(['error'=>t('Agente non valido','Invalid agent')]); return; }

    $info = AGENTI[$livello];
    $stmt = $db->prepare("SELECT soldi, popolarita, anno_corrente, mese_corrente FROM players WHERE id=?");
    $stmt->execute([$player_id]);
    $player = $stmt->fetch();
    if (!$player) { echo json_encode(['error'=>t('Giocatore non trovato','Player not found','Spieler nicht gefunden','Jugador no encontrado')]); return; }

    if ($player['popolarita'] < $info['pop_richiesta']) {
        echo json_encode(["error"=>t("Popolarità insufficiente. Serve almeno {$info['pop_richiesta']} (hai {$player['popolarita']})","Not enough popularity. Need {$info['pop_richiesta']} (you have {$player['popolarita']})")]); return;
    }

    $stmt = $db->prepare("SELECT livello FROM agente WHERE player_id=?");
    $stmt->execute([$player_id]);
    $existing = $stmt->fetch();
    if ($existing && $existing['livello'] >= $livello) {
        echo json_encode(['error'=>t('Hai già un agente di livello uguale o superiore','You already have an agent of equal or higher level')]); return;
    }

    $costo = $info['costo'];
    if ($existing && $existing['livello'] > 0) {
        $costo = AGENTI[$existing['livello']]['costo_up'] ?? $info['costo'];
    }

    if ($player['soldi'] < $costo) {
        echo json_encode(['error'=>t('Soldi insufficienti. Servono €','Insufficient funds. You need €').number_format($costo)]); return;
    }

    $db->prepare("UPDATE players SET soldi=soldi-? WHERE id=?")->execute([$costo, $player_id]);

    if ($existing) {
        $db->prepare("UPDATE agente SET livello=?,nome=?,acquistato_anno=? WHERE player_id=?")
           ->execute([$livello, $info['nome'], $player['anno_corrente'], $player_id]);
    } else {
        $db->prepare("INSERT INTO agente (player_id,livello,nome,acquistato_anno) VALUES(?,?,?,?)")
           ->execute([$player_id, $livello, $info['nome'], $player['anno_corrente']]);
    }

    $db->prepare("INSERT INTO notizie (player_id,anno,mese,titolo,testo,titolo_en,testo_en,titolo_de,testo_de,titolo_es,testo_es,tipo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
       ->execute([$player_id, $player['anno_corrente'], $player['mese_corrente'],
           "🤝 Nuovo agente: {$info['nome']}",
           "Hai ingaggiato {$info['nome']} come agente. +".intval($info['bonus_stipendio']*100)."% stipendio ogni mese e -".$info['bonus_ovr_sconto']."% OVR richiesto per i trasferimenti.",
           "🤝 New agent: {$info['nome']}",
           "You signed {$info['nome']} as your agent. +".intval($info['bonus_stipendio']*100)."% monthly salary and -".$info['bonus_ovr_sconto']."% required OVR for transfers.",
           "🤝 Neuer Agent: {$info['nome']}",
           "Du hast {$info['nome']} als Agenten verpflichtet. +".intval($info['bonus_stipendio']*100)."% Gehalt monatlich und -".$info['bonus_ovr_sconto']."% benötigter OVR für Transfers.",
           "🤝 Nuevo agente: {$info['nome']}",
           "Has contratado a {$info['nome']} como agente. +".intval($info['bonus_stipendio']*100)."% salario mensual y -".$info['bonus_ovr_sconto']."% OVR requerido para fichajes.",
           'agente'
       ]);

    echo json_encode(['success'=>true, 'msg'=>"Hai ingaggiato {$info['nome']}!"]);
}

function upgradeAgente($player_id) {
    $db   = getDB();
    $stmt = $db->prepare("SELECT livello FROM agente WHERE player_id=?");
    $stmt->execute([$player_id]);
    $ag   = $stmt->fetch();
    if (!$ag) { echo json_encode(['error'=>t('Non hai ancora un agente','You do not have an agent yet')]); return; }
    $next = $ag['livello'] + 1;
    if (!isset(AGENTI[$next])) { echo json_encode(['error'=>t('Hai già il massimo livello','You already have the maximum level')]); return; }
    // Passa direttamente il livello successivo: assumiAgente farà una sola lettura DB
    assumiAgente($player_id, ['livello' => $next]);
}
