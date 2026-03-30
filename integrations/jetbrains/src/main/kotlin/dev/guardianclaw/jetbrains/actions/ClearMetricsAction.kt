package dev.guardianclaw.jetbrains.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages
import dev.guardianclaw.jetbrains.services.MetricsService
import dev.guardianclaw.jetbrains.ui.GuardianClawToolWindowFactory

/**
 * Action to clear all stored GuardianClaw metrics.
 *
 * Shows a confirmation dialog before clearing.
 */
class ClearMetricsAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val service = MetricsService.getInstance()
        val count = service.getMetricsCount()

        if (count == 0) {
            GuardianClawToolWindowFactory.showMessage(
                project,
                "No metrics to clear.\n\nStart using GuardianClaw to track your analysis metrics."
            )
            return
        }

        // Show confirmation dialog
        val result = Messages.showYesNoDialog(
            project,
            "Are you sure you want to clear all $count stored metrics?\n\nThis action cannot be undone.",
            "Clear GuardianClaw Metrics",
            Messages.getWarningIcon()
        )

        if (result == Messages.YES) {
            service.clearMetrics()
            GuardianClawToolWindowFactory.showMessage(
                project,
                "✅ Metrics cleared\n\n$count metric entries have been removed."
            )
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}
