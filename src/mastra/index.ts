// Mastra runtime instance. Retrieve the agent via
// mastra.getAgent("workspaceSupervisor").

import { Mastra } from "@mastra/core/mastra";
import { supervisorAgent } from "./agents/supervisor-agent";
import { askWorkspaceKnowledge } from "./tools/knowledge-tools";
import { saveMemory, recallMemory } from "./tools/memory-tools";

export const mastra = new Mastra({
  agents: { workspaceSupervisor: supervisorAgent },
  tools: { askWorkspaceKnowledge, saveMemory, recallMemory },
});

export { supervisorAgent };
