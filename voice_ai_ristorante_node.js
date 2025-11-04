/*
README & single-file Node.js example
Purpose: A ready-to-run prototype server that connects Twilio Programmable Voice
with OpenAI (chat + TTS). Answer incoming calls with an AI voice for
"Ristorante Al Nuovo Baffone" and handle a simple interactive loop.

IMPORTANT SUMMARY (read before running):
- This is a prototype intended for testing. It uses Twilio <Gather> speech recognition
  for caller input and serves OpenAI-generated TTS MP3 files to Twilio with <Play>.
- You will need a Twilio phone number and an OpenAI API key. Use a Twilio number
  (or forward your real number to this Twilio number).
- Deploy to a public server (Render, Railway, Vercel with serverless function, or your VPS).
- Set TWILIO_WEBHOOK_URL on your Twilio phone number to point to /voice endpoint.

ENVIRONMENT VARIABLES REQUIRED:
- OPENAI_API_KEY  (OpenAI API key)
- PORT (optional, default 3000)
- BASE_URL (public URL where this server is reachable, e.g. https://my-app.onrender.com)

Node >= 18 recommended. Install dependencies:
  npm init -y
  npm install express body-parser openai uuid fs-extra axios

USAGE:
  node server.js

How it works (flow):
1. Incoming call to Twilio number triggers Twilio webhook to /voice
2. Server responds with TwiML: greeting (Play generated TTS) + <Gather input="speech"> to capture caller speech
3. When Twilio posts caller speech to /gather, server sends speech text + conversation history to OpenAI chat
4. Server generates a reply (text) and requests a TTS audio file from OpenAI TTS endpoint
5. Server returns TwiML that <Play>s the generated MP3 and re-attaches <Gather> for next turn

LIMITATIONS & NOTES:
- This implementation uses in-memory session store (Map). For production use, persist sessions in a DB.
- You should validate Twilio signatures on incoming webhooks for security (omitted for brevity).
- Adjust prompt and politeness rules in PROMPT_TEMPLATE below.
- OpenAI TTS endpoint call shown as a simple HTTP POST that stores returned audio. Adjust to match the SDK you use.


--- Begin server.js ---
*/

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// OpenAI official SDK (if you prefer) - this example uses direct HTTP for flexibility
// import OpenAI from 'openai';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY env variable.');
  process.exit(1);
}

// In-memory call sessions: callSid -> {history: [{role, content}], lastAudioFile}
const sessions = new Map();

// Prompt template for Ristorante Al Nuovo Baffone
const PROMPT_TEMPLATE = `
Sei NuovoBaffoneAI, l'assistente vocale del Ristorante Al Nuovo Baffone (Via Roma 27, Frosinone).
Tono: cortese, amichevole e professionale, risposte brevi.
Obiettivi: accogliere il cliente, rispondere su orari/menu/servizi e raccogliere prenotazioni.
Se il cliente vuole prenotare, chiedi nome, numero di persone, data e orario.
Non inventare informazioni; se non sei sicuro, proponi di verificare con lo staff.
`;

// Utility: save TTS audio buffer to /public/audio and return public URL
async function saveAudioBuffer(buffer) {
  await fs.ensureDir(path.join('public', 'audio'));
  const id = uuidv4();
  const filename = `${id}.mp3`;
  const filepath = path.join('public', 'audio', filename);
  await fs.writeFile(filepath, buffer);
  return `${BASE_URL}/audio/${filename}`;
}

// Minimal OpenAI Chat + TTS calls (replace with SDK calls if you prefer)
async function openaiChatReply(conversation) {
  // conversation: [{role: 'system'|'user'|'assistant', content: '...'}]
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o-mini',
    messages: conversation,
    max_tokens: 250,
    temperature: 0.2
  };
  const resp = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${OPENAI_KEY}` }
  });
  return resp.data.choices[0].message.content;
}

async function openaiTextToSpeech(text) {
  // Example using OpenAI TTS endpoint. If your account uses a different path, update accordingly.
  // We'll request an mp3 audio returned as binary.
  const url = 'https://api.openai.com/v1/audio/speech'; // adjust if different
  const payload = {
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
    input: text
  };
  // Some OpenAI TTS endpoints expect application/json and return audio in response body.
  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    responseType: 'arraybuffer'
  });
  return Buffer.from(resp.data);
}

// Serve static audio files
app.use('/audio', express.static(path.join('public', 'audio')));

// Root
app.get('/', (req, res) => {
  res.send('NuovoBaffoneAI server is running');
});

// Twilio webhook: incoming call
app.post('/voice', async (req, res) => {
  // Twilio posts call info; callSid identifies the call
  const callSid = req.body.CallSid || uuidv4();
  const from = req.body.From || 'caller';

  // Initialize session if missing
  if (!sessions.has(callSid)) {
    sessions.set(callSid, { history: [{ role: 'system', content: PROMPT_TEMPLATE }], lastAudio: null });
  }

  // Build a friendly greeting text
  const greetingText = `Buongiorno, grazie per aver chiamato il Ristorante Al Nuovo Baffone. Come posso aiutarla oggi?`;

  // Generate TTS audio and get URL
  try {
    const audioBuffer = await openaiTextToSpeech(greetingText);
    const audioUrl = await saveAudioBuffer(audioBuffer);
    sessions.get(callSid).lastAudio = audioUrl;

    // Return TwiML: Play greeting and Gather speech input
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Gather input="speech dtmf" action="/gather" method="POST" timeout="5" speechTimeout="auto">
    <Say>Le lascio la possibilità di parlarmi dopo il segnale. Parli quando è pronto.</Say>
  </Gather>
  <Say>Non ho ricevuto risposta. Arrivederci.</Say>
  <Hangup/>
</Response>`;

    res.type('text/xml').send(twiml);
  } catch (err) {
    console.error('TTS error', err?.response?.data || err.message);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Si è verificato un errore. Riprovare più tardi.</Say><Hangup/></Response>`;
    res.type('text/xml').send(fallback);
  }
});

// Twilio posts here after Gather with speech result
app.post('/gather', async (req, res) => {
  const callSid = req.body.CallSid || 'unknown';
  const speechResult = req.body.SpeechResult || req.body.TranscriptionText || '';

  console.log('Gather from', callSid, 'text=', speechResult);

  if (!sessions.has(callSid)) {
    sessions.set(callSid, { history: [{ role: 'system', content: PROMPT_TEMPLATE }] });
  }
  const session = sessions.get(callSid);

  // Append user message
  session.history.push({ role: 'user', content: speechResult });

  // Get AI reply
  let aiReply = 'Mi dispiace, non ho compreso. Può ripetere?';
  try {
    aiReply = await openaiChatReply(session.history);
    // Append assistant reply to history
    session.history.push({ role: 'assistant', content: aiReply });
  } catch (err) {
    console.error('Chat error', err?.response?.data || err.message);
  }

  // Create TTS audio for AI reply
  try {
    const audioBuffer = await openaiTextToSpeech(aiReply);
    const audioUrl = await saveAudioBuffer(audioBuffer);
    session.lastAudio = audioUrl;

    // TwiML: Play the AI audio and re-gather for more speech
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Gather input="speech dtmf" action="/gather" method="POST" timeout="5" speechTimeout="auto">
    <Say>Posso ancora aiutarla?</Say>
  </Gather>
  <Say>Grazie! Arrivederci.</Say>
  <Hangup/>
</Response>`;

    res.type('text/xml').send(twiml);
  } catch (err) {
    console.error('TTS error 2', err?.response?.data || err.message);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Si è verificato un errore. Riprovare più tardi.</Say><Hangup/></Response>`;
    res.type('text/xml').send(fallback);
  }
});

// Simple endpoint to view session history (for debugging)
app.get('/session/:callSid', (req, res) => {
  const s = sessions.get(req.params.callSid) || null;
  res.json(s);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Make sure BASE_URL is set to your public URL, current BASE_URL=${BASE_URL}`);
});

/*
--- End server.js ---

DEPLOY & TWILIO SETUP QUICK GUIDE
1. Deploy this file to a public server (Render, Railway, VPS). Set env vars: OPENAI_API_KEY and BASE_URL.
2. Create a Twilio account and buy a phone number capable of voice.
3. In the Twilio Console, configure the phone number's "A CALL COMES IN" webhook to:
   POST {BASE_URL}/voice
4. Make a call to the Twilio number and hear the AI greeting.
5. After the greeting, speak; Twilio will POST speech to /gather and the flow continues.

COSTS: Twilio charges per incoming minute and per speech recognition use; OpenAI charges per TTS / chat tokens. Expect a few euros per month for light testing.

SECURITY & PRODUCTION TIPS
- Validate Twilio signature on webhooks.
- Use persistent DB for sessions.
- Clean up old audio files periodically.
- Use HTTPS and a real domain.

*/