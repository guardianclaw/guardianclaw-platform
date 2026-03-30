package dev.guardianclaw.jetbrains.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import dev.guardianclaw.jetbrains.services.MetricsService
import dev.guardianclaw.jetbrains.services.SecurityService
import dev.guardianclaw.jetbrains.ui.GuardianClawToolWindowFactory
import dev.guardianclaw.jetbrains.util.SecurityPatterns.Severity

/**
 * Action to validate LLM output for security issues.
 * Checks for sensitive data exposure, injection payloads, and unsafe content.
 */
class ValidateOutputAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val project = e.project ?: return

        // Get text (selection or full file)
        val selectedText = editor.selectionModel.selectedText
        val text = if (selectedText.isNullOrBlank()) {
            editor.document.text
        } else {
            selectedText
        }

        if (text.isBlank()) {
            GuardianClawToolWindowFactory.showMessage(project, "No content to validate", isError = true)
            return
        }

        val service = SecurityService.getInstance()
        val result = service.validateOutput(text)

        // Record metrics
        MetricsService.getInstance().recordSecurityScan(
            scanType = "output_validation",
            issuesFound = result.findings.size,
            safe = !result.hasIssues
        )

        if (result.hasIssues) {
            val sb = StringBuilder()
            sb.appendLine("⚠️ OUTPUT VALIDATION ISSUES")
            sb.appendLine()
            sb.appendLine("Severity: ${result.severity}")
            sb.appendLine()
            sb.appendLine("Findings:")

            // Group by severity
            val critical = result.findings.filter { it.severity == Severity.CRITICAL }
            val high = result.findings.filter { it.severity == Severity.HIGH }
            val other = result.findings.filter { it.severity !in listOf(Severity.CRITICAL, Severity.HIGH) }

            if (critical.isNotEmpty()) {
                sb.appendLine()
                sb.appendLine("🔴 CRITICAL:")
                for (finding in critical) {
                    sb.appendLine("  • ${finding.description}")
                    sb.appendLine("    Found: ${truncate(finding.matchedText, 40)}")
                }
            }

            if (high.isNotEmpty()) {
                sb.appendLine()
                sb.appendLine("🟠 HIGH:")
                for (finding in high) {
                    sb.appendLine("  • ${finding.description}")
                    sb.appendLine("    Found: ${truncate(finding.matchedText, 40)}")
                }
            }

            if (other.isNotEmpty()) {
                sb.appendLine()
                sb.appendLine("🟡 OTHER:")
                for (finding in other.take(5)) {
                    sb.appendLine("  • ${finding.description}")
                }
                if (other.size > 5) {
                    sb.appendLine("  ... and ${other.size - 5} more")
                }
            }

            sb.appendLine()
            sb.appendLine("🔍 Review output before displaying to users.")

            GuardianClawToolWindowFactory.showMessage(project, sb.toString(), isError = true)
        } else {
            GuardianClawToolWindowFactory.showMessage(
                project,
                "✅ Output validated\n\nNo security issues detected in LLM output."
            )
        }
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = editor != null
    }

    private fun truncate(text: String, maxLength: Int): String {
        return if (text.length > maxLength) {
            text.take(maxLength) + "..."
        } else {
            text
        }
    }
}
