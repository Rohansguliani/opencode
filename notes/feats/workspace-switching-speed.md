# Workspace Switching Speed Improvements

## Problem
Switching between chats within the *same* workspace feels nearly instant because the data just swaps out and the UI stays mounted. However, switching to a chat in a *different* workspace causes a noticeable lag/CPU spike. This happens because the heavy interactive UI components (ProseMirror input box, Xterm terminal instance, File Explorer tree, and SDK connections) are often tied to the specific directory's context or route parameter. When the directory changes in the URL, the framework tears down these expensive components and rebuilds them from scratch. 

## Vision
Workspaces shouldn't be treated as isolated applications that require a full teardown to switch between. They are just logical separators pointing to different folders.

## Solution

1. **Lift Heavy Components out of Workspace Context:**
   Instead of binding the text editor and terminal instances to the specific workspace's data provider, we elevate them so they persist globally. They will update their `workingDirectory` state reactively rather than remounting.
   
2. **Stateless UI:**
   The Editor and Terminal should be "stateless" relative to the workspace. When a workspace switch happens:
   - The editor points its file-read APIs to the new path.
   - The terminal clears its buffer or reconnects its stream without tearing down the actual DOM `xterm.js` canvas.

3. **Global Connection Pooling:**
   Keep the SDK's WebSocket connection and background file-watchers alive via the `GlobalSync` store. When users return to a workspace, the background hydration shouldn't need a total cold-start connection, it should instantly serve from the cached file tree and sync store.

4. **SolidJS Key/Memo Checks:**
   SolidJS routing is reactive. We must ensure there isn't a `<Show>` or `<Key>` component unnecessarily keyed to the `dir` param that is forcing a re-render of the entire layout. We only want the *data* bindings inside the panels to react to the `dir` param.
