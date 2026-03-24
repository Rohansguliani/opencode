import { Context } from "../util/context"

const ctx = Context.create<{ id: string }>("actor")

export const ActorContext = {
  provide<R>(input: { id: string; fn: () => R }) {
    return ctx.provide({ id: input.id }, input.fn)
  },

  get id() {
    try {
      return ctx.use().id
    } catch {
      return "local"
    }
  },
}
