import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// === CONFIG ===
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// === INIT OPENAI ===
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// === CONVERSATION MEMORY ===
const sessions = {};

// === ROUTES ===
app.get("/", (req, res) => {
  res.send("✅ Assistente Baffone è attivo e pronto a rispondere alle chiamate!");
});

app.post("/voice", async (req, res) => {
  const callSid = req.body.CallSid || uuidv4();
  const userSpeech = req.body.SpeechResult || "";

  if (!sessions[callSid]) {
    sessions[callSid] = [
      {
        role: "system",
        content: `
Sei "Assistente Baffone", un'assistente virtuale gentile e professionale del "Ristorante Al Nuovo Baffone".
Parli sempre in italiano, con voce femminile, accogliente e cortese.
Ti occupi di rispondere alle domande dei clienti, prendere prenotazioni e dare informazioni su orari, menù e servizi.
Mantieni sempre uno stile naturale e caloroso, come una cameriera esperta che parla con i clienti.
`,
      },
    ];
  }

  if (userSpeech) {
    sessions[callSid].push({ role: "user", content: userSpeech });
  }

  // Ottieni la risposta testuale
  const chatResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: sessions[callSid],
  });

  const aiText = chatResponse.choices[0].message.content;
  sessions[callSid].push({ role: "assistant", content: aiText });

  // Genera file audio con la voce femminile italiana
  const speechFile = `./audio-${uuidv4()}.mp3`;
  const tts = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy", // voce naturale
    input: aiText,
  });

  const buffer = Buffer.from(await tts.arrayBuffer());
  await fs.writeFile(speechFile, buffer);

  // Risposta TwiML
  const twiml = `
    <Response>
      <Say language="it-IT" voice="Polly.Carla">Buongiorno! Sono l'assistente virtuale del Ristorante Al Nuovo Baffone.</Say>
      <Play>${BASE_URL}/audio/${speechFile.replace("./", "")}</Play>
      <Gather input="speech" action="/voice" method="POST" timeout="5" />
    </Response>
  `;

  res.type("text/xml");
  res.send(twiml);
});

app.use("/audio", express.static("."));

app.listen(PORT, () => {
  console.log(`🚀 Assistente Baffone in ascolto su http://localhost:${PORT}`);
});
