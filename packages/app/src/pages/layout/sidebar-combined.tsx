import { type Accessor, For, Show, type JSX } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useLanguage } from "@/context/language"
import { type LocalProject } from "@/context/layout"
import { WorkspaceItem, type WorkspaceSidebarContext } from "./sidebar-workspace"

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
            <For each={props.projects()}>
              {(project) => (
                <For each={props.workspaceIds(project)}>
                  {(directory) => (
                    <WorkspaceItem
                      ctx={props.ctx}
                      directory={directory}
                      project={project}
                      sortNow={props.sortNow}
                      mobile={props.mobile}
                      popover={!props.mobile && props.opened()}
                      combined
                      closeProject={() => props.closeProject(project.worktree)}
                    />
                  )}
                </For>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
