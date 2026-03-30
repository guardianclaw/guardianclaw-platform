package dev.guardianclaw.jetbrains.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import dev.guardianclaw.jetbrains.compliance.CompliancePatterns.Severity
import dev.guardianclaw.jetbrains.services.ComplianceService
import dev.guardianclaw.jetbrains.services.MetricsService
import dev.guardianclaw.jetbrains.ui.GuardianClawToolWindowFactory

/**
 * Action to check content against EU AI Act requirements.
 *
 * Detects:
 * - Article 5: Prohibited practices (social scoring, biometrics, etc.)
 * - Article 6/Annex III: High-risk system contexts
 * - Article 52: Transparency obligations
 */
class CheckEUAIActAction : AnAction() {

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
            GuardianClawToolWindowFactory.showMessage(project, "No content to check", isError = true)
            return
        }

        val service = ComplianceService.getInstance()
        val result = service.checkEUAIAct(text)

        // Record metrics
        MetricsService.getInstance().recordComplianceCheck(
            framework = "EU_AI_Act",
            compliant = result.compliant,
            findingsCount = result.findings.size
        )

        val sb = StringBuilder()

        if (result.compliant && result.findings.isEmpty()) {
            sb.appendLine("✅ EU AI Act - COMPLIANT")
            sb.appendLine()
            sb.appendLine("Risk Level: ${result.riskLevel}")
            sb.appendLine("No compliance issues detected.")
        } else {
            val icon = if (result.compliant) "⚠️" else "🚫"
            sb.appendLine("$icon EU AI Act - ${if (result.compliant) "WARNING" else "NON-COMPLIANT"}")
            sb.appendLine()
            sb.appendLine("Risk Level: ${result.riskLevel.uppercase()}")
            sb.appendLine("Findings: ${result.findings.size}")
            sb.appendLine()

            // Group by article
            val byArticle = result.findings.groupBy { it.category }

            for ((category, findings) in byArticle) {
                val isProhibited = category.startsWith("Article 5")
                val headerIcon = if (isProhibited) "🚫" else "⚠️"
                sb.appendLine("━━━ $headerIcon $category ━━━")

                for (finding in findings.take(3)) {
                    val severityIcon = when (finding.severity) {
                        Severity.CRITICAL -> "🔴"
                        Severity.HIGH -> "🟠"
                        Severity.MEDIUM -> "🟡"
                        else -> "🟢"
                    }
                    sb.appendLine("$severityIcon ${finding.description}")
                    sb.appendLine("   Found: \"${truncate(finding.matchedText, 40)}\"")
                }
                if (findings.size > 3) {
                    sb.appendLine("   ... and ${findings.size - 3} more")
                }
                sb.appendLine()
            }

            if (result.recommendations.isNotEmpty()) {
                sb.appendLine("━━━ Required Actions ━━━")
                for (rec in result.recommendations) {
                    sb.appendLine("• $rec")
                }
            }

            if (result.riskLevel == "unacceptable") {
                sb.appendLine()
                sb.appendLine("⛔ PROHIBITED: This practice cannot be deployed in the EU.")
            }
        }

        GuardianClawToolWindowFactory.showMessage(project, sb.toString(), isError = !result.compliant)
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
