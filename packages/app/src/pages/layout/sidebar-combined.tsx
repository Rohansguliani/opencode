import { type Accessor, For, Show, type JSX } from "solid-js"
import { DragDropProvider, DragDropSensors, SortableProvider, DragOverlay, createSortable, closestCenter } from "@thisbeyond/solid-dnd"
import { Button } from "@opencode-ai/ui/button"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useLanguage } from "@/context/language"
import { type LocalProject } from "@/context/layout"
import { WorkspaceItem, type WorkspaceSidebarContext } from "./sidebar-workspace"

function SortableCombinedProject(props: {
  project: LocalProject
  sortNow: Accessor<number>
  workspaceIds: (project: LocalProject) => string[]
  mobile?: boolean
  opened: Accessor<boolean>
  ctx: WorkspaceSidebarContext
  closeProject: (directory: string) => void
}) {
  const sortable = createSortable(props.project.worktree)
  return (
    <div
      // @ts-ignore
      use:sortable
      classList={{
        "opacity-30": sortable.isActiveDraggable,
        "pointer-events-none": sortable.isActiveDraggable,
      }}
    >
      <For each={props.workspaceIds(props.project)}>
        {(directory) => (
          <WorkspaceItem
            ctx={props.ctx}
            directory={directory}
            project={props.project}
            sortNow={props.sortNow}
            mobile={props.mobile}
            popover={!props.mobile && props.opened()}
            combined
            closeProject={() => props.closeProject(props.project.worktree)}
          />
        )}
      </For>
    </div>
  )
}

export function CombinedSidebar(props: {
  mobile?: boolean
  opened: Accessor<boolean>
  projects: Accessor<LocalProject[]>
  workspaceIds: (project: LocalProject) => string[]
  workspacesEnabled: (project: LocalProject) => boolean
  toggleProjectWorkspaces: (project: LocalProject) => void
  showEditProjectDialog: (project: LocalProject) => void
  closeProject: (directory: string) => void
  createWorkspace: (project: LocalProject) => Promise<void>
  chooseProject: () => void
  openSettings: () => void
  openHelp: () => void
  sortNow: Accessor<number>
  ctx: WorkspaceSidebarContext
  handleDragStart: (event: unknown) => void
  handleDragEnd: () => void
  handleDragOver: (event: any) => void
  renderProjectOverlay: () => JSX.Element
}): JSX.Element {
  const language = useLanguage()

  return (
      <div class="size-full flex flex-col bg-background-base border-l border-t border-border-weaker-base xl:rounded-tl-[12px]">
        <div class="shrink-0 p-3 border-b border-border-weaker-base flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-14-medium text-text-strong">Combined View</div>
          <div class="flex items-center gap-1">
            <Tooltip placement={props.mobile ? "bottom" : "top"} value={language.t("sidebar.settings")}>
              <IconButton
                icon="settings-gear"
                variant="ghost"
                class="size-7 rounded-md"
                onClick={props.openSettings}
                aria-label={language.t("sidebar.settings")}
              />
            </Tooltip>
            <Tooltip placement={props.mobile ? "bottom" : "top"} value={language.t("sidebar.help")}>
              <IconButton
                icon="help"
                variant="ghost"
                class="size-7 rounded-md"
                onClick={props.openHelp}
                aria-label={language.t("sidebar.help")}
              />
            </Tooltip>
          </div>
        </div>
        <Button size="large" icon="plus" class="w-full" onClick={props.chooseProject}>
          {language.t("command.project.open")}
        </Button>
      </div>

      <div
        ref={(el) => props.ctx.setScrollContainerRef(el, props.mobile)}
        class="flex-1 min-h-0 overflow-y-auto no-scrollbar [overflow-anchor:none]"
      >
        <Show
          when={props.projects().length > 0}
          fallback={
            <div class="p-4 text-13-regular text-text-weak">
              Open a project to start using Combined View.
            </div>
          }
        >
          <div class="p-2 flex flex-col gap-1">
            <DragDropProvider
              onDragStart={props.handleDragStart}
              onDragEnd={props.handleDragEnd}
              onDragOver={props.handleDragOver}
              collisionDetector={closestCenter}
            >
              <DragDropSensors />
              <SortableProvider ids={props.projects().map((p) => p.worktree)}>
                <For each={props.projects()}>
                  {(project) => (
                    <SortableCombinedProject
                      project={project}
                      sortNow={props.sortNow}
                      workspaceIds={props.workspaceIds}
                      mobile={props.mobile}
                      opened={props.opened}
                      ctx={props.ctx}
                      closeProject={props.closeProject}
                    />
                  )}
                </For>
              </SortableProvider>
              <DragOverlay>{props.renderProjectOverlay()}</DragOverlay>
            </DragDropProvider>
          </div>
        </Show>
      </div>
    </div>
  )
}
