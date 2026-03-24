import { For, Suspense, createEffect, createMemo, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useCommand } from "@/context/command"
import { CommentsProvider } from "@/context/comments"
import { FileProvider } from "@/context/file"
import { useLanguage } from "@/context/language"
import { LocalProvider } from "@/context/local"
import { PromptProvider } from "@/context/prompt"
import { TerminalProvider } from "@/context/terminal"
import { SessionParamsProvider } from "@/hooks/use-session-params"
import Session from "@/pages/session"
import { sessionQuery } from "@/utils/session-layout"

const MIN = 0.75
const MAX = 3.5
const STEP = 0.25

export function SessionStrip(props: { ids: string[] }) {
  const navigate = useNavigate()
  const params = useParams()
  const [, setSearchParams] = useSearchParams<{ strip?: string }>()
  const command = useCommand()
  const language = useLanguage()
  const [state, setState] = createStore({
    size: {} as Record<string, number>,
  })
  const refs = new Map<string, HTMLDivElement>()

  const ids = createMemo(() => props.ids)
  const active = createMemo(() => params.id ?? "")
  const activeIndex = createMemo(() => ids().findIndex((id) => id === active()))
  const query = createMemo(() => sessionQuery("niri", ids().join(",")))

  const size = (id: string) => Math.max(MIN, Math.min(MAX, state.size[id] ?? (id === active() ? 1.25 : 1)))

  const focus = (id: string, replace = false) => {
    const path = id ? `/${params.dir}/session/${id}${query()}` : `/${params.dir}/session${query()}`
    navigate(path, { replace })
  }

  const move = (step: number) => {
    const next = ids()[activeIndex() + step]
    if (!next) return
    focus(next)
  }

  const resize = (step: number) => {
    if (!params.id) return
    setState("size", params.id, Math.max(MIN, Math.min(MAX, size(params.id) + step)))
  }

  const close = (id: string) => {
    const next = ids().filter((item) => item !== id)
    if (next.length === 0) {
      setSearchParams({ strip: undefined })
      navigate(`/${params.dir}/session`)
      return
    }

    if (id !== active()) {
      setSearchParams({ strip: next.join(",") })
      return
    }

    const idx = ids().indexOf(id)
    const focusId = next[idx] ?? next[idx - 1]
    if (!focusId) {
      setSearchParams({ strip: undefined })
      navigate(`/${params.dir}/session`)
      return
    }

    navigate(`/${params.dir}/session/${focusId}${sessionQuery("niri", next.join(","))}`)
  }

  command.register("session.strip", () => [
    {
      id: "session.strip.focus.left",
      title: "Focus Left Chat",
      category: language.t("command.category.view"),
      keybind: "mod+shift+arrowleft",
      disabled: activeIndex() <= 0,
      onSelect: () => move(-1),
    },
    {
      id: "session.strip.focus.right",
      title: "Focus Right Chat",
      category: language.t("command.category.view"),
      keybind: "mod+shift+arrowright",
      disabled: activeIndex() === -1 || activeIndex() >= ids().length - 1,
      onSelect: () => move(1),
    },
    {
      id: "session.strip.grow",
      title: "Grow Focused Chat",
      category: language.t("command.category.view"),
      keybind: "mod+shift+plus",
      disabled: !params.id,
      onSelect: () => resize(STEP),
    },
    {
      id: "session.strip.shrink",
      title: "Shrink Focused Chat",
      category: language.t("command.category.view"),
      keybind: "mod+shift+minus",
      disabled: !params.id,
      onSelect: () => resize(-STEP),
    },
  ])

  createEffect(() => {
    const id = active() || ids()[0]
    if (!id) return
    refs.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  })

  return (
    <div class="relative size-full overflow-hidden bg-background-base">
      <div class="size-full overflow-x-auto overflow-y-hidden">
        <div
          class="grid h-full min-w-full gap-2 p-2"
          style={{
            "grid-template-columns": ids().map((id) => `minmax(28rem, ${size(id)}fr)`).join(" "),
            "grid-template-rows": "minmax(0, 1fr)",
          }}
        >
          <For each={ids()}>
            {(id) => (
              <div
                ref={(el) => refs.set(id, el)}
                classList={{
                  "group/strip relative min-h-0 min-w-0 overflow-hidden rounded-lg border shadow-sm transition-all": true,
                  "border-border-base hover:border-border-strong": id !== active(),
                  "ring-2 ring-blue-500 border-transparent": id === active(),
                }}
                onClick={() => {
                  if (id !== active()) focus(id)
                }}
              >
                <div class="absolute right-2 top-2 z-20 opacity-0 transition-opacity group-hover/strip:opacity-100 focus-within:opacity-100">
                  <IconButton
                    icon="close"
                    variant="ghost"
                    class="size-6 rounded-md bg-surface-base text-text-weak hover:bg-surface-raised-base hover:text-text-strong shadow-sm border border-border-base"
                    aria-label="Close session"
                    onClick={(e) => {
                      e.stopPropagation()
                      close(id)
                    }}
                  />
                </div>

                <SessionParamsProvider dir={params.dir} id={id || undefined}>
                  <LocalProvider>
                    <TerminalProvider>
                      <FileProvider>
                        <PromptProvider>
                          <CommentsProvider>
                            <Suspense fallback={<div class="size-full" />}>
                              <Session />
                            </Suspense>
                          </CommentsProvider>
                        </PromptProvider>
                      </FileProvider>
                    </TerminalProvider>
                  </LocalProvider>
                </SessionParamsProvider>
              </div>
            )}
          </For>
        </div>
      </div>
      <Show when={ids().length > 1}>
        <div class="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border-weak-base bg-background-base/90 px-3 py-1 text-11-medium text-text-weak shadow-sm backdrop-blur-sm">
          Cmd+Shift+Left/Right focuses, Cmd+Shift+Plus/Minus resizes.
        </div>
      </Show>
    </div>
  )
}
