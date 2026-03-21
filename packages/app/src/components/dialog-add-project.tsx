import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { TextField } from "@opencode-ai/ui/text-field"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { DialogSelectDirectory } from "./dialog-select-directory"

export function DialogAddProject(props: { onSelect: (directory: string, name?: string) => void }) {
  const dialog = useDialog()
  const language = useLanguage()
  const platform = usePlatform()
  const server = useServer()
  const globalSDK = useGlobalSDK()
  const globalSync = useGlobalSync()

  const [store, setStore] = createStore({
    name: "",
    directory: "~",
    saving: false,
  })

  async function handleBrowse() {
    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog({
        title: language.t("command.project.open"),
        multiple: false,
      })
      if (result) {
        setStore("directory", Array.isArray(result) ? result[0] : result)
      }
    } else {
      dialog.show(
        () => (
          <DialogSelectDirectory
            multiple={false}
            onSelect={(result) => {
              if (result && !Array.isArray(result)) {
                setStore("directory", result)
              }
            }}
          />
        ),
        () => {},
      )
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!store.directory) return
    setStore("saving", true)
    
    try {
            let finalDir = store.directory;
      if (finalDir === "~") {
        finalDir = globalSync.data.path?.home ?? finalDir;
      } else if (finalDir.startsWith("~/")) {
        finalDir = (globalSync.data.path?.home ?? "") + finalDir.slice(1);
      }
        // Always create a workspace to ensure isolated sessions
        const ws = await globalSDK.client.experimental.workspace.create({ body_directory: finalDir, type: "logical", name: store.name || undefined })
        if (ws?.data?.id) {
          finalDir = finalDir + "?workspace=" + ws.data.id;
        }
      // Force global sync to fetch the newly updated project so the sidebar updates instantly
      await globalSync.bootstrap();
      props.onSelect(finalDir, store.name)
      dialog.close()
    } catch (err) {
      console.error(err)
    } finally {
      setStore("saving", false)
    }
  }

  return (
    <Dialog title="Add Workspace" class="w-full max-w-[480px] mx-auto">
      <form onSubmit={handleSubmit} class="flex flex-col gap-6 p-6 pt-0">
        <TextField
          autofocus
          type="text"
          label="Workspace Name"
          placeholder="e.g. My Project (optional)"
          value={store.name}
          onChange={(v) => setStore("name", v)}
        />
        
        <div class="flex flex-col gap-2">
          <label class="text-12-medium text-text-weak">Directory</label>
          <div class="flex gap-2">
            <TextField
              class="flex-1"
              type="text"
              value={store.directory}
              onChange={(v) => setStore("directory", v)}
            />
            <Button type="button" variant="secondary" onClick={handleBrowse}>
              Browse
            </Button>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button type="submit" loading={store.saving} disabled={!store.directory || store.saving}>
            Add Workspace
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
