export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Detektera Googlebot eller Googles testverktyg
    const isGoogleBot = userAgent.includes('Googlebot') || userAgent.includes('Google Inspection Tool');

    const franStad = url.searchParams.get('fran');
    const tillStad = url.searchParams.get('till');

    // Om det är Googlebot som besöker en rutt-länk
    if (isGoogleBot && franStad && tillStad) {
      try {
        // 1. Hämta din index.html från Cloudflare
        const response = await env.ASSETS.fetch(request);
        let html = await response.text();

        // 2. Hämta rutter.csv direkt från ditt eget arkiv på servern
        const csvRequest = new Request(`${url.origin}/rutter.csv`);
        const csvResponse = await env.ASSETS.fetch(csvRequest);
        const csvText = await csvResponse.text();

        // 3. Läs och dela upp CSV-filen
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

        // 4. Om rutten hittas i CSV-filen, bygg HTML exakt som din JS gör
        if (hittadRad) {
          const km = parseFloat(hittadRad[2].replace(/[^\d.]/g, ''));
          const tid = hittadRad[3].trim();
          const genereradText = hittadRad[4].replace(/"/g, '').trim();

          // Kör din exakta matte på servern för ekonomin
          const kostnadEnkel = km * 1.304;
          const manadsKostnad = Math.round(kostnadEnkel * 2 * 22);

          // Skapa ditt unika rutt-innehåll (Exakt samma HTML-struktur som din JS skapar)
          const uniktInnehall = `
            <div id="innehall">
              <div class="kalkyl-grid">
                <div class="kalkyl-kort tid"><span class="etikett">⏱️ Körtid</span><span class="siffra">${tid} min</span></div>
                <div class="kalkyl-kort distans"><span class="etikett">📏 Distans</span><span class="siffra">${km} km</span></div>
                <div class="kalkyl-kort kostnad"><span class="etikett">⛽ Bränsle</span><span class="siffra">${Math.round(kostnadEnkel)} kr</span></div>
              </div>
              <div class="text-block">
                <p>📝 Avståndet mellan ${franStad} och ${tillStad} är ${km} km. Månadskostnad: ${manadsKostnad} kr.</p>
                <p>${genereradText}</p>
              </div>
            </div>
          `;

          // Injicera värdena på rätt ID-platser i din index.html innan Google ser sidan
          html = html.replace('id="sidtitel">', `id="sidtitel"> 📍 ${franStad} ➔ ${tillStad} | Karl-Johan Gyllenstorm `);
          html = html.replace('id="rubrik">', `id="rubrik">📍 ${franStad} ➔ ${tillStad}`);
          html = html.replace('<div id="innehall">', uniktInnehall);

          return new Response(html, {
            headers: { 'content-type': 'text/html;charset=UTF-8' }
          });
        }
      } catch (e) {
        return env.ASSETS.fetch(request);
      }
    }

    // Släpp igenom vanliga användare helt orörda
    return env.ASSETS.fetch(request);
  }
};
