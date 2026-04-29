import { generateText } from "ai"
import { google } from "@ai-sdk/google"

const apiKey = "AIzaSyDNyk1exfKPNxY3Hmt6q5_fGth-yyBtkZ8"
process.env.GEMINI_API_KEY = apiKey
process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey

async function run() {
  console.log("Starting Gemini test with gemini-2.5-flash...")
  const model = google('gemini-2.5-flash')
  try {
    const { text } = await generateText({
      model,
      prompt: "Hello, are you working?",
    })
    console.log("Response:", text)
  } catch (e) {
    console.error("Error:", e)
  }
}

run()
