<?php
/**
 * ============================================================
 * auth.php — Autenticazione e gestione account
 * ============================================================
 * Gestisce tutte le operazioni relative agli account utente:
 *  - Registrazione con verifica email via codice OTP a 6 cifre
 *  - Login / logout con token di sessione
 *  - Reset password tramite link email
 *  - Gestione carriere (crea, elimina, rinomina)
 *  - Invio email transazionali (verifica, reset, aggiornamenti)
 *
 * Ogni endpoint è identificato dal campo "action" nel body JSON.
 * Il token di autenticazione viaggia nell'header X-Auth-Token.
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
// ── Credenziali SMTP centralizzate (sovrascrivibili da env) ──────────
if (!defined('GMAIL_FROM'))  define('GMAIL_FROM',  getenv('GMAIL_FROM')  ?: 'goldenstrikerreset@gmail.com');
if (!defined('GMAIL_PASS'))  define('GMAIL_PASS',  getenv('GMAIL_PASS')  ?: 'rqma hcgx amhg obcy');
if (!defined('GMAIL_NAME'))  define('GMAIL_NAME',  getenv('GMAIL_NAME')  ?: 'Golden Striker');

$data = _getCachedBody();
$action=$data['action']??$_GET['action']??$_POST['action']??'';
switch($action){
    case 'register':      doRegister($data);     break;
    case 'verify_code':   doVerifyCode($data);   break;
    case 'resend_code':   doResendCode($data);   break;
    case 'login':         doLogin($data);        break;
    case 'logout':        doLogout();            break;
    case 'check':         doCheck();             break;
    case 'request_reset': requestReset($data);   break;
    case 'do_reset':      doReset($data);        break;
    case 'careers':       getCareers();          break;
    case 'create_career': createCareer($data);   break;
    case 'delete_career': deleteCareer($data);   break;
    case 'rename_career': renameCareer($data);   break;
    case 'send_update_request': sendUpdateRequest($data); break;
    default: echo json_encode(['error' => t('Errore: azione non trovata','Error: action not found','Fehler: Aktion nicht gefunden','Error: acción no encontrada').': '.$action]);
}

function doRegister($data){
    $db=getDB();
    $email=strtolower(trim($data['email']??''));
    $username=trim($data['username']??'');
    $password=$data['password']??'';
    if(!$email||!$password||!$username){echo json_encode(['error'=>t('Email, username e password obbligatori','Email, username and password are required')]);return;}
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)){echo json_encode(['error'=>t('Email non valida','Invalid email address')]);return;}
    if(strlen($password)<6){echo json_encode(['error'=>t('Password min 6 caratteri','Password must be at least 6 characters')]);return;}
    if(strlen($username)<3||strlen($username)>30){echo json_encode(['error'=>t('Username deve essere tra 3 e 30 caratteri','Username must be between 3 and 30 characters')]);return;}
    if(!preg_match('/^[a-zA-Z0-9_]+$/',$username)){echo json_encode(['error'=>t('Username può contenere solo lettere, numeri e underscore','Username can only contain letters, numbers and underscores')]);return;}
    // Check uniqueness before sending email
    $chkEmail=$db->prepare("SELECT id FROM accounts WHERE email=?"); $chkEmail->execute([$email]);
    if($chkEmail->fetch()){echo json_encode(['error'=>t('Email già registrata','Email already registered')]);return;}
    $chkUser=$db->prepare("SELECT id FROM accounts WHERE username=?"); $chkUser->execute([$username]);
    if($chkUser->fetch()){echo json_encode(['error'=>t('Username già in uso','Username already taken')]);return;}
    // Generate 6-digit code
    $code = str_pad(rand(0,999999),6,'0',STR_PAD_LEFT);
    $expires=date('Y-m-d H:i:s',strtotime('+15 minutes'));
    $hash=password_hash($password,PASSWORD_DEFAULT);
    // Delete any previous pending verifications for this email
    $db->prepare("DELETE FROM email_verifications WHERE email=?")->execute([$email]);
    $db->prepare("INSERT INTO email_verifications (email,username,password_hash,code,expires_at) VALUES(?,?,?,?,?)")->execute([$email,$username,$hash,$code,$expires]);
    $sent=sendVerificationEmail($email,$username,$code);
    echo json_encode(['pending_verification'=>true,'email'=>$email,'mail_sent'=>$sent]);
}

function doVerifyCode($data){
    $db=getDB();
    $email=strtolower(trim($data['email']??''));
    $code=trim($data['code']??'');
    if(!$email||!$code){echo json_encode(['error'=>t('Dati mancanti','Missing data')]);return;}
    $stmt=$db->prepare("SELECT * FROM email_verifications WHERE email=? AND used=0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
    $stmt->execute([$email]);
    $row=$stmt->fetch();
    if(!$row){echo json_encode(['error'=>t('Codice scaduto o non trovato. Riprova la registrazione.','Code expired or not found. Please try registering again.')]);return;}
    if($row['code']!==$code){echo json_encode(['error'=>t('Codice non valido','Invalid code')]);return;}
    // Mark used
    $db->prepare("UPDATE email_verifications SET used=1 WHERE id=?")->execute([$row['id']]);
    // Create account
    try{
        $db->prepare("INSERT INTO accounts (email,username,password) VALUES(?,?,?)")->execute([$email,$row['username'],$row['password_hash']]);
        $account_id=(int)$db->lastInsertId();
        $token=createAccountToken($db,$account_id);
        echo json_encode(['success'=>true,'token'=>$token,'account_id'=>$account_id,'email'=>$email,'username'=>$row['username'],'careers'=>[]]);
    }catch(PDOException $e){
        if(strpos($e->getMessage(),'UNIQUE')!==false){
            if(strpos($e->getMessage(),'email')!==false) echo json_encode(['error'=>t('Email già registrata','Email already registered')]);
            else echo json_encode(['error'=>t('Username già in uso','Username already taken')]);
        }else echo json_encode(['error'=>'Errore: '.$e->getMessage()]);
    }
}

function doResendCode($data){
    $db=getDB();
    $email=strtolower(trim($data['email']??''));
    if(!$email){echo json_encode(['error'=>t('Email mancante','Missing email')]);return;}
    $stmt=$db->prepare("SELECT * FROM email_verifications WHERE email=? AND used=0 ORDER BY id DESC LIMIT 1");
    $stmt->execute([$email]);
    $row=$stmt->fetch();
    if(!$row){echo json_encode(['error'=>t('Sessione scaduta. Riprova la registrazione.','Session expired. Please try registering again.')]);return;}
    $code=str_pad(rand(0,999999),6,'0',STR_PAD_LEFT);
    $expires=date('Y-m-d H:i:s',strtotime('+15 minutes'));
    $db->prepare("UPDATE email_verifications SET code=?,expires_at=? WHERE id=?")->execute([$code,$expires,$row['id']]);
    $sent=sendVerificationEmail($email,$row['username'],$code);
    echo json_encode(['success'=>true,'mail_sent'=>$sent]);
}

function sendVerificationEmail($to,$username,$code){
    $subject=t("Il tuo codice Golden Striker ⚽","Your Golden Striker Code ⚽","Dein Golden-Striker-Code ⚽","Tu código de Golden Striker ⚽");
    $lang=getLang();
    if($lang==='en'){
        $greeting="Welcome, <strong>{$username}</strong>!";
        $subtitle="Enter the verification code below to activate your account.";
        $label="Your verification code";
        $validity="This code is valid for 15 minutes.";
        $footer="If you didn't request this, you can safely ignore this email.";
        $closing="See you on the field!";
    } elseif($lang==='de'){
        $greeting="Willkommen, <strong>{$username}</strong>!";
        $subtitle="Gib den Bestätigungscode unten ein, um dein Konto zu aktivieren.";
        $label="Dein Bestätigungscode";
        $validity="Dieser Code ist 15 Minuten lang gültig.";
        $footer="Wenn du diese Registrierung nicht angefordert hast, kannst du diese E-Mail ignorieren.";
        $closing="Bis bald auf dem Spielfeld!";
    } elseif($lang==='es'){
        $greeting="¡Bienvenido, <strong>{$username}</strong>!";
        $subtitle="Introduce el código de verificación a continuación para activar tu cuenta.";
        $label="Tu código de verificación";
        $validity="Este código es válido durante 15 minutos.";
        $footer="Si no solicitaste este registro, puedes ignorar este correo.";
        $closing="¡Nos vemos en el campo!";
    } else {
        $greeting="Benvenuto, <strong>{$username}</strong>!";
        $subtitle="Inserisci il codice di verifica qui sotto per attivare il tuo account.";
        $label="Il tuo codice di verifica";
        $validity="Questo codice è valido per 15 minuti.";
        $footer="Se non hai richiesto questa registrazione, puoi ignorare questa email.";
        $closing="A presto in campo!";
    }
    $digits=str_split($code);
    $digitHtml='';
    foreach($digits as $d){
        $digitHtml.="<span style=\"display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:900;color:#FFD700;background:#0a0f1e;border:2px solid #FFD70055;border-radius:10px;margin:0 4px;letter-spacing:0;\">{$d}</span>";
    }
    $body=<<<HTML
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#0f1729 0%,#141e35 60%,#0f1729 100%);border-radius:20px;overflow:hidden;border:1px solid #FFD70033;max-width:560px;width:100%;">
        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#FFD700 0%,#B8860B 50%,#FFD700 100%);padding:28px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:6px;">⚽</div>
            <div style="font-size:24px;font-weight:900;color:#0a0f1e;letter-spacing:2px;text-transform:uppercase;">Golden Striker</div>
            <div style="font-size:11px;color:#0a0f1eaa;letter-spacing:3px;text-transform:uppercase;margin-top:3px;">Football Career Manager</div>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="padding:40px 44px 32px;">
            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">{$greeting}</p>
            <p style="margin:0 0 32px;font-size:15px;color:#94a3b8;line-height:1.6;">{$subtitle}</p>
            <!-- CODE BLOCK -->
            <div style="background:#060c1a;border:1px solid #FFD70033;border-radius:16px;padding:28px 20px;text-align:center;margin-bottom:28px;">
              <div style="font-size:11px;font-weight:700;color:#FFD70099;letter-spacing:3px;text-transform:uppercase;margin-bottom:18px;">{$label}</div>
              <div style="white-space:nowrap;">{$digitHtml}</div>
              <div style="margin-top:18px;font-size:12px;color:#475569;">{$validity}</div>
            </div>
            <!-- DIVIDER -->
            <div style="border-top:1px solid #ffffff0f;margin:24px 0;"></div>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;">{$footer}</p>
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background:#060c1a;padding:22px 44px;border-top:1px solid #FFD70022;">
            <p style="margin:0;font-size:13px;color:#FFD700;font-weight:700;">{$closing} 🏆</p>
            <p style="margin:6px 0 0;font-size:11px;color:#334155;">© Golden Striker — Football Career Manager</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    return sendGmailSMTPHtml($to,$subject,$body);
}

/**
 * Invia email HTML (o testo) tramite Gmail via PHPMailer → SMTP raw → mail() fallback.
 * Usato da: sendVerificationEmail(), requestReset(), sendUpdateRequest().
 * @param bool $isHtml  true = HTML, false = plain text
 */
function sendGmailSMTPHtml($to, $subject, $htmlBody, bool $isHtml = true){
    $from     = GMAIL_FROM;
    $fromPass = GMAIL_PASS;
    $fromName = GMAIL_NAME;
    $phpmailerPath=__DIR__.'/../../vendor/PHPMailer/src/PHPMailer.php';
    if(file_exists($phpmailerPath)){
        require_once $phpmailerPath;
        require_once __DIR__.'/../../vendor/PHPMailer/src/SMTP.php';
        require_once __DIR__.'/../../vendor/PHPMailer/src/Exception.php';
        try{
            $mail=new PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();$mail->Host='smtp.gmail.com';$mail->SMTPAuth=true;
            $mail->Username=$from;$mail->Password=$fromPass;
            $mail->SMTPSecure=PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port=587;$mail->CharSet='UTF-8';
            $mail->setFrom($from,$fromName);$mail->addAddress($to);
            $mail->Subject=$subject;$mail->isHTML($isHtml);$mail->Body=$htmlBody;
            $mail->AltBody=strip_tags(str_replace(['<br>','<br/>','<br />','</p>','</div>'],"\n",$htmlBody));
            $mail->send();return true;
        }catch(Exception $e){error_log('PHPMailer error: '.$e->getMessage());}
    }
    // Fallback raw SMTP with HTML
    $sent=sendRawSMTPHtml($from,$fromPass,$fromName,$to,$subject,$htmlBody,$isHtml);
    if($sent) return true;
    $ct = $isHtml ? 'text/html' : 'text/plain';
    $headers="From: {$fromName} <{$from}>\r\nReply-To: {$from}\r\nMIME-Version: 1.0\r\nContent-Type: {$ct}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
    return @mail($to,'=?UTF-8?B?'.base64_encode($subject).'?=',chunk_split(base64_encode($htmlBody)),$headers);
}

function sendRawSMTPHtml($from,$pass,$fromName,$to,$subject,$htmlBody, bool $isHtml = true){
    $errno=$errstr='';
    $socket=@stream_socket_client('tcp://smtp.gmail.com:587',$errno,$errstr,15);
    if(!$socket) return false;
    stream_set_timeout($socket,15);
    $read=function() use($socket){$out='';while(!feof($socket)){$line=fgets($socket,1024);if(!$line)break;$out.=$line;if(strlen($line)>=4&&$line[3]===' ')break;}return $out;};
    $cmd=function($c) use($socket){fputs($socket,$c."\r\n");};
    $banner=$read();if(strpos($banner,'220')===false){fclose($socket);return false;}
    $cmd('EHLO localhost');$read();$cmd('STARTTLS');$tls=$read();
    if(strpos($tls,'220')===false){fclose($socket);return false;}
    if(!stream_socket_enable_crypto($socket,true,STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT|STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT)){fclose($socket);return false;}
    $cmd('EHLO localhost');$read();$cmd('AUTH LOGIN');$read();
    $cmd(base64_encode($from));$read();$cmd(base64_encode($pass));$auth=$read();
    if(strpos($auth,'235')===false){fclose($socket);return false;}
    $cmd("MAIL FROM:<{$from}>");$read();$cmd("RCPT TO:<{$to}>");$read();$cmd('DATA');$read();
    $msg ="From: {$fromName} <{$from}>\r\n";
    $msg.="To: {$to}\r\n";
    $msg.="Subject: =?UTF-8?B?".base64_encode($subject)."?=\r\n";
    $msg.="MIME-Version: 1.0\r\n";
    if ($isHtml) {
        $boundary='GS_'.md5(uniqid());
        $msg.="Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n";
        $plain=strip_tags(str_replace(['<br>','</p>','</div>'],"\n",$htmlBody));
        $msg.="--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($plain))."\r\n";
        $msg.="--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($htmlBody))."\r\n";
        $msg.="--{$boundary}--\r\n.";
    } else {
        $msg.="Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
        $msg.=chunk_split(base64_encode($htmlBody))."\r\n.";
    }
    $cmd($msg);$resp=$read();$cmd('QUIT');fclose($socket);
    return strpos($resp,'250')!==false;
}

function doLogin($data){
    $db=getDB();
    $email=strtolower(trim($data['email']??''));
    $password=$data['password']??'';
    if(!$email||!$password){echo json_encode(['error'=>t('Inserisci email e password','Please enter your email and password')]);return;}
    $stmt=$db->prepare("SELECT * FROM accounts WHERE email=?");
    $stmt->execute([$email]);
    $account=$stmt->fetch();
    if(!$account||!password_verify($password,$account['password'])){echo json_encode(['error'=>t('Email o password non corretti','Email or password is incorrect')]);return;}
    $token=createAccountToken($db,$account['id']);
    $careers=getCareerList($db,$account['id']);
    echo json_encode(['success'=>true,'token'=>$token,'account_id'=>$account['id'],'email'=>$account['email'],'username'=>$account['username']??$account['email'],'careers'=>$careers]);
}

function doLogout(){
    $token=getToken();
    if($token){$db=getDB();$db->prepare("DELETE FROM account_tokens WHERE token=?")->execute([$token]);}
    echo json_encode(['success'=>true]);
}

function doCheck(){
    $token=getToken();
    if(!$token){echo json_encode(['logged'=>false]);return;}
    $db=$stmt=null;$db=getDB();
    $stmt=$db->prepare("SELECT account_id FROM account_tokens WHERE token=? AND expires_at > NOW()");
    $stmt->execute([$token]);
    $row=$stmt->fetch();
    if(!$row){echo json_encode(['logged'=>false]);return;}
    $careers=getCareerList($db,$row['account_id']);
    echo json_encode(['logged'=>true,'account_id'=>$row['account_id'],'careers'=>$careers]);
}

function requestReset($data){
    $db=getDB();
    $email=strtolower(trim($data['email']??''));
    if(!$email){echo json_encode(['error'=>t('Inserisci la tua email','Please enter your email')]);return;}
    $stmt=$db->prepare("SELECT id FROM accounts WHERE email=?");
    $stmt->execute([$email]);
    $account=$stmt->fetch();
    if(!$account){echo json_encode(['success'=>true,'msg'=>"Se l'email esiste riceverai le istruzioni."]);return;}
    $token=bin2hex(random_bytes(20));
    $expires=date('Y-m-d H:i:s',strtotime('+1 hour'));
    $db->prepare("INSERT INTO password_resets (account_id,token,expires_at) VALUES(?,?,?)")->execute([$account['id'],$token,$expires]);
    // Supporto Codespaces (X-Forwarded-Host) e Docker/proxy
    $host = $_SERVER['HTTP_X_FORWARDED_HOST']
         ?? $_SERVER['HTTP_X_FORWARDED_SERVER']
         ?? $_SERVER['HTTP_HOST']
         ?? 'localhost:8080';
    // Rimuovi porta se presente e c'è un proxy (Codespaces usa HTTPS senza porta)
    $scheme = (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']))
              ? $_SERVER['HTTP_X_FORWARDED_PROTO']
              : ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');
    $link="{$scheme}://{$host}/frontend/reset.html?token={$token}";
    $sent = sendGmailSMTPHtml(
        $email,
        "Reset Password Golden Striker ⚽",
        buildResetEmailHtml($email, $link)
    );
    echo json_encode(['success'=>true,'msg'=>'Istruzioni inviate via email!','debug_link'=>$link,'mail_sent'=>$sent]);
}

function buildResetEmailHtml($email,$link){
    return <<<HTML
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#0f1729 0%,#141e35 60%,#0f1729 100%);border-radius:20px;border:1px solid #FFD70033;max-width:560px;width:100%;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#FFD700 0%,#B8860B 50%,#FFD700 100%);padding:28px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:6px;">⚽</div>
            <div style="font-size:24px;font-weight:900;color:#0a0f1e;letter-spacing:2px;text-transform:uppercase;">Golden Striker</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 44px 32px;">
            <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;">Reset Password</p>
            <p style="margin:0 0 28px;font-size:15px;color:#94a3b8;line-height:1.6;">Hai richiesto il reset della password per l'account <strong style="color:#FFD700;">{$email}</strong>.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="{$link}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#B8860B);color:#0a0f1e;font-weight:900;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">🔑 Reimposta Password</a>
            </div>
            <p style="margin:0;font-size:13px;color:#475569;">Il link è valido per 1 ora. Se non hai richiesto nulla, ignora questa email.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#060c1a;padding:22px 44px;border-top:1px solid #FFD70022;">
            <p style="margin:0;font-size:13px;color:#FFD700;font-weight:700;">Buona fortuna in campo! 🏆</p>
            <p style="margin:6px 0 0;font-size:11px;color:#334155;">© Golden Striker — Football Career Manager</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
}

function doReset($data){
    $db=getDB();
    $token=trim($data['token']??'');
    $password=trim($data['password']??'');
    if(!$token||!$password){echo json_encode(['error'=>t('Dati mancanti','Missing data')]);return;}
    if(strlen($password)<6){echo json_encode(['error'=>t('Password min 6 caratteri','Password must be at least 6 characters')]);return;}
    $stmt=$db->prepare("SELECT * FROM password_resets WHERE token=? AND expires_at > NOW() AND used=0");
    $stmt->execute([$token]);
    $reset=$stmt->fetch();
    if(!$reset){echo json_encode(['error'=>t('Link non valido o scaduto','Invalid or expired link')]);return;}
    $db->prepare("UPDATE accounts SET password=? WHERE id=?")->execute([password_hash($password,PASSWORD_DEFAULT),$reset['account_id']]);
    $db->prepare("UPDATE password_resets SET used=1 WHERE id=?")->execute([$reset['id']]);
    echo json_encode(['success'=>true,'msg'=>'Password aggiornata! Puoi ora accedere.']);
}

function getCareers(){
    $account_id=getAuthAccountId();
    if(!$account_id){echo json_encode(['error'=>t('Non autenticato','Not authenticated','Nicht authentifiziert','No autenticado')]);return;}
    $db=getDB();
    echo json_encode(getCareerList($db,$account_id));
}

function getCareerList($db,$account_id){
    // NOTA: ai_avatar NON viene incluso qui — può essere un path breve o (fallback)
    // un base64 da 150KB+. Caricarlo per tutte le carriere ad ogni login
    // spreca banda inutilmente. Il frontend usa has_ai_avatar per mostrare
    // il thumbnail, poi loadPlayer() carica l'avatar completo solo per la carriera attiva.
    $stmt=$db->prepare("SELECT p.id,p.career_name,p.player_name,p.gender,p.age,p.overall,
        p.mese_corrente,p.anno_corrente,p.palloni_doro,p.trofei,p.gol_carriera,
        p.skin_hair,p.skin_color,p.eye_color,p.hair_color,p.ai_prompt,
        (p.ai_avatar IS NOT NULL AND p.ai_avatar != '') AS has_ai_avatar,
        t.nome as team_nome,l.nome as lega_nome
        FROM players p
        LEFT JOIN teams t ON p.team_id=t.id
        LEFT JOIN leghe l ON t.lega_id=l.id
        WHERE p.account_id=? ORDER BY p.created_at DESC");
    $stmt->execute([$account_id]);
    return $stmt->fetchAll();
}

function createCareer($data){
    $account_id=getAuthAccountId();
    if(!$account_id){echo json_encode(['error'=>t('Non autenticato','Not authenticated','Nicht authentifiziert','No autenticado')]);return;}
    $db=getDB();
    $cnt=$db->prepare("SELECT COUNT(*) as c FROM players WHERE account_id=?");
    $cnt->execute([$account_id]);
    if($cnt->fetch()['c']>=5){echo json_encode(['error'=>t('Massimo 5 carriere','Maximum 5 careers allowed')]);return;}
    $career_name=trim($data['career_name']??'Nuova Carriera');
    $player_name=trim($data['player_name']??'');
    $gender=$data['gender']??'male';
    $nationality=$data['nationality']??'Italy';
    $age=intval($data['age']??17);
    $skin_hair=$data['skin_hair']??'short_black';
    $skin_color=$data['skin_color']??'medium';
    $eye_color=$data['eye_color']??'brown';
    $hair_color=$data['hair_color']??'#1a1a1a';
    $ai_avatar=$data['ai_avatar']??null;
    $ai_prompt=$data['ai_prompt']??null;  // prompt testuale Pollinations.ai
    // Piede: livello fisso, solo il lato viene scelto dal giocatore
    $piede_forte_lato=in_array($data['piede_forte_lato']??'dx',['dx','sx'])?($data['piede_forte_lato']??'dx'):'dx';
    $piede_debole_lato=in_array($data['piede_debole_lato']??'sx',['dx','sx'])?($data['piede_debole_lato']??'sx'):'sx';
    if($piede_forte_lato===$piede_debole_lato){echo json_encode(['error'=>t('Il piede forte e debole devono essere diversi','Strong and weak foot must be different')]);return;}
    $piede_forte=3; // livello fisso di partenza
    $piede_debole=2; // livello fisso di partenza
    if(!$player_name){echo json_encode(['error'=>t('Inserisci il nome del calciatore','Please enter the player name')]);return;}
    if($age<16||$age>22){echo json_encode(['error'=>t('Età non valida','Invalid age')]);return;}

    // Ruolo scelto → bonus +5 alla stat principale
    $role = in_array($data['role']??'', ['bomber','fantasista','ala','regista','tuttocampista'])
        ? ($data['role']) : 'bomber';
    $base = 50;
    $tiro      = rand($base-5,$base+5);
    $velocita  = rand($base-5,$base+5);
    $dribbling = rand($base-5,$base+5);
    $fisico    = rand($base-5,$base+5);
    $mentalita = rand($base-5,$base+5);
    switch($role){
        case 'bomber':        $tiro      += 5; break;
        case 'fantasista':    $dribbling += 5; break;
        case 'ala':           $velocita  += 5; break;
        case 'regista':       $mentalita += 5; break;
        case 'tuttocampista': $fisico    += 5; break;
    }
    $overall = intval(($tiro+$velocita+$dribbling+$fisico+$mentalita)/5);

    $leghe=$db->query("SELECT id FROM leghe WHERE livello=2")->fetchAll();
    $lega=$leghe[array_rand($leghe)];
    $stmt=$db->prepare("SELECT id FROM teams WHERE lega_id=? ORDER BY ovr ASC LIMIT 9");
    $stmt->execute([$lega['id']]);
    $squadre=$stmt->fetchAll();
    $team_id=!empty($squadre)?$squadre[array_rand($squadre)]['id']:1;

    $db->prepare("INSERT INTO players (account_id,career_name,player_name,gender,nationality,age,overall,tiro,velocita,dribbling,fisico,mentalita,team_id,skin_hair,skin_color,eye_color,hair_color,ai_avatar,ai_prompt,piede_forte,piede_debole,livello_skill,piede_forte_lato,piede_debole_lato,mese_corrente) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([$account_id,$career_name,$player_name,$gender,$nationality,$age,$overall,$tiro,$velocita,$dribbling,$fisico,$mentalita,$team_id,$skin_hair,$skin_color,$eye_color,$hair_color,$ai_avatar,$ai_prompt,$piede_forte,$piede_debole,2,$piede_forte_lato,$piede_debole_lato,9]);
    $career_id=(int)$db->lastInsertId();
    echo json_encode(['success'=>true,'career_id'=>$career_id,'careers'=>getCareerList($db,$account_id)]);
}

function deleteCareer($data){
    $account_id=getAuthAccountId();
    if(!$account_id){echo json_encode(['error'=>t('Non autenticato','Not authenticated','Nicht authentifiziert','No autenticado')]);return;}
    $db=getDB();
    $cid=intval($data['career_id']??0);
    $stmt=$db->prepare("SELECT id FROM players WHERE id=? AND account_id=?");
    $stmt->execute([$cid,$account_id]);
    if(!$stmt->fetch()){echo json_encode(['error'=>t('Carriera non trovata','Career not found')]);return;}
    foreach(['log_mensile','stagioni','agente','notizie','obiettivi','skill_boosts'] as $tbl){
        try{$db->prepare("DELETE FROM {$tbl} WHERE player_id=?")->execute([$cid]);}catch(Exception $e){}
    }
    // champions_cup è collegata al team_id del giocatore, non al player_id
    try {
        $team_stmt = $db->prepare("SELECT team_id, anno_corrente FROM players WHERE id=?");
        $team_stmt->execute([$cid]);
        $career_row = $team_stmt->fetch();
        if ($career_row) {
            $db->prepare("DELETE FROM champions_cup WHERE team_id=? AND anno=?")
               ->execute([$career_row['team_id'], $career_row['anno_corrente']]);
        }
    } catch(Exception $e) {}
    // Cancella il file avatar su disco se presente (path breve /frontend/avatars/...)
    $av_stmt = $db->prepare("SELECT ai_avatar FROM players WHERE id=?");
    $av_stmt->execute([$cid]);
    $av_row = $av_stmt->fetch();
    if ($av_row && $av_row['ai_avatar'] && str_starts_with($av_row['ai_avatar'], '/frontend/avatars/')) {
        $avatarFile = dirname(__DIR__, 2) . $av_row['ai_avatar'];
        if (file_exists($avatarFile)) @unlink($avatarFile);
    }
    $db->prepare("DELETE FROM players WHERE id=?")->execute([$cid]);
    echo json_encode(['success'=>true,'careers'=>getCareerList($db,$account_id)]);
}

function renameCareer($data){
    $account_id=getAuthAccountId();
    if(!$account_id){echo json_encode(['error'=>t('Non autenticato','Not authenticated','Nicht authentifiziert','No autenticado')]);return;}
    $db=getDB();
    $cid=intval($data['career_id']??0);
    $name=trim($data['name']??'');
    if(!$name){echo json_encode(['error'=>t('Nome non valido','Invalid name')]);return;}
    $db->prepare("UPDATE players SET career_name=? WHERE id=? AND account_id=?")->execute([$name,$cid,$account_id]);
    echo json_encode(['success'=>true,'careers'=>getCareerList($db,$account_id)]);
}

function sendUpdateRequest($data){
    $account_id=getAuthAccountId();
    if(!$account_id){echo json_encode(['error'=>t('Non autenticato','Not authenticated','Nicht authentifiziert','No autenticado')]);return;}
    $db=getDB();
    $msg=trim($data['message']??'');
    if(strlen($msg)<10){echo json_encode(['error'=>t('Messaggio troppo corto','Message too short')]);return;}
    // Recupera email account
    $stmt=$db->prepare("SELECT email FROM accounts WHERE id=?");
    $stmt->execute([$account_id]);
    $account=$stmt->fetch();
    $user_email=$account?$account['email']:'sconosciuto';
    $subject="[Golden Striker] Richiesta Update da {$user_email}";
    $body="Richiesta di update ricevuta da: {$user_email}\n\n---\n{$msg}\n---\n\nInviata automaticamente da Golden Striker.";
    $sent=sendGmailSMTPHtml(GMAIL_FROM,$subject,$body,false);
    echo json_encode(['success'=>true,'sent'=>$sent]);
}

function createAccountToken($db,$account_id){
    $db->prepare("DELETE FROM account_tokens WHERE account_id=?")->execute([$account_id]);
    $token=generateToken();
    $expires=date('Y-m-d H:i:s',strtotime('+30 days'));
    $db->prepare("INSERT INTO account_tokens (account_id,token,expires_at) VALUES(?,?,?)")->execute([$account_id,$token,$expires]);
    return $token;
}
