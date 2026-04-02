import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, For, Show, type Accessor, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { base64Encode } from "@opencode-ai/util/encode"
import { Button } from "@opencode-ai/ui/button"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { type Session } from "@opencode-ai/sdk/v2/client"
import { ROOT_SESSION_PAGE_LIMIT } from "@/context/global-sync/types"
import { useLayout, type LocalProject } from "@/context/layout"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { sessionMode, sessionQuery, sessionValue } from "@/utils/session-layout"
import { stripWorkspace, workspaceTitle } from "@/utils/workspace"
import { NewSessionItem, SessionItem, SessionSkeleton } from "./sidebar-items"
import { childMapByParent, displayName, sortedRootSessions } from "./helpers"

type InlineEditorComponent = (props: {
  id: string
  value: Accessor<string>
  onSave: (next: string) => void
  class?: string
  displayClass?: string
  editing?: boolean
  stopPropagation?: boolean
  openOnDblClick?: boolean
}) => JSX.Element

export type WorkspaceSidebarContext = {
  currentDir: Accessor<string>
  navList: Accessor<Session[]>
  sidebarExpanded: Accessor<boolean>
  sidebarHovering: Accessor<boolean>
  nav: Accessor<HTMLElement | undefined>
  hoverSession: Accessor<string | undefined>
  setHoverSession: (id: string | undefined) => void
  clearHoverProjectSoon: () => void
  prefetchSession: (session: Session, priority?: "high" | "low") => void
  archiveSession: (session: Session) => Promise<void>
  deleteSession: (session: Session) => Promise<void>
  renameSession: (session: Session, next: string) => Promise<void>
  hydrateWorkspace: (directory: string, priority?: "high" | "low") => void
  workspaceName: (directory: string, projectId?: string, branch?: string) => string | undefined
  renameWorkspace: (directory: string, next: string, projectId?: string, branch?: string) => void
  editorOpen: (id: string) => boolean
  openEditor: (id: string, value: string) => void
  closeEditor: () => void
  setEditor: (key: "value", value: string) => void
  InlineEditor: InlineEditorComponent
  isBusy: (directory: string) => boolean
  isLoadingSessions: (directory: string) => boolean
  workspaceExpanded: (directory: string, local: boolean) => boolean
  setWorkspaceExpanded: (directory: string, value: boolean) => void
  showResetWorkspaceDialog: (root: string, directory: string) => void
  showDeleteWorkspaceDialog: (root: string, directory: string) => void
  setScrollContainerRef: (el: HTMLDivElement | undefined, mobile?: boolean) => void
}

const WorkspaceHeader = (props: {
  local: Accessor<boolean>
  busy: Accessor<boolean>
  open: Accessor<boolean>
  directory: string
  combined?: boolean
  language: ReturnType<typeof useLanguage>
  branch: Accessor<string | undefined>
  workspaceValue: Accessor<string>
  workspaceEditActive: Accessor<boolean>
  InlineEditor: WorkspaceSidebarContext["InlineEditor"]
  renameWorkspace: WorkspaceSidebarContext["renameWorkspace"]
  setEditor: WorkspaceSidebarContext["setEditor"]
  projectId?: string
  project: LocalProject
}): JSX.Element => (
  <div class="flex items-center gap-1.5 min-w-0 flex-1">
    <Show when={props.combined}>
      <div class="flex items-center justify-center shrink-0 size-4 text-icon-weak transition-transform opacity-70 group-hover/workspace:opacity-100">
        <Icon name={props.open() ? "chevron-down" : "chevron-right"} size="small" />
      </div>
    </Show>
    <Show when={!props.combined}>
      <div class="flex items-center justify-center shrink-0 size-6">
        <Show when={props.busy()} fallback={<Icon name="branch" size="small" />}>
          <Spinner class="size-[15px]" />
        </Show>
      </div>
    </Show>
    <div class="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
      <div class="flex items-center gap-1 min-w-0">
        <Show when={!props.combined}>
          <span class="text-14-medium text-text-base shrink-0">
            {props.local() ? props.language.t("workspace.type.local") : props.language.t("workspace.type.sandbox")} :
          </span>
        </Show>
        <Show
          when={!props.local()}
          fallback={
            <span class="text-14-medium text-text-strong min-w-0 truncate text-left w-full">
              {props.combined ? displayName(props.project) : (props.branch() ?? workspaceTitle(props.directory))}
            </span>
          }
        >
          <props.InlineEditor
            id={`workspace:${props.directory}`}
            value={props.workspaceValue}
            onSave={(next) => {
              const trimmed = next.trim()
              if (!trimmed) return
              props.renameWorkspace(props.directory, trimmed, props.projectId, props.branch())
              props.setEditor("value", props.workspaceValue())
            }}
            class="text-14-medium text-text-strong min-w-0 truncate text-left w-full"
            displayClass="text-14-medium text-text-strong min-w-0 truncate text-left w-full"
            editing={props.workspaceEditActive()}
            stopPropagation={false}
            openOnDblClick={false}
          />
        </Show>
      </div>
      <Show when={props.combined}>
        <span class="text-12-regular text-text-weak min-w-0 truncate text-left w-full">
          {stripWorkspace(props.directory)}
        </span>
      </Show>
    </div>
    <Show when={!props.combined}>
      <div
        class="flex items-center justify-center shrink-0 overflow-hidden transition-all duration-200 group-hover/workspace:w-3.5 group-hover/workspace:opacity-100 group-focus-within/workspace:w-3.5 group-focus-within/workspace:opacity-100"
        classList={{
          "w-0 opacity-0": true,
        }}
      >
        <Icon name={props.open() ? "chevron-down" : "chevron-right"} size="small" class="text-icon-base" />
      </div>
    </Show>
  </div>
)

const WorkspaceActions = (props: {
  directory: string
  local: Accessor<boolean>
  busy: Accessor<boolean>
  menuOpen: Accessor<boolean>
  pendingRename: Accessor<boolean>
  setMenuOpen: (open: boolean) => void
  setPendingRename: (value: boolean) => void
  sidebarHovering: Accessor<boolean>
  touch: Accessor<boolean>
  language: ReturnType<typeof useLanguage>
  workspaceValue: Accessor<string>
  openEditor: WorkspaceSidebarContext["openEditor"]
  showResetWorkspaceDialog: WorkspaceSidebarContext["showResetWorkspaceDialog"]
  showDeleteWorkspaceDialog: WorkspaceSidebarContext["showDeleteWorkspaceDialog"]
  root: string
  setHoverSession: WorkspaceSidebarContext["setHoverSession"]
  clearHoverProjectSoon: WorkspaceSidebarContext["clearHoverProjectSoon"]
  navigateToNewSession: () => void
  combined?: boolean
  closeProject?: () => void
}): JSX.Element => (
  <div
    class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity"
    classList={{
      "opacity-100 pointer-events-auto": props.menuOpen() || props.combined,
      "opacity-0 pointer-events-none": !props.menuOpen() && !props.combined,
      "group-hover/workspace:opacity-100 group-hover/workspace:pointer-events-auto": true,
      "group-focus-within/workspace:opacity-100 group-focus-within/workspace:pointer-events-auto": true,
    }}
  >
    <DropdownMenu
      modal={!props.sidebarHovering()}
      open={props.menuOpen()}
      onOpenChange={(open) => props.setMenuOpen(open)}
    >
      <Tooltip value={props.language.t("common.moreOptions")} placement="top">
        <DropdownMenu.Trigger
          as={IconButton}
          icon="dot-grid"
          variant="ghost"
          class="size-6 rounded-md"
          data-action="workspace-menu"
          data-workspace={base64Encode(props.directory)}
          aria-label={props.language.t("common.moreOptions")}
        />
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          onCloseAutoFocus={(event) => {
            if (!props.pendingRename()) return
            event.preventDefault()
            props.setPendingRename(false)
            props.openEditor(`workspace:${props.directory}`, props.workspaceValue())
          }}
        >
          <DropdownMenu.Item
            disabled={props.local()}
            onSelect={() => {
              props.setPendingRename(true)
              props.setMenuOpen(false)
            }}
          >
            <DropdownMenu.ItemLabel>{props.language.t("common.rename")}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={props.local() || props.busy()}
            onSelect={() => props.showResetWorkspaceDialog(props.root, props.directory)}
          >
            <DropdownMenu.ItemLabel>{props.language.t("common.reset")}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={props.local() || props.busy()}
            onSelect={() => props.showDeleteWorkspaceDialog(props.root, props.directory)}
          >
            <DropdownMenu.ItemLabel>{props.language.t("common.delete")}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
          <Show when={props.combined && props.closeProject && props.local()}>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={props.closeProject}>
              <DropdownMenu.ItemLabel>{props.language.t("common.close")}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </Show>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
    <Show when={!props.touch() || props.combined}>
      <Tooltip value={props.language.t("command.session.new")} placement="top">
        <IconButton
          icon="plus-small"
          variant="ghost"
          class="size-6 rounded-md"
          data-action="workspace-new-session"
          data-workspace={base64Encode(props.directory)}
          aria-label={props.language.t("command.session.new")}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            props.setHoverSession(undefined)
            props.clearHoverProjectSoon()
            props.navigateToNewSession()
          }}
        />
      </Tooltip>
    </Show>
  </div>
)

import { usePinnedSessions } from "@/utils/pinned-sessions"

const WorkspaceSessionList = (props: {
  directory: string
  slug: Accessor<string>
  mobile?: boolean
  popover?: boolean
  ctx: WorkspaceSidebarContext
  showNew: Accessor<boolean>
  loading: Accessor<boolean>
  sessions: Accessor<Session[]>
  children: Accessor<Map<string, string[]>>
  hasMore: Accessor<boolean>
  loadMore: () => Promise<void>
  language: ReturnType<typeof useLanguage>
  combined?: boolean
}): JSX.Element => {
  const { partition } = usePinnedSessions()
  const partitions = createMemo(() => partition(props.sessions()))
  const pinnedSessions = () => partitions()[0]
  const unpinnedSessions = () => partitions()[1]

  return (
    <nav class="flex flex-col gap-0.5">
      <Show when={props.showNew() && !props.combined}>
        <NewSessionItem
          slug={props.slug()}
          mobile={props.mobile}
          sidebarExpanded={props.ctx.sidebarExpanded}
          clearHoverProjectSoon={props.ctx.clearHoverProjectSoon}
          setHoverSession={props.ctx.setHoverSession}
        />
      </Show>
      <Show when={props.loading()}>
        <SessionSkeleton />
      </Show>

      <Show when={pinnedSessions().length > 0}>
        <Show when={!props.combined}>
          <div class="px-2 py-1 mt-1 text-[11px] font-medium text-text-weak uppercase tracking-wider">
            {props.language.t("common.pinned")}
          </div>
        </Show>
        <For each={pinnedSessions()}>
          {(session) => (
            <SessionItem
              session={session}
              directory={props.directory}
              list={props.sessions()}
              navList={props.ctx.navList}
              slug={props.slug()}
              mobile={props.mobile}
              popover={props.popover}
              children={props.children()}
              sidebarExpanded={props.ctx.sidebarExpanded}
              sidebarHovering={props.ctx.sidebarHovering}
              nav={props.ctx.nav}
              hoverSession={props.ctx.hoverSession}
              setHoverSession={props.ctx.setHoverSession}
              clearHoverProjectSoon={props.ctx.clearHoverProjectSoon}
              prefetchSession={props.ctx.prefetchSession}
              archiveSession={props.ctx.archiveSession}
              deleteSession={props.ctx.deleteSession}
              renameSession={props.ctx.renameSession}
              InlineEditor={props.ctx.InlineEditor}
            />
          )}
        </For>
        <Show when={!props.combined}>
          <div class="px-2 py-1 mt-1 text-[11px] font-medium text-text-weak uppercase tracking-wider">
            {props.language.t("common.recent") || "Recent"}
          </div>
        </Show>
      </Show>

      <For each={unpinnedSessions()}>
        {(session) => (
          <SessionItem
            session={session}
            directory={props.directory}
            list={props.sessions()}
            navList={props.ctx.navList}
            slug={props.slug()}
            mobile={props.mobile}
            popover={props.popover}
            children={props.children()}
            sidebarExpanded={props.ctx.sidebarExpanded}
            sidebarHovering={props.ctx.sidebarHovering}
            nav={props.ctx.nav}
            hoverSession={props.ctx.hoverSession}
            setHoverSession={props.ctx.setHoverSession}
            clearHoverProjectSoon={props.ctx.clearHoverProjectSoon}
            prefetchSession={props.ctx.prefetchSession}
            archiveSession={props.ctx.archiveSession}
            deleteSession={props.ctx.deleteSession}
            renameSession={props.ctx.renameSession}
            InlineEditor={props.ctx.InlineEditor}
          />
        )}
      </For>
      <Show when={props.hasMore()}>
        <div class="relative w-full py-1">
          <Button
            variant="ghost"
            class="flex w-full text-left justify-start text-14-regular text-text-weak pl-9 pr-10"
            size="large"
            onClick={(e: MouseEvent) => {
              props.loadMore()
              ;(e.currentTarget as HTMLButtonElement).blur()
            }}
          >
            {props.language.t("common.loadMore")}
          </Button>
        </div>
      </Show>
    </nav>
  )
}

export const WorkspaceItem = (props: {
  ctx: WorkspaceSidebarContext
  directory: string
  project: LocalProject

  mobile?: boolean
  popover?: boolean
  combined?: boolean
  closeProject?: () => void
}): JSX.Element => {
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams<{ grid?: string }>()
  const layout = useLayout()
  const globalSync = useGlobalSync()
  const language = useLanguage()
  const [workspaceStore, setWorkspaceStore] = globalSync.child(props.directory, { bootstrap: false })
  const [menu, setMenu] = createStore({
    open: false,
    pendingRename: false,
  })
  const slug = createMemo(() => base64Encode(props.directory))
  const sessions = createMemo(() => sortedRootSessions(workspaceStore))
  const children = createMemo(() => childMapByParent(workspaceStore.session))
  const local = createMemo(() => props.directory === props.project.worktree)
  const active = createMemo(() => props.ctx.currentDir() === props.directory)
  const workspaceValue = createMemo(() => {
    const branch = workspaceStore.vcs?.branch
    const name = branch ?? workspaceTitle(props.directory)
    return props.ctx.workspaceName(props.directory, props.project.id, branch) ?? name
  })
  const open = createMemo(() => props.ctx.workspaceExpanded(props.directory, local()))
  const boot = createMemo(() => open() || active())
  const booted = createMemo((prev) => prev || workspaceStore.status === "complete", false)
  const hasMore = createMemo(() => workspaceStore.sessionTotal > sessions().length)
  const busy = createMemo(() => props.ctx.isBusy(props.directory))
  const wasBusy = createMemo((prev) => prev || busy(), false)
  const loading = createMemo(() => open() && !booted() && props.ctx.isLoadingSessions(props.directory) && sessions().length === 0 && !wasBusy())
  const touch = createMediaQuery("(hover: none)")
  const showNew = createMemo(() => !loading() && (touch() || sessions().length === 0 || (active() && !params.id)))
  const loadMore = async () => {
    const prev = sessions().length
    setWorkspaceStore("limit", (limit) => (limit ?? 0) + ROOT_SESSION_PAGE_LIMIT)
    await globalSync.project.loadSessions(props.directory)
    const next = sessions().length
    if (next > prev) return
    setWorkspaceStore("sessionTotal", next)
  }

  const workspaceEditActive = createMemo(() => props.ctx.editorOpen(`workspace:${props.directory}`))
  const header = () => (
    <WorkspaceHeader
      local={local}
      busy={busy}
      open={open}
      directory={props.directory}
      combined={props.combined}
      language={language}
      branch={() => workspaceStore.vcs?.branch}
      workspaceValue={workspaceValue}
      workspaceEditActive={workspaceEditActive}
      InlineEditor={props.ctx.InlineEditor}
      renameWorkspace={props.ctx.renameWorkspace}
      setEditor={props.ctx.setEditor}
      projectId={props.project.id}
      project={props.project}
    />
  )

  const openWrapper = (value: boolean) => {
    props.ctx.setWorkspaceExpanded(props.directory, value)
    if (value) props.ctx.hydrateWorkspace(props.directory, "high")
    if (value) return
    if (props.ctx.editorOpen(`workspace:${props.directory}`)) props.ctx.closeEditor()
  }

  createEffect(() => {
    if (!boot()) return
    props.ctx.hydrateWorkspace(props.directory, active() ? "high" : "low")
  })

  return (
    <Collapsible variant="ghost" open={open()} class="shrink-0" onOpenChange={openWrapper}>
      <div class="py-1">
        <div
          class="group/workspace relative"
          classList={{}}
          data-component="workspace-item"
          data-workspace={base64Encode(props.directory)}
        >
          <div class="flex items-center gap-1">
            <Show
              when={workspaceEditActive()}
              fallback={
                <Collapsible.Trigger
                  class={`flex items-center justify-between w-full py-1.5 rounded-md hover:bg-surface-raised-base-hover transition-[padding] duration-200 ${
                    menu.open || props.combined ? "pr-16" : "pr-2"
                  } ${props.combined ? "pl-1" : "pl-2"} group-hover/workspace:pr-16 group-focus-within/workspace:pr-16`}
                  data-action="workspace-toggle"
                  data-workspace={base64Encode(props.directory)}
                >
                  {header()}
                </Collapsible.Trigger>
              }
            >
              <div
                class={`flex items-center justify-between w-full py-1.5 rounded-md transition-[padding] duration-200 ${
                  menu.open || props.combined ? "pr-16" : "pr-2"
                } ${props.combined ? "pl-1" : "pl-2"} group-hover/workspace:pr-16 group-focus-within/workspace:pr-16`}
              >
                {header()}
              </div>
            </Show>
            <WorkspaceActions
              directory={props.directory}
              local={local}
              busy={busy}
              menuOpen={() => menu.open}
              pendingRename={() => menu.pendingRename}
              setMenuOpen={(open) => setMenu("open", open)}
              setPendingRename={(value) => setMenu("pendingRename", value)}
              sidebarHovering={props.ctx.sidebarHovering}
              touch={touch}
              language={language}
              workspaceValue={workspaceValue}
              openEditor={props.ctx.openEditor}
              showResetWorkspaceDialog={props.ctx.showResetWorkspaceDialog}
              showDeleteWorkspaceDialog={props.ctx.showDeleteWorkspaceDialog}
              root={props.project.worktree}
              setHoverSession={props.ctx.setHoverSession}
              clearHoverProjectSoon={props.ctx.clearHoverProjectSoon}
              combined={props.combined}
              closeProject={props.closeProject}
              navigateToNewSession={() => {
                const mode = sessionMode(layout.sidebar)
                const value = sessionValue(mode, searchParams) ?? (params.dir === slug() ? params.id : undefined)
                if (mode && value !== undefined) {
                  navigate(`/${slug()}/session${sessionQuery(mode, `${value},`)}`)
                  return
                }
                navigate(`/${slug()}/session`)
              }}
            />
          </div>
        </div>
      </div>

      <Collapsible.Content>
        <div classList={{ "pl-6 pb-2 pr-2": !!props.combined }}>
          <WorkspaceSessionList
            directory={props.directory}
            slug={slug}
            mobile={props.mobile}
            popover={props.popover}
            ctx={props.ctx}
            showNew={showNew}
            loading={loading}
            sessions={sessions}
            children={children}
            hasMore={hasMore}
            loadMore={loadMore}
            language={language}
            combined={props.combined}
          />
        </div>
      </Collapsible.Content>
    </Collapsible>
  )
}
