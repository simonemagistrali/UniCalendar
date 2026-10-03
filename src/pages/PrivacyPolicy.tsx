import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="landing-page" style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <GlassPanel style={{ maxWidth: '800px', width: '100%', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
          <Button variant="secondary" onClick={() => navigate(-1)} style={{ marginRight: '1rem', padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
            <Shield size={24} style={{ color: 'var(--primary-color)' }} />
            Privacy Policy & Termini d'Uso
          </h1>
        </div>

        <div style={{ lineHeight: '1.6', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          <p><strong>Ultimo aggiornamento:</strong> Oggi</p>
          <p>
            La presente Privacy Policy descrive come UniCalendar (il "Titolare del trattamento") raccoglie, utilizza, protegge e conserva i dati personali degli utenti in conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR - UE 2016/679).
          </p>

          <h3 style={{ color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>1. Tipologia di dati raccolti</h3>
          <p>Raccogliamo esclusivamente i dati strettamente necessari al funzionamento dell'applicazione:</p>
          <ul>
            <li><strong>Dati di Account:</strong> Indirizzo email, nome e foto profilo (forniti tramite Google Sign-in) necessari per identificare e proteggere il tuo account.</li>
            <li><strong>Dati di Utilizzo (App Data):</strong> Eventi del calendario, task, lezioni e impostazioni personali creati all'interno dell'app.</li>
          </ul>

          <h3 style={{ color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>2. Base giuridica e finalità del trattamento</h3>
          <p>
            I tuoi dati vengono raccolti sulla base della fornitura del servizio (Art. 6, par. 1, lett. b GDPR) e vengono utilizzati esclusivamente per consentirti di utilizzare le funzionalità di pianificazione, calcolo delle priorità e sincronizzazione multi-dispositivo dell'app UniCalendar.
          </p>

          <h3 style={{ color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>3. Sicurezza dei dati e Crittografia</h3>
          <p>
            La tua privacy è la nostra massima priorità. I dati sono memorizzati nell'infrastruttura sicura di Google Cloud (Firebase). 
            Inoltre, per garantire un livello di sicurezza superiore, l'applicazione utilizza un avanzato sistema di <strong>Crittografia Trasparente (Obfuscation)</strong> lato client: tutti i testi sensibili (come i titoli degli eventi) vengono criptati prima di essere inviati al database, rendendoli illeggibili anche agli amministratori di sistema.
          </p>

          <h3 style={{ color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>4. Condivisione dei dati</h3>
          <p>
            I tuoi dati non verranno <strong>mai venduti, ceduti o usati per scopi pubblicitari</strong>. Vengono esclusivamente elaborati attraverso i servizi tecnici di terze parti strettamente necessari al funzionamento tecnico (Google Firebase per l'autenticazione e il database).
          </p>

          <h3 style={{ color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>5. Diritti dell'utente</h3>
          <p>Ai sensi degli artt. 15-22 del GDPR, hai il diritto in qualsiasi momento di:</p>
          <ul>
            <li>Accedere ai tuoi dati.</li>
            <li>Richiederne la correzione o la portabilità.</li>
            <li><strong>Diritto all'oblio:</strong> Richiedere l'eliminazione definitiva del tuo account e di tutti i dati associati direttamente dall'interno dell'applicazione o contattandoci.</li>
          </ul>

          <h3 style={{ color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>6. Contatti</h3>
          <p>
            Per qualsiasi domanda relativa alla gestione della privacy o per esercitare i tuoi diritti, puoi contattare l'amministratore di sistema o l'indirizzo email di supporto associato a questo progetto.
          </p>
        </div>
      </GlassPanel>
    </div>
  );
}
