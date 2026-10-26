export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url || (!url.includes('tiktok.com') && !/^\d{15,}$/.test(url))) {
    return res.status(400).json({ error: 'Link TikTok tidak valid.' });
  }

  try {
    const apiUrl = `https://amfinder.web.id/api/find?url=${encodeURIComponent(url)}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'User-Agent': 'Mozilla/5.0 (compatible; AMFinderWeb/1.0)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Server AMFinder merespon dengan status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      let currentEvent = null;

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (currentEvent === 'result') {
            try { return res.status(200).json(JSON.parse(data)); } catch (e) {}
          }
          if (currentEvent === 'error') {
            try { 
              const err = JSON.parse(data);
              throw new Error(err.message || 'Gagal mencari preset');
            } catch (e) {
              throw new Error('Gagal mencari preset');
            }
          }
        }
      }
    }
    throw new Error('Koneksi terputus sebelum selesai');
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Waktu habis (Timeout). Server AMFinder terlalu lama merespon.' });
    }
    return res.status(500).json({ error: error.message });
  }
}
