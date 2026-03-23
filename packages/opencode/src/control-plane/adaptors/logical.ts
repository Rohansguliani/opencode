import type { Adaptor } from "../types"

export const LogicalAdaptor: Adaptor = {
  async configure(input) {
    return {
      id: input.id,
      projectID: input.projectID,
      type: "logical",
      branch: input.branch ?? null,
      name: input.name ?? null,
      directory: input.directory ?? null,
      extra: input.extra ?? null,
    }
  },
  async create(config) {
    // No op for logical workspace creation
  },
  async remove(config) {
    // No op
  },
  async fetch(config, input, init) {
    throw new Error("Logical workspaces do not support proxying fetch requests");
  }
}
