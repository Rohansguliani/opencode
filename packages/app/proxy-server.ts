import http from "http"
import fs from "fs"
import path from "path"

const PORT = 8080
const API_PORT = 4097

const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}

const server = http.createServer((req, res) => {
  // Proxy API requests to backend
  if (req.url?.startsWith("/api/") || req.url?.startsWith("/health") || req.url?.startsWith("/auth") || req.url?.startsWith("/project") || req.url?.startsWith("/session")) {
    const options = {
      hostname: "127.0.0.1",
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    }

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
      proxyRes.pipe(res, { end: true })
    })

    req.pipe(proxyReq, { end: true })
    return
  }

  // Serve static files
  let filePath = path.join(process.cwd(), "dist", req.url === "/" ? "index.html" : req.url)
  
  if (!fs.existsSync(filePath)) {
    filePath = path.join(process.cwd(), "dist", "index.html")
  }

  const ext = path.extname(filePath)
  const contentType = mimeTypes[ext] || "application/octet-stream"

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end("Not found")
      return
    }
    res.writeHead(200, { "Content-Type": contentType })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Proxying API calls to http://localhost:${API_PORT}`)
})
