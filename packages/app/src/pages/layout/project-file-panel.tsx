import { For, Show, createMemo, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { Tabs } from "@opencode-ai/ui/tabs"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { Mark } from "@opencode-ai/ui/logo"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import FileTree from "@/components/file-tree"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { FileVisual, SortableTab } from "@/components/session"
import { useCommand } from "@/context/command"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { createFileTabListSync } from "@/pages/session/file-tab-scroll"
import { FileTabContent } from "@/pages/session/file-tabs"
import { createOpenSessionFileTab, createSessionTabs, createSizing, getTabReorderIndex } from "@/pages/session/helpers"
import { useSessionLayout } from "@/pages/session/session-layout"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"

const CONTENT = 360

export function ProjectFilePanel() {
  const layout = useLayout()
  const file = useFile()
  const language = useLanguage()
  const command = useCommand()
  const dialog = useDialog()
  const { tabs } = useSessionLayout()
  const desktop = createMediaQuery("(min-width: 768px)")
  const size = createSizing()

  const [state, setState] = createStore({
    drag: undefined as string | undefined,
  })

  const open = createMemo(() => desktop() && layout.fileTree.opened())
  const width = createMemo(() => (open() ? `${CONTENT + layout.fileTree.width()}px` : "0px"))
  const tree = createMemo(() => `${layout.fileTree.width()}px`)
  const norm = (tab: string) => (tab.startsWith("file://") ? file.tab(tab) : tab)
  const openTab = createOpenSessionFileTab({
    normalizeTab: norm,
    openTab: tabs().open,
    pathFromTab: file.pathFromTab,
    loadFile: file.load,
    openReviewPanel: () => undefined,
    setActive: tabs().setActive,
  })
  const stateTabs = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab: norm,
  })

  const show = (path: string) => {
    const tab = file.tab(path)
    tabs().open(tab)
    void file.load(path)
    tabs().setActive(tab)
  }

  const dragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setState("drag", id)
  }

  const dragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!draggable || !droppable) return
    const next = getTabReorderIndex(tabs().all(), draggable.id.toString(), droppable.id.toString())
    if (next === undefined) return
    tabs().move(draggable.id.toString(), next)
  }

  const dragEnd = () => {
    setState("drag", undefined)
  }

  return (
    <aside
      id="project-file-panel"
      aria-label="Project files"
      aria-hidden={!open()}
      inert={!open()}
      class="relative min-w-0 h-full shrink-0 overflow-hidden bg-background-base"
      classList={{
        "pointer-events-none": !open(),
        "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none": !size.active(),
      }}
      style={{ width: width() }}
    >
      <div class="size-full flex border-l border-border-weaker-base bg-background-base">
        <div class="relative min-w-0 h-full w-[360px] flex-1 overflow-hidden bg-background-base">
          <DragDropProvider onDragStart={dragStart} onDragEnd={dragEnd} onDragOver={dragOver} collisionDetector={closestCenter}>
            <DragDropSensors />
            <ConstrainDragYAxis />
            <Tabs value={stateTabs.activeTab()} onChange={openTab} class="h-full">
              <div class="sticky top-0 shrink-0 flex border-b border-border-weak-base bg-background-base">
                <Tabs.List
                  ref={(el: HTMLDivElement) => {
                    const stop = createFileTabListSync({ el, contextOpen: () => false })
                    onCleanup(stop)
                  }}
                >
                  <SortableProvider ids={stateTabs.openedTabs()}>
                    <For each={stateTabs.openedTabs()}>{(tab) => <SortableTab tab={tab} onTabClose={tabs().close} />}</For>
                  </SortableProvider>
                  <div class="bg-background-base h-full shrink-0 sticky right-0 z-10 flex items-center justify-center pr-3">
                    <TooltipKeybind title={language.t("command.file.open")} keybind={command.keybind("file.open")} class="flex items-center">
                      <IconButton
                        icon="plus-small"
                        variant="ghost"
                        iconSize="large"
                        class="!rounded-md"
                        onClick={() => dialog.show(() => <DialogSelectFile mode="files" />)}
                        aria-label={language.t("command.file.open")}
                      />
                    </TooltipKeybind>
                  </div>
                </Tabs.List>
              </div>

              <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                <Show when={stateTabs.activeTab() === "empty"}>
                  <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                    <div class="h-full px-6 pb-24 -mt-4 flex flex-col items-center justify-center text-center gap-6">
                      <Mark class="w-14 opacity-10" />
                      <div class="text-14-regular text-text-weak max-w-56">{language.t("session.files.selectToOpen")}</div>
                    </div>
                  </div>
                </Show>
              </Tabs.Content>

              <Show when={stateTabs.activeFileTab()} keyed>
                {(tab) => <FileTabContent tab={tab} />}
              </Show>
            </Tabs>
            <DragOverlay>
              <Show when={state.drag} keyed>
                {(tab) => {
                  const path = file.pathFromTab(tab)
                  return <div data-component="tabs-drag-preview"><Show when={path}>{(p) => <FileVisual active path={p()} />}</Show></div>
                }}
              </Show>
            </DragOverlay>
          </DragDropProvider>
        </div>

        <div onPointerDown={() => size.start()}>
          <ResizeHandle
            direction="horizontal"
            edge="start"
            size={layout.fileTree.width()}
            min={220}
            max={520}
            collapseThreshold={180}
            onResize={(value) => {
              size.touch()
              layout.fileTree.resize(value)
            }}
            onCollapse={layout.fileTree.close}
          />
        </div>

        <div id="file-tree-panel" aria-hidden={!open()} inert={!open()} class="relative min-w-0 h-full shrink-0 overflow-hidden" style={{ width: tree() }}>
          <div class="h-full flex flex-col overflow-hidden bg-background-base">
            <div class="h-11 shrink-0 px-4 flex items-center border-b border-border-weak-base text-13-medium text-text-strong">
              {language.t("session.files.all")}
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto bg-background-stronger px-3 py-0">
              <FileTree path="" class="pt-3" onFileClick={(node) => show(node.path)} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
