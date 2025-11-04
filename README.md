# 🤖 Assistente Baffone – Ristorante Al Nuovo Baffone

Assistente vocale AI in **italiano**, con voce femminile, per rispondere automaticamente alle chiamate del ristorante.

---

## ⚙️ Come funziona

Quando qualcuno chiama il numero Twilio collegato:
1. L’audio viene inviato al server.
2. L’assistente AI “Assistente Baffone” (basato su OpenAI GPT + TTS) ascolta, capisce e risponde con voce naturale.
3. La conversazione continua in tempo reale, come con una vera cameriera virtuale.

---

## 🚀 Setup passo-passo

### 1️⃣ Crea un repository su GitHub
1. Vai su [https://github.com](https://github.com)
2. Clicca **“+ → New repository”**
3. Nome: `assistente-baffone`
4. Crea il repo (lascia tutto vuoto)
5. Clicca **Upload files** e carica:
   - `server.js`
   - `package.json`
   - `README.md`
6. Clicca **Commit changes**

---

### 2️⃣ Pubblica su Render
1. Vai su [https://render.com](https://render.com)
2. Clicca **New + → Web Service**
3. Collega il tuo repo `assistente-baffone`
4. Configura:
   - **Start command:** `npm start`
   - **Environment variables:**
     - `OPENAI_API_KEY` → la tua chiave OpenAI
     - `BASE_URL` → (verrà assegnato da Render, puoi lasciarlo vuoto)
5. Clicca **Deploy Web Service**

Dopo qualche minuto, avrai un link come:
