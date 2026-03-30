package dev.guardianclaw.jetbrains.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.project.Project
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * Project-level settings for GuardianClaw AI Safety plugin.
 * Allows per-project configuration overrides.
 */
@State(
    name = "GuardianClawProjectSettings",
    storages = [Storage("claw.xml")]
)
@Service(Service.Level.PROJECT)
class GuardianClawProjectSettings : PersistentStateComponent<GuardianClawProjectSettings> {

    // Project-specific overrides
    var overrideApplicationSettings: Boolean = false
    var enableAnalysis: Boolean = true

    // File patterns to analyze
    var includePatterns: String = "*.md,*.txt,*.py,*.js,*.ts,*.json,*.yaml,*.yml"
    var excludePatterns: String = "node_modules/**,*.min.js,dist/**,build/**"

    // Custom rules
    var customBlockedPatterns: String = ""
    var customAllowedPatterns: String = ""

    companion object {
        fun getInstance(project: Project): GuardianClawProjectSettings =
            project.getService(GuardianClawProjectSettings::class.java)
    }

    override fun getState(): GuardianClawProjectSettings = this

    override fun loadState(state: GuardianClawProjectSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }
}
