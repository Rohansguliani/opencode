import { db } from "../src/storage/simple-db"

async function run() {
  console.log("Querying DB for session ses_m0xs2nxzy...")
  try {
    const session = db.prepare('SELECT * FROM simple_sessions WHERE id = ?').get('ses_m0xs2nxzy')
    console.log("Session:", session)
    
    const messages = db.prepare('SELECT * FROM simple_messages WHERE session_id = ?').all('ses_m0xs2nxzy')
    console.log("Messages:", messages)
  } catch (e) {
    console.error("Error:", e)
  }
}

run()
