package dev.guardianclaw.jetbrains.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.util.Consumer
import dev.guardianclaw.jetbrains.services.GuardianClawService
import dev.guardianclaw.jetbrains.settings.GuardianClawApplicationSettings
import java.awt.Component
import java.awt.event.MouseEvent

/**
 * Factory for the GuardianClaw status bar widget
 */
class GuardianClawStatusWidgetFactory : StatusBarWidgetFactory {

    override fun getId(): String = "GuardianClawStatusWidget"

    override fun getDisplayName(): String = "GuardianClaw AI Safety"

    override fun isAvailable(project: Project): Boolean =
        GuardianClawApplicationSettings.getInstance().showStatusBarWidget

    override fun createWidget(project: Project): StatusBarWidget =
        GuardianClawStatusWidget(project)

    override fun disposeWidget(widget: StatusBarWidget) {
        Disposer.dispose(widget)
    }

    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true
}

/**
 * Status bar widget showing GuardianClaw status
 */
class GuardianClawStatusWidget(private val project: Project) : StatusBarWidget, StatusBarWidget.TextPresentation {

    override fun ID(): String = "GuardianClawStatusWidget"

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun install(statusBar: StatusBar) {}

    override fun dispose() {}

    override fun getText(): String {
        val service = GuardianClawService.getInstance()
        return if (service.isSemanticAvailable()) {
            val (provider, _) = service.getProviderInfo()
            "🛡️ GuardianClaw: $provider"
        } else {
            "🛡️ GuardianClaw: Heuristic"
        }
    }

    override fun getTooltipText(): String {
        val service = GuardianClawService.getInstance()
        return if (service.isSemanticAvailable()) {
            val (_, model) = service.getProviderInfo()
            "Semantic analysis enabled ($model)"
        } else {
            "Heuristic mode (configure API key for semantic analysis)"
        }
    }

    override fun getAlignment(): Float = Component.CENTER_ALIGNMENT

    override fun getClickConsumer(): Consumer<MouseEvent>? = Consumer {
        // Open settings on click
        com.intellij.openapi.options.ShowSettingsUtil.getInstance()
            .showSettingsDialog(project, "GuardianClaw AI Safety")
    }
}
