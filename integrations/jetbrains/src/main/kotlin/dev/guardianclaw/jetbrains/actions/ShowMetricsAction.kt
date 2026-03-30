package dev.guardianclaw.jetbrains.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import dev.guardianclaw.jetbrains.services.MetricsService
import dev.guardianclaw.jetbrains.ui.GuardianClawToolWindowFactory

/**
 * Action to display the GuardianClaw metrics dashboard.
 *
 * Shows statistics about:
 * - Total analyses performed
 * - Safe/unsafe rate
 * - CLAW gate failure statistics
 * - Analysis methods (semantic vs heuristic)
 * - Provider usage
 */
class ShowMetricsAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val service = MetricsService.getInstance()
        val dashboard = service.getFormattedDashboard()

        GuardianClawToolWindowFactory.showMessage(project, dashboard)
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}
