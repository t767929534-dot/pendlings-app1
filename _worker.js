export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // 1. Detektera om besökaren är Googlebot eller Googles testverktyg
    const isGoogleBot = userAgent.includes('Googlebot') || userAgent.includes('Google Inspection Tool');

    const franStad = url.searchParams.get('fran');
    const tillStad = url.searchParams.get('till');

    // 2. Om det är Googlebot som besöker en rutt-länk (?fran=...&till=...)
    if (isGoogleBot && franStad && tillStad) {
      try {
        // Hämta din index.html från Cloudflare Assets
        const response = await env.ASSETS.fetch(request);
        let html = await response.text();

        // Hämta rutter.csv från ditt eget arkiv på servern
        const csvRequest = new Request(`${url.origin}/rutter.csv`);
        const csvResponse = await env.ASSETS.fetch(csvRequest);
        const csvText = await csvResponse.text();

        // Läs och dela upp CSV-filen rad för rad
        let rader = csvText.split(/\r?\n/);
        let hittadRad = null;

        for (let i = 1; i < rader.length; i++) {
          let kolumner = rader[i].split(',');
          if (kolumner.length >= 5) {
            let csvFran = kolumner[0].trim().toLowerCase();
            let csvTill = kolumner[1].trim().toLowerCase();

            if (csvFran === franStad.toLowerCase().trim() && csvTill === tillStad.toLowerCase().trim()) {
              hittadRad = kolumner;
              break;
            }
          }
        }

        // 3. Om rutten hittas i din CSV-fil, bygg HTML på servern
        if (hittadRad) {
          const km = parseFloat(hittadRad[2].replace(/[^\d.]/g, ''));
          const tid = hittadRad[3].trim();
          const genereradText = hittadRad[4].replace(/"/g, '').trim();

          // Konstanter för din exakta kalkyl
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

          // Bygg upp det unika innehållet (Exakt samma struktur som din JS-kod bygger)
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

              <div class="text-block" style="border-left: 5px solid var(--success-color); background: var(--block-bg); padding: 15px; border-radius: var(--radius); margin-top: 15px;">
                <p style="margin-bottom: 10px;">📊 <strong>Gyllenstormś Ekonomiska Kalkyl (Bil)</strong></p>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Månadskostnad (ca 22 dgr):</span> <strong>${manadsKostnad.toLocaleString('sv-SE')} kr</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Årskostnad (Bränsle):</span> <strong>${arsKostnadBrutto.toLocaleString('sv-SE')} kr</strong></div>
                <hr style="margin: 10px 0; border: 0; border-top: 1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; color: #27ae60;"><span>Uppskattad skattereduktion:</span> <strong>- ${skatteLättnad.toLocaleString('sv-SE')} kr/år</strong></div>
                <div style="display:flex; justify-content:space-between; font-weight: bold; margin-top: 5px;"><span>Netto årskostnad (efter skatt):</span> <span>${nettoArsKostnad.toLocaleString('sv-SE')} kr</span></div>
                
                <small style="display:block; font-size: 0.75rem; color: var(--text-light); margin-top: 15px; line-height: 1.4;">
                  * Baseras på 25 kr/mil i avdrag, 30% marginalskatt och 11 000 kr i självrisk (Skatteverkets regler). Informationen är publicerad med stöd från YGL paragraf 1 och Tryckfrihetsförordningen. Informationen är sammanställd av Karl-Johan Gyllenstorm och är framtagen för eget behov. Copyright 2026 - Karl-Johan Gyllenstorm.
                </small>
              </div>
            </div>
          `;

          // 4. Injicera den dynamiska datan i sidans skelett
          html = html.replace('<title>Gyllenstormś pendlingskalkylator - Tid Avstånd och Driftkostnad</title>', `<title>📍 ${franStad} ➔ ${tillStad} | Pendlingstid & Kostnad | Karl-Johan Gyllenstorm</title>`);
          html = html.replace('<h1>🚗 Gyllenstormś Pendlingskalkylator</h1>', `<h1>📍 ${franStad} ➔ ${tillStad}</h1>`);
          
          // Ersätt den tomma innehålls-diven med vår färdiga kalkyl
          html = html.replace('<div id="rutt-lista" class="rutt-grid">', uniktInnehall + '<div id="rutt-lista" class="rutt-grid" style="display:none;">');

          // CRITICAL SEO FIX: Radera bort hela script-taggen så Googlebot inte kör JavaScriptet en gång till på klientsidan
          html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '');

          return new Response(html, {
            headers: { 'content-type': 'text/html;charset=UTF-8' }
          });
        }
      } catch (e) {
        // Om något mot förmodan kraschar, skicka den vanliga index.html som fallback
        return env.ASSETS.fetch(request);
      }
    }

    // 5. För alla vanliga mänskliga besökare: Servera index.html orörd (Klient-JavaScript körs)
    return env.ASSETS.fetch(request);
  }
};
