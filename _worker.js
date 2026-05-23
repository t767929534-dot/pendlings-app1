export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Detektera om besökaren är Googlebot eller Googles testverktyg
    const isGoogleBot = userAgent.includes('Googlebot') || userAgent.includes('Google Inspection Tool');

    // Hämta parametrarna från URL-adressen (?fran=...&till=...)
    const franStad = url.searchParams.get('fran');
    const tillStad = url.searchParams.get('till');

    // Om det är Google, och de försöker besöka en specifik rutt (både 'fran' och 'till' finns i URL:en)
    if (isGoogleBot && franStad && tillStad) {
      try {
        // 1. Hämta din index.html från Cloudflare Assets
        const response = await env.ASSETS.fetch(request);
        let html = await response.text();

        // 2. HÄMTA DATA FRÅN DITT SPREADSHEET (Glöm inte att lägga in din API_NYCKEL längst bak!)
        const sheetResponse = await fetch(`https://google.com`);
        const sheetData = await sheetResponse.json();
        const rader = sheetData.values || [];

        let hittadRad = null;
        
        // 3. SÖK IGENOM BLADET EFTER RÄTT RAD
        for (let i = 1; i < rader.length; i++) {
          const startIArk = rader[i][0] ? rader[i][0].toLowerCase().trim() : ''; // Kolumn A
          const malIArk = rader[i][1] ? rader[i][1].toLowerCase().trim() : '';   // Kolumn B
          
          if (startIArk === franStad.toLowerCase().trim() && malIArk === tillStad.toLowerCase().trim()) {
            hittadRad = rader[i];
            break;
          }
        }

        // 4. OM RADEN HITTAS: BYGG HTML TILL GOOGLE
        if (hittadRad) {
          const start = hittadRad[0];    // Kolumn A (t.ex. Göteborg)
          const mal = hittadRad[1];      // Kolumn B (t.ex. Borås)
          const distans = hittadRad[2];  // Kolumn C (t.ex. 65 km)
          const tid = hittadRad[3];      // Kolumn D (t.ex. 48 min)
          const kalkylText = hittadRad[4] || ''; // Kolumn E (Din färdiga text/ekonomiska kalkyl)

          // Skapa unika sökmorstaggar för din SEO
          const unikTitel = `<title>📍 ${start} till ${mal} - Tid, Avstånd och Pendlingskalkyl</title>`;
          const unikBeskrivning = `<meta name="description" content="Avståndet mellan ${start} och ${mal} är ${distans}. Beräknad körtid är ${tid}. Läs fullständig pendlingskalkyl här.">`;
          
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
                <!-- Här spottas hela din genererade text och din ekonomiska kalkyl ut från kolumn E -->
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
        // Om något strular med API:et, skicka originalfilen som säkerhetsåtgärd
        return env.ASSETS.fetch(request);
      }
    }

    // För vanliga användare samt din vanliga startsida: Kör på som vanligt (JavaScript bygger sidan)
    return env.ASSETS.fetch(request);
  }
};
