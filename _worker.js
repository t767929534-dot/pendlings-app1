export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Kontrollera om det är Googlebot eller en annan sökmotor som hälsar på
    const isBot = userAgent.includes('Googlebot') || userAgent.includes('Google Inspection Tool');

    if (isBot) {
      // 1. Hämta din vanliga index.html
      const response = await env.ASSETS.fetch(request);
      let html = await response.text();

      // 2. Hämta rätt rutt-data från ditt Spreadsheet på servern istället
      // (Ersätt med din faktiska Google Sheets API-länk)
      const sheetRes = await fetch(`https://googleapis.com`);
      const sheetData = await sheetRes.json();
      
      // 3. Matcha URL-sökvägen (t.ex. /goteborg-boras) med rätt rad i din spreadsheet-data
      const ruttInfo = finnRuttData(sheetData, url.pathname); 

      // 4. Ersätt dolda taggar eller injicera texten direkt i HTML-koden innan Google ser den
      html = html.replace('<title>Standardtitel</title>', `<title>📍 ${ruttInfo.start} till ${ruttInfo.mal}</title>`);
      html = html.replace('<body>', `<body><h1>📍 ${ruttInfo.start} ➔ ${ruttInfo.mal}</h1><p>Månadskostnad: ${ruttInfo.kostnad} kr</p>`);

      return new Response(html, {
        headers: { 'content-type': 'text/html;charset=UTF-8' }
      });
    }

    // Om det är en vanlig mänsklig besökare, servera index.html som vanligt (Alternativ B körs)
    return env.ASSETS.fetch(request);
  }
};
