export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Detektera om besökaren är Googlebot eller Googles testverktyg
    const isGoogleBot = userAgent.includes('Googlebot') || userAgent.includes('Google Inspection Tool');

    // Hämta parametrarna från URL-adressen (?fran=...&till=...)
    const franStad = url.searchParams.get('fran');
    const tillStad = url.searchParams.get('till');

    // Om det er Google, och de försöker besöka en specifik rutt
    if (isGoogleBot && franStad && tillStad) {
      try {
        // 1. Hämta din index.html från Cloudflare Assets
        const response = await env.ASSETS.fetch(request);
        let html = await response.text();

        // 2. HÄMTA DATA FRÅN DITT SPREADSHEET (Publik JSON-länk helt utan API-nyckel)
        const sheetResponse = await fetch(`https://google.com`);
        const textData = await sheetResponse.text();
        
        // Google skickar med extra text i början och slutet, vi rensar bort den för att få ren JSON
        const jsonString = textData.substring(textData.indexOf('{'), textData.lastIndexOf('}') + 1);
        const jsonData = JSON.parse(jsonString);
        const rader = jsonData.table.rows || [];

        let hittadRad = null;
        
        // 3. SÖK IGENOM BLADET EFTER RÄTT RAD
        for (let i = 0; i < rader.length; i++) {
          const celler = rader[i].c || [];
          // Kontrollera att kolumn A och B har värden
          const startIArk = celler[0] && celler[0].v ? celler[0].v.toString().toLowerCase().trim() : '';
          const malIArk = celler[1] && celler[1].v ? celler[1].v.toString().toLowerCase().trim() : '';
          
          if (startIArk === franStad.toLowerCase().trim() && malIArk === tillStad.toLowerCase().trim()) {
            hittadRad = celler;
            break;
          }
        }

        // 4. OM RADEN HITTAS: BYGG HTML TILL GOOGLE
        if (hittadRad) {
          // Vi plockar ut värdena (.v) från rätt kolumn (A=0, B=1, C=2, D=3, E=4)
          const start = hittadRad[0] ? hittadRad[0].v : '';
          const mal = hittadRad[1] ? hittadRad[1].v : '';
          const distans = hittadRad[2] ? hittadRad[2].v : '';
          const tid = hittadRad[3] ? hittadRad[3].v : '';
          const kalkylText = hittadRad[4] ? hittadRad[4].v : ''; // Din färdiga text/ekonomiska kalkyl

          // Skapa unika sökmorstaggar för din SEO
          const unikTitel = `<title>📍 ${start} till ${mal} - Tid, Avstånd och Pendlingskalkyl</title>`;
          const unikBeskrivning = `<meta name="description" content="Avståndet mellan ${start} och ${mal} är ${distans} km. Beräknad körtid är ${tid} min. Läs fullständig pendlingskalkyl här.">`;
          
          // Strukturera upp texten snyggt så Google kan indexera den utan problem
          const uniktInnehall = `
            <main class="container">
              <header>
                <a href="/" style="text-decoration:none;font-size:0.9rem;color:var(--text-light);">⬅️ Tillbaka till start</a>
                <h1 style="margin-top:15px;">📍 ${start} ➔ ${mal}</h1>
                <p class="subtitle">Beräknad pendlingsdata av Karl-Johan Gyllenstorm</p>
              </header>
              <div class="historik-box" style="margin-top:20px; white-space: pre-wrap;">
                <p>📏 <strong>Distans:</strong> ${distans} km</p>
                <p>⏱️ <strong>Beräknad körtid:</strong> ${tid} min</p>
                <hr style="margin:15px 0; border:0; border-top:1px solid var(--border-color);">
                <!-- Här spottas hela din genererade text ut från kolumn E -->
                <div>${kalkylText}</div>
              </div>
            </main>
          `;

          // Byt ut grundtiteln och dölj startsidans sökfält så Google fokuserar helt på rutt-texten
          html = html.replace(/<title>.*?<\/title>/, unikTitel + unikBeskrivning);
          html = html.replace('<div class="container">', uniktInnehall + '<div class="container" style="display:none;">');

          return new Response(html, {
            headers: { 'content-type': 'text/html;charset=UTF-8' }
          });
        }
      } catch (error) {
        // Om något strular med tolkningen, släpp igenom originalfilen
        return env.ASSETS.fetch(request);
      }
    }

    // För vanliga användare samt din vanliga startsida: Kör på som vanligt
    return env.ASSETS.fetch(request);
  }
};
