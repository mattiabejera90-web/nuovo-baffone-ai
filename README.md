# 🤖 Assistente Baffone – Ristorante Al Nuovo Baffone

Assistente vocale AI in **italiano**, con voce femminile, per rispondere automaticamente alle chiamate del ristorante.

---

## ⚙️ Setup rapido

### 1️⃣ Crea il repo su GitHub
1. Vai su [https://github.com](https://github.com)
2. Clicca “+ → New repository”
3. Nome: `assistente-baffone`
4. Carica:
   - `server.js`
   - `package.json`
   - `README.md`
5. Fai commit

---

### 2️⃣ Deploy su Render
1. Vai su [https://render.com](https://render.com)
2. Clicca **New + → Web Service**
3. Collega il tuo repo `assistente-baffone`
4. Imposta:
   - **Start command:** `npm start`
5. Nelle **Environment Variables** aggiungi:
   - `OPENAI_API_KEY` → la tua chiave OpenAI (inizia con `sk-...`)
   - `BASE_URL` → lo inserisci dopo il primo deploy (Render ti darà il link)
6. Clicca **Deploy Web Service**

Dopo pochi minuti avrai un link come:
