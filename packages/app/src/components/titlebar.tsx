import { createEffect, createMemo, For, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useLocation, useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Icon } from "@opencode-ai/ui/icon"
import { Button } from "@opencode-ai/ui/button"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { useTheme } from "@opencode-ai/ui/theme"

import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { decode64 } from "@/utils/base64"
import { type SessionMode, sessionMode, sessionValue } from "@/utils/session-layout"
import { applyPath, backPath, forwardPath } from "./titlebar-history"

type TauriDesktopWindow = {
  startDragging?: () => Promise<void>
  toggleMaximize?: () => Promise<void>
}

type TauriThemeWindow = {
  setTheme?: (theme?: "light" | "dark" | null) => Promise<void>
}

type TauriApi = {
  window?: {
    getCurrentWindow?: () => TauriDesktopWindow
  }
  webviewWindow?: {
    getCurrentWebviewWindow?: () => TauriThemeWindow
  }
}

const tauriApi = () => (window as unknown as { __TAURI__?: TauriApi }).__TAURI__
const currentDesktopWindow = () => tauriApi()?.window?.getCurrentWindow?.()
const currentThemeWindow = () => tauriApi()?.webviewWindow?.getCurrentWebviewWindow?.()

function ModeToggle(props: { active: boolean; label: string; toggle: () => void }) {
  const lines = () => props.label.split(" ")
  return (
    <Tooltip placement="bottom" value={props.label} openDelay={2000}>
      <button
        type="button"
        class="hidden xl:flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-base-hover focus:outline-none focus-visible:bg-surface-base-hover"
        onClick={props.toggle}
        aria-pressed={props.active}
        aria-label={`Toggle ${props.label}`}
      >
        <div class="flex flex-col items-start justify-center gap-px pt-px pb-0.5 leading-none">
          <For each={lines()}>{(line) => <span class="text-[11px] font-medium leading-none text-text-strong">{line}</span>}</For>
        </div>
        <span
          class={`relative flex h-6 w-11 items-center rounded-full border transition-all ${props.active ? "border-transparent bg-surface-brand-base" : "border-border-weak-base bg-surface-raised-base"}`}
        >
          <span
            class={`absolute size-4 rounded-full bg-background-base shadow-xs transition-transform ${props.active ? "translate-x-[22px]" : "translate-x-[3px]"}`}
          />
        </span>
      </button>
    </Tooltip>
  )
}

export function Titlebar() {
  const layout = useLayout()
  const platform = usePlatform()
  const command = useCommand()
  const language = useLanguage()
  const theme = useTheme()
  const sync = useGlobalSync()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams<{ grid?: string; strip?: string }>()
  const location = useLocation()
  const params = useParams()

  const mac = createMemo(() => platform.platform === "desktop" && platform.os === "macos")
  const windows = createMemo(() => platform.platform === "desktop" && platform.os === "windows")
  const zoom = () => platform.webviewZoom?.() ?? 1
  const minHeight = () => (mac() ? `${40 / zoom()}px` : undefined)

  const [history, setHistory] = createStore({
    stack: [] as string[],
    index: 0,
    action: undefined as "back" | "forward" | undefined,
  })

  const path = () => `${location.pathname}${location.search}${location.hash}`
  const mode = createMemo(() => sessionMode(layout.sidebar))
  const dir = createMemo(() => decode64(params.dir) ?? "")
  const store = createMemo(() => {
    if (!dir()) return
    return sync.child(dir(), { bootstrap: false })[0]
  })
  const strip = createMemo(() => {
    const ids = store()
      ? sortedRootSessions(store()!, Date.now()).map((item) => item.id)
      : []
    if (params.id && !ids.includes(params.id)) ids.unshift(params.id)
    return [...new Set(ids)]
  })
  const creating = createMemo(() => {
    if (!params.dir) return false
    if (params.id) return false
    const parts = location.pathname.replace(/\/+$/, "").split("/")
    return parts.at(-1) === "session"
  })

  createEffect(() => {
    const current = path()

    untrack(() => {
      const next = applyPath(history, current)
      if (next === history) return
      setHistory(next)
    })
  })

  const canBack = createMemo(() => history.index > 0)
  const canForward = createMemo(() => history.index < history.stack.length - 1)

  const back = () => {
    const next = backPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  const forward = () => {
    const next = forwardPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  const toggleMode = (next: SessionMode) => {
    const prev = mode()
    if (prev === next) {
      layout.sidebar.setMode(undefined)
      if (searchParams.grid || searchParams.strip) setSearchParams({ grid: undefined, strip: undefined })
      return
    }

    layout.sidebar.setMode(next)
    if (next === "niri") {
      const ids = strip()
      const id = params.id ?? ids[0]
      if (!params.dir || !id || ids.length === 0) {
        setSearchParams({ grid: undefined, strip: id })
        return
      }
      navigate(`/${params.dir}/session/${id}?strip=${ids.join(",")}`)
      return
    }

    const value = sessionValue(prev, searchParams) ?? params.id
    if (next === "grid") {
      setSearchParams({ grid: value, strip: undefined })
      return
    }
    setSearchParams({ grid: undefined, strip: value })
  }

  command.register(() => [
    {
      id: "common.goBack",
      title: language.t("common.goBack"),
      category: language.t("command.category.view"),
      keybind: "mod+[",
      onSelect: back,
    },
    {
      id: "common.goForward",
      title: language.t("common.goForward"),
      category: language.t("command.category.view"),
      keybind: "mod+]",
      onSelect: forward,
    },
  ])

  const getWin = () => {
    if (platform.platform !== "desktop") return
    return currentDesktopWindow()
  }

  createEffect(() => {
    if (platform.platform !== "desktop") return

    const scheme = theme.colorScheme()
    const value = scheme === "system" ? null : scheme

    const win = currentThemeWindow()
    if (!win?.setTheme) return

    void win.setTheme(value).catch(() => undefined)
  })

  const interactive = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false

    const selector =
      "button, a, input, textarea, select, option, [role='button'], [role='menuitem'], [contenteditable='true'], [contenteditable='']"

    return !!target.closest(selector)
  }

  const drag = (e: MouseEvent) => {
    if (platform.platform !== "desktop") return
    if (e.buttons !== 1) return
    if (interactive(e.target)) return

    const win = getWin()
    if (!win?.startDragging) return

    e.preventDefault()
    void win.startDragging().catch(() => undefined)
  }

  const maximize = (e: MouseEvent) => {
    if (platform.platform !== "desktop") return
    if (interactive(e.target)) return
    if (e.target instanceof Element && e.target.closest("[data-tauri-decorum-tb]")) return

    const win = getWin()
    if (!win?.toggleMaximize) return

    e.preventDefault()
    void win.toggleMaximize().catch(() => undefined)
  }

  return (
    <header
      class="h-10 shrink-0 bg-background-base relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
      style={{ "min-height": minHeight() }}
      data-tauri-drag-region
      onMouseDown={drag}
      onDblClick={maximize}
    >
      <div
        classList={{
          "flex items-center min-w-0": true,
          "pl-2": !mac(),
        }}
      >
        <Show when={mac()}>
          <div class="h-full shrink-0" style={{ width: `${72 / zoom()}px` }} />
          <div class="xl:hidden w-10 shrink-0 flex items-center justify-center">
            <IconButton
              icon="menu"
              variant="ghost"
              class="titlebar-icon rounded-md"
              onClick={layout.mobileSidebar.toggle}
              aria-label={language.t("sidebar.menu.toggle")}
              aria-expanded={layout.mobileSidebar.opened()}
            />
          </div>
        </Show>
        <Show when={!mac()}>
          <div class="xl:hidden w-[48px] shrink-0 flex items-center justify-center">
            <IconButton
              icon="menu"
              variant="ghost"
              class="titlebar-icon rounded-md"
              onClick={layout.mobileSidebar.toggle}
              aria-label={language.t("sidebar.menu.toggle")}
              aria-expanded={layout.mobileSidebar.opened()}
            />
          </div>
        </Show>
        <div class="flex items-center gap-1 shrink-0">
          <div class="hidden xl:flex w-12 shrink-0 justify-center">
            <TooltipKeybind
              class="shrink-0"
              placement="bottom"
              title={language.t("command.sidebar.toggle")}
              keybind={command.keybind("sidebar.toggle")}
            >
              <Button
                variant="ghost"
                class="group/sidebar-toggle titlebar-icon w-8 h-6 p-0 box-border"
                onClick={layout.sidebar.toggle}
                aria-label={language.t("command.sidebar.toggle")}
                aria-expanded={layout.sidebar.opened()}
              >
                <Icon size="small" name={layout.sidebar.opened() ? "sidebar-active" : "sidebar"} />
              </Button>
            </TooltipKeybind>
          </div>
          <div class="hidden xl:flex items-center gap-0 shrink-0">
            <Tooltip placement="bottom" value={language.t("common.goBack")} openDelay={2000}>
              <Button
                variant="ghost"
                icon="chevron-left"
                class="titlebar-icon w-6 h-6 p-0 box-border"
                disabled={!canBack()}
                onClick={back}
                aria-label={language.t("common.goBack")}
              />
            </Tooltip>
            <Tooltip placement="bottom" value={language.t("common.goForward")} openDelay={2000}>
              <Button
                variant="ghost"
                icon="chevron-right"
                class="titlebar-icon w-6 h-6 p-0 box-border"
                disabled={!canForward()}
                onClick={forward}
                aria-label={language.t("common.goForward")}
              />
            </Tooltip>
          </div>
          <ModeToggle active={layout.sidebar.gridMode()} label="Grid Mode" toggle={() => toggleMode("grid")} />
          <ModeToggle active={layout.sidebar.niriMode()} label="Niri Mode" toggle={() => toggleMode("niri")} />
          <ModeToggle active={layout.sidebar.combinedMode()} label="Combined View" toggle={layout.sidebar.toggleCombinedMode} />
          <Show when={params.dir}>
            <TooltipKeybind
              class="hidden xl:flex shrink-0"
              placement="bottom"
              title={language.t("command.session.new")}
              keybind={command.keybind("session.new")}
              openDelay={2000}
            >
              <Button
                variant="ghost"
                icon={creating() ? "new-session-active" : "new-session"}
                class="titlebar-icon w-8 h-6 p-0 box-border"
                onClick={() => {
                  if (!params.dir) return
                  const value = sessionValue(mode(), searchParams) ?? params.id
                  if (value) {
                    const key = layout.sidebar.gridMode() ? "grid" : "strip"
                    navigate(`/${params.dir}/session?${key}=${value},`)
                    return
                  }
                  navigate(`/${params.dir}/session`)
                }}
                aria-label={language.t("command.session.new")}
                aria-current={creating() ? "page" : undefined}
              />
            </TooltipKeybind>
          </Show>
        </div>
        <div id="opencode-titlebar-left" class="flex items-center gap-3 min-w-0 px-2" />
      </div>

      <div class="min-w-0 flex items-center justify-center pointer-events-none">
        <div id="opencode-titlebar-center" class="pointer-events-auto flex items-center gap-2 min-w-0 flex justify-center w-fit max-w-full" />
      </div>

      <div
        classList={{
          "flex items-center min-w-0 justify-end": true,
          "pr-2": !windows(),
        }}
        data-tauri-drag-region
        onMouseDown={drag}
      >
        <div id="opencode-titlebar-right" class="flex items-center gap-1 shrink-0 justify-end" />
        <Show when={windows()}>
          {!tauriApi() && <div class="w-36 shrink-0" />}
          <div data-tauri-decorum-tb class="flex flex-row" />
        </Show>
      </div>
    </header>
  )
}
