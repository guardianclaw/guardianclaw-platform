package dev.guardianclaw.jetbrains.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe

/**
 * Application-level settings for GuardianClaw AI Safety plugin.
 * Persisted across all projects.
 */
@State(
    name = "GuardianClawApplicationSettings",
    storages = [Storage("GuardianClawAISafety.xml")]
)
@Service(Service.Level.APP)
class GuardianClawApplicationSettings : PersistentStateComponent<GuardianClawApplicationSettings> {

    // LLM Provider settings
    var llmProvider: String = "openai"
    var openaiModel: String = "gpt-4o-mini"
    var anthropicModel: String = "claude-3-haiku-20240307"

    // Ollama settings (local, free)
    var ollamaEndpoint: String = "http://localhost:11434"
    var ollamaModel: String = "llama3.2"

    // OpenAI-compatible settings (Groq, Together AI, etc.)
    var openaiCompatibleEndpoint: String = ""
    var openaiCompatibleModel: String = "llama-3.3-70b-versatile"

    // Behavior settings
    var enableRealTimeLinting: Boolean = true
    var highlightUnsafePatterns: Boolean = true
    var defaultSeedVariant: String = "standard"
    var showStatusBarWidget: Boolean = true

    // API settings
    var useGuardianClawApi: Boolean = false
    var clawApiEndpoint: String = "https://api.guardianclaw.dev/api/v1/guard"

    companion object {
        private const val OPENAI_KEY_ID = "claw.openai.apikey"
        private const val ANTHROPIC_KEY_ID = "claw.anthropic.apikey"
        private const val COMPATIBLE_KEY_ID = "claw.compatible.apikey"

        fun getInstance(): GuardianClawApplicationSettings =
            ApplicationManager.getApplication().getService(GuardianClawApplicationSettings::class.java)
    }

    override fun getState(): GuardianClawApplicationSettings = this

    override fun loadState(state: GuardianClawApplicationSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }

    // Secure storage for API keys using PasswordSafe
    var openaiApiKey: String
        get() = getSecureKey(OPENAI_KEY_ID) ?: ""
        set(value) = setSecureKey(OPENAI_KEY_ID, value)

    var anthropicApiKey: String
        get() = getSecureKey(ANTHROPIC_KEY_ID) ?: ""
        set(value) = setSecureKey(ANTHROPIC_KEY_ID, value)

    var openaiCompatibleApiKey: String
        get() = getSecureKey(COMPATIBLE_KEY_ID) ?: ""
        set(value) = setSecureKey(COMPATIBLE_KEY_ID, value)

    private fun createCredentialAttributes(key: String): CredentialAttributes {
        // Use single-parameter constructor for compatibility across all IntelliJ versions
        // Note: This generates a deprecated API warning in plugin verifier for 2024.3+
        // but is required for compatibility with 2024.1-2024.2
        return CredentialAttributes(generateServiceName("GuardianClawAISafety", key))
    }

    private fun getSecureKey(key: String): String? {
        val attributes = createCredentialAttributes(key)
        return PasswordSafe.instance.getPassword(attributes)
    }

    private fun setSecureKey(key: String, value: String) {
        val attributes = createCredentialAttributes(key)
        if (value.isBlank()) {
            PasswordSafe.instance.set(attributes, null)
        } else {
            PasswordSafe.instance.set(attributes, Credentials("", value))
        }
    }
}
