async function run() {
  console.log("Connecting to SSE...")
  try {
    const res = await fetch("http://localhost:4096/global/event")
    if (!res.ok) {
      console.error("Failed to connect:", res.status)
      return
    }
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log("Stream closed")
          break
        }
        console.log("Received:", decoder.decode(value))
      }
    }
  } catch (e) {
    console.error("Error:", e)
  }
}

run()
