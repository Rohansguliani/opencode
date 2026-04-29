import { test } from "node:test"
import assert from "node:assert"

const BASE_URL = "http://localhost:4096"
let workspaceId = ""
let sessionId = ""

test("Simple Stuff Flow", async (t) => {
  const testDir = `/tmp/test-ws-${Math.random().toString(36).substring(2, 11)}`

  await t.test("Add Workspace", async () => {
    const res = await fetch(`${BASE_URL}/experimental/workspace`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-opencode-directory": testDir
      },
      body: JSON.stringify({ directory: testDir, name: "Test Workspace", type: "worktree" }),
    })
    if (res.status !== 200) {
      console.error("Add Workspace failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.ok(data.id)
    assert.strictEqual(data.directory, testDir)
    workspaceId = data.id
  })

  await t.test("List Workspaces", async () => {
    const res = await fetch(`${BASE_URL}/experimental/workspace`, {
      headers: { "x-opencode-directory": testDir }
    })
    if (res.status !== 200) {
      console.error("List Workspaces failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any[]
    const found = data.find((ws) => ws.id === workspaceId)
    assert.ok(found)
  })

  await t.test("Add Chat", async () => {
    const res = await fetch(`${BASE_URL}/session`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-opencode-directory": testDir
      },
      body: JSON.stringify({ directory: workspaceId, title: "Test Chat" }),
    })
    if (res.status !== 200) {
      console.error("Add Chat failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.ok(data.id)
    assert.strictEqual(data.title, "Test Chat")
    sessionId = data.id
  })

  await t.test("List Chats", async () => {
    const res = await fetch(`${BASE_URL}/session?directory=${encodeURIComponent(workspaceId)}`, {
      headers: { "x-opencode-directory": testDir }
    })
    if (res.status !== 200) {
      console.error("List Chats failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any[]
    console.log("All sessions in List Chats:", data)
    console.log("Looking for sessionId:", sessionId)
    const found = data.find((s) => s.id === sessionId)
    assert.ok(found)
  })

  await t.test("Send Message", async () => {
    const res = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-opencode-directory": testDir
      },
      body: JSON.stringify({ prompt: "Hello", parts: [{ type: 'text', text: "Hello" }] }),
    })
    if (res.status !== 200) {
      console.error("Send Message failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.ok(data.info)
    assert.strictEqual(data.parts[0].text, "Echo: Hello")
  })

  await t.test("Send Async Message", async () => {
    const res = await fetch(`${BASE_URL}/session/${sessionId}/prompt_async`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-opencode-directory": testDir
      },
      body: JSON.stringify({ prompt: "Hello Async", parts: [{ type: 'text', text: "Hello Async" }] }),
    })
    if (res.status !== 200) {
      console.error("Send Async Message failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.strictEqual(data.success, true)

    // Wait for async response to appear in DB
    let found = false
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const listRes = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
        headers: { "x-opencode-directory": testDir }
      })
      const messages = await listRes.json() as any[]
      const assistantMsg = messages.find(m => m.info.role === 'assistant' && !m.parts[0].text.startsWith("Echo:"))
      if (assistantMsg) {
        found = true
        console.log("Found async response:", assistantMsg.parts[0].text)
        break
      }
    }
    assert.ok(found, "Async response not found in database after timeout")
  })

  await t.test("Archive Chat", async () => {
    const res = await fetch(`${BASE_URL}/session/${sessionId}`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "x-opencode-directory": testDir
      },
      body: JSON.stringify({ time: { archived: Date.now() } }),
    })
    if (res.status !== 200) {
      console.error("Archive Chat failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.ok(data.time.archived)
  })

  await t.test("Delete Chat", async () => {
    const res = await fetch(`${BASE_URL}/session/${sessionId}`, {
      method: "DELETE",
      headers: { "x-opencode-directory": testDir }
    })
    if (res.status !== 200) {
      console.error("Delete Chat failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data, true)
  })

  await t.test("Delete Workspace", async () => {
    const res = await fetch(`${BASE_URL}/experimental/workspace/${workspaceId}`, {
      method: "DELETE",
      headers: { "x-opencode-directory": testDir }
    })
    if (res.status !== 200) {
      console.error("Delete Workspace failed:", await res.text())
    }
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.strictEqual(data.id, workspaceId)
  })
})
