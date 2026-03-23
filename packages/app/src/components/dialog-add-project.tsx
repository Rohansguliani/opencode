import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { TextField } from "@opencode-ai/ui/text-field"
import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { joinWorkspace, stripWorkspace } from "@/utils/workspace"
import { DialogSelectDirectory } from "./dialog-select-directory"

export function DialogAddProject(props: {
  onSelect: (directory: string, name?: string) => void
  initialDirectory?: string
  initialName?: string
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const globalSDK = useGlobalSDK()
  const globalSync = useGlobalSync()

  const [store, setStore] = createStore({
    name: props.initialName ?? "",
    directory: stripWorkspace(props.initialDirectory ?? "~/") || "~/",
    saving: false,
  })
  const selected = createMemo(() => store.directory || "~/")

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!store.directory) return
    setStore("saving", true)

    try {
      let finalDir = store.directory
      if (finalDir === "~") {
        finalDir = globalSync.data.path?.home ?? finalDir
      } else if (finalDir.startsWith("~/")) {
        finalDir = (globalSync.data.path?.home ?? "") + finalDir.slice(1)
      }

      const ws = await globalSDK.client.experimental.workspace.create({
        body_directory: finalDir,
        type: "logical",
        name: store.name || undefined,
      })
      const logical = joinWorkspace(ws.data?.directory ?? finalDir, ws.data?.id)

      props.onSelect(logical, store.name || ws.data?.name || undefined)
      dialog.close()
    } catch (err) {
      console.error(err)
    } finally {
      setStore("saving", false)
    }
  }

  return (
    <Dialog title="Add Workspace" class="w-full max-w-[960px] mx-auto">
      <form onSubmit={handleSubmit} class="flex h-[70vh] min-h-0 flex-col p-6 pt-0">
        <DialogSelectDirectory
          chrome="plain"
          closeOnSelect={false}
          autofocus={false}
          defaultFilter={selected()}
          onFilter={(value) => setStore("directory", value || "~/")}
          onSelect={(result) => {
            if (!result || Array.isArray(result)) return
            setStore("directory", result)
          }}
          header={
            <div class="pb-2">
              <TextField
                autofocus
                type="text"
                label="Workspace Name"
                placeholder="e.g. My Project (optional)"
                value={store.name}
                onChange={(value) => setStore("name", value)}
              />
            </div>
          }
          footer={
            <div class="flex items-center justify-between gap-4 pt-2">
              <div class="min-w-0 text-12-regular text-text-weak truncate">{selected()}</div>
              <div class="flex items-center gap-2 shrink-0">
                <Button type="button" variant="ghost" onClick={() => dialog.close()}>
                  {language.t("common.cancel")}
                </Button>
                <Button type="submit" loading={store.saving} disabled={!store.directory || store.saving}>
                  Add Workspace
                </Button>
              </div>
            </div>
          }
        />
      </form>
    </Dialog>
  )
}
