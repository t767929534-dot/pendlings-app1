export const onRequest = async (context) => {
  const request = context.request;
  const env = context.env;
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // 1. Detektera om besökaren är Googlebot eller Googles testverktyg
  const isGoogleBot = userAgent.includes('Googlebot') || userAgent.includes('Google Inspection Tool');

  const franStad = url.searchParams.get('fran');
  const tillStad = url.searchParams.get('till');

  // 2. Om det är Googlebot som besöker en rutt-länk (?fran=...&till=...)
  if (isGoogleBot && franStad && tillStad) {
    try {
      // Hämta din index.html från Cloudflare-bygget
      const response = await context.next();
      let html = await response.text();

      // --- NYTT: Lista över alla dina CSV-filer ---
      const csvFiler = ['rutter.csv', 'rutter1.csv', 'rutter2.csv', 'rutter3.csv', 'rutter4.csv', 'rutter5.csv', 'skane.csv', 'kronoberg.csv', 'blekinge.csv', 'halland.csv', 'kalmar.csv', 'vastragotaland.csv', 'norrland.csv', 'sodermanland.csv', 'stockholm.csv', 'dalarna.csv', 'vasterbotten.csv', 'jamtland.csv'];
      let hittadRad = null;

      // Loopa igenom varje CSV-fil tills en matchning hittas
      for (const filNamn of csvFiler) {
        try {
          // Hämta aktuell CSV-fil från ditt eget bygge på servern
          const csvRequest = new Request(`${url.origin}/${filNamn}`);
          const csvResponse = await env.ASSETS.fetch(csvRequest);
          
          if (!csvResponse.ok) continue; // Om filen saknas eller inte kan hämtas, hoppa till nästa

          const csvText = await csvResponse.text();

          // Läs och dela upp CSV-filen rad för rad
          let rader = csvText.split(/\r?\n/);

          for (let i = 1; i < rader.length; i++) {
            let kolumner = rader[i].split(',');
            if (kolumner.length >= 5) {
              let csvFran = kolumner[0].trim().toLowerCase();
              let csvTill = kolumner[1].trim().toLowerCase();

              if (csvFran === franStad.toLowerCase().trim() && csvTill === tillStad.toLowerCase().trim()) {
                hittadRad = kolumner;
                break; // Avbryt rad-loopen
              }
            }
          }

          // Om vi hittade rutten i denna fil, avbryt även fil-loopen
          if (hittadRad) {
            break;
          }
        } catch (filFel) {
          // Om en enskild fil misslyckas, logga eller fortsätt bara till nästa
          console.error(`Fel vid läsning av ${filNamn}:`, filFel);
          continue;
        }
      }
      // --- SLUT PÅ NY SEKTION ---

      // 3. Om rutten hittas i någon av dina CSV-filer, bygg HTML på servern
      if (hittadRad) {
        const km = parseFloat(hittadRad[2].replace(/[^\d.]/g, ''));
        const tid = hittadRad[3].trim();
        const genereradText = hittadRad[4].replace(/"/g, '').trim();

        // Konstanter för din kalkyl
        const KR_PER_KM = 1.304; 
        const ARBETSDAGAR_PER_AR = 225;
        const AVDRAG_PER_KM = 2.5; 
        const SJÄLVRISK = 11000; 
        const SKATT_EFFEKT = 0.30; 

        // Kostnadsberäkningar
        const dagligDistansKm = km * 2;
        const kostnadEnkel = km * KR_PER_KM;
        const manadsKostnad = Math.round(kostnadEnkel * 2 * 22);
        const arsKostnadBrutto = Math.round(kostnadEnkel * 2 * ARBETSDAGAR_PER_AR);
        
        // Skatteavdrag
        const totaltAvdragsUnderlag = Math.round(dagligDistansKm * ARBETSDAGAR_PER_AR * AVDRAG_PER_KM);
        let skatteLättnad = 0;
        if (totaltAvdragsUnderlag > SJÄLVRISK) {
            skatteLättnad = Math.round((totaltAvdragsUnderlag - SJÄLVRISK) * SKATT_EFFEKT);
        }
        const nettoArsKostnad = arsKostnadBrutto - skatteLättnad;

        // Bygg upp det unika innehållet
        const uniktInnehall = `
          <div id="innehall">
            <div class="kalkyl-grid">
              <div class="kalkyl-kort tid">
                <span class="etikett">⏱️ Körtid</span>
                <span class="siffra">${tid} min</span>
              </div>
              <div class="kalkyl-kort distans">
                <span class="etikett">📏 Distans</span>
                <span class="siffra">${km} km</span>
              </div>
              <div class="kalkyl-kort kostnad">
                <span class="etikett">⛽ Bränsle</span>
                <span class="siffra">${Math.round(kostnadEnkel)} kr</span>
              </div>
            </div>

            <div class="text-block">
              <p>📝 ${genereradText}</p>
            </div>

            <div class="text-block" style="border-left: 5px solid var(--success-color);">
              <p style="margin-bottom: 10px;">📊 <strong>Gyllenstormś Ekonomiska Kalkyl (Bil)</strong></p>
              <div class="rad-ekonomi" style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Månadskostnad (ca 22 dgr):</span> <strong>${manadsKostnad.toLocaleString('sv-SE')} kr</strong></div>
              <div class="rad-ekonomi" style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Årskostnad (Bränsle):</span> <strong>${arsKostnadBrutto.toLocaleString('sv-SE')} kr</strong></div>
              <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
              <div class="rad-ekonomi" style="display:flex; justify-content:space-between; margin-bottom:5px; color: #27ae60;"><span>Uppskattad skattereduktion:</span> <strong>- ${skatteLättnad.toLocaleString('sv-SE')} kr/år</strong></div>
              <div class="rad-ekonomi" style="display:flex; justify-content:space-between; font-weight: bold; margin-top: 5px;"><span>Netto årskostnad (efter skatt):</span> <span>${nettoArsKostnad.toLocaleString('sv-SE')} kr</span></div>
              
              <small class="beräknings-notis" style="display:block; font-size: 0.75rem; color: var(--text-light); margin-top: 15px; line-height: 1.4;">
                * Baseras på 25 kr/mil i avdrag, 30% marginalskatt och 11 000 kr i självrisk (Skatteverkets regler). Informationen är publicerad med stöd från YGL paragraf 1 och Tryckfrihetsförordningen. Informationen är sammanställd av Karl-Johan Gyllenstorm och är framtagen för eget behov. Copyright 2026 - Karl-Johan Gyllenstorm.
              </small>
            </div>
          </div>
        `;

        // 4. Injicera den dynamiska datan i sidans skelett på rätt ID-platser
        html = html.replace('<title>Gyllenstormś pendlingskalkylator - Tid Avstånd och Driftkostnad</title>', `<title>📍 ${franStad} ➔ ${tillStad} | Pendlingstid & Kostnad | Karl-Johan Gyllenstorm</title>`);
        html = html.replace('<h1>🚗 Gyllenstormś Pendlingskalkylator</h1>', `<h1>📍 ${franStad} ➔ ${tillStad}</h1>`);
        
        // Ersätt hela innehålls-blocket med vårt färdigbyggda
        html = html.replace('<div id="innehall">', uniktInnehall);

        // CRITICAL SEO FIX: Radera bort hela klientskriptet så Googlebot tvingas läsa den server-renderade texten
        html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '');

        return new Response(html, {
          headers: { 'content-type': 'text/html;charset=UTF-8' }
        });
      }
    } catch (e) {
      // Om något strular med CSV-läsningen, skicka bara vidare originalet som fallback
      return context.next();
    }
  }

  // 5. För alla vanliga mänskliga besökare (och din vanliga startsida): Kör på som vanligt via klientsidan
  return context.next();
};
