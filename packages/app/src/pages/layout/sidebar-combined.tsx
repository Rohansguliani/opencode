import { type Accessor, For, Show, type JSX } from "solid-js"
import {
  DragDropProvider,
  DragDropSensors,
  SortableProvider,
  DragOverlay,
  createSortable,
  closestCenter,
} from "@thisbeyond/solid-dnd"
import { Button } from "@opencode-ai/ui/button"
import { useLanguage } from "@/context/language"
import { type LocalProject } from "@/context/layout"
import { WorkspaceItem, type WorkspaceSidebarContext } from "./sidebar-workspace"

function SortableCombinedProject(props: {
  project: LocalProject

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
  closeProject: (directory: string) => void
  chooseProject: () => void

  ctx: WorkspaceSidebarContext
  handleDragStart: (event: unknown) => void
  handleDragEnd: () => void
  handleDragOver: (event: any) => void
  renderProjectOverlay: () => JSX.Element
}): JSX.Element {
  const language = useLanguage()

  return (
    <div class="size-full flex flex-col bg-background-base border-l border-t border-border-weaker-base xl:rounded-tl-[12px]">
      <div class="shrink-0 px-3 py-2 border-b border-border-weaker-base">
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
          fallback={<div class="p-4 text-13-regular text-text-weak">Open a project to get started.</div>}
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
