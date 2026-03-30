package dev.guardianclaw.jetbrains.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages
import dev.guardianclaw.jetbrains.services.GuardianClawService

/**
 * Action to show current GuardianClaw analysis status
 */
class ShowStatusAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = GuardianClawService.getInstance()

        val (provider, model) = service.getProviderInfo()
        val message = if (service.isSemanticAvailable()) {
            """
            GuardianClaw is using semantic analysis.

            Provider: $provider
            Model: $model
            Mode: Comprehensive (LLM-powered)
            """.trimIndent()
        } else {
            """
            GuardianClaw is using heuristic analysis (pattern matching).

            Mode: Basic (pattern-based, limited coverage)

            To enable semantic analysis:
            • Go to Settings → Tools → GuardianClaw AI Safety
            • Configure your OpenAI, Anthropic, or Ollama
            """.trimIndent()
        }

        Messages.showInfoMessage(project, message, "GuardianClaw Status")
    }
}
