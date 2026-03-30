package dev.guardianclaw.jetbrains.services

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.diagnostic.Logger
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * Represents a single analysis metric entry.
 */
data class AnalysisMetric(
    var timestamp: Long = 0,
    var method: String = "heuristic", // "semantic" or "heuristic"
    var safe: Boolean = true,
    var truthPassed: Boolean = true,
    var harmPassed: Boolean = true,
    var scopePassed: Boolean = true,
    var purposePassed: Boolean = true,
    var issueCount: Int = 0,
    var provider: String? = null,
    var analysisType: String = "claw" // "claw", "security", "compliance"
)

/**
 * Summary of all tracked metrics.
 */
data class MetricsSummary(
    val totalAnalyses: Int,
    val safeCount: Int,
    val unsafeCount: Int,
    val semanticCount: Int,
    val heuristicCount: Int,
    val gateFailures: Map<String, Int>,
    val issuesDetected: Int,
    val lastAnalysis: Long?,
    val firstAnalysis: Long?,
    val providerUsage: Map<String, Int>,
    val analysisByType: Map<String, Int>
)

/**
 * Persistent state class for metrics storage.
 */
class MetricsState {
    var metrics: MutableList<AnalysisMetric> = mutableListOf()
}

/**
 * Service for tracking analysis metrics over time.
 *
 * Persists metrics locally and provides summary statistics.
 */
@Service(Service.Level.APP)
@State(
    name = "GuardianClawMetrics",
    storages = [Storage("claw-metrics.xml")]
)
class MetricsService : PersistentStateComponent<MetricsState> {
    private val logger = Logger.getInstance(MetricsService::class.java)
    private var state = MetricsState()

    companion object {
        private const val MAX_METRICS_STORED = 1000

        fun getInstance(): MetricsService =
            ApplicationManager.getApplication().getService(MetricsService::class.java)
    }

    override fun getState(): MetricsState = state

    override fun loadState(state: MetricsState) {
        XmlSerializerUtil.copyBean(state, this.state)
    }

    // =========================================================================
    // RECORDING METRICS
    // =========================================================================

    /**
     * Records a CLAW analysis result.
     */
    fun recordAnalysis(
        method: String,
        safe: Boolean,
        gates: Map<String, Boolean>,
        issueCount: Int,
        provider: String? = null
    ) {
        val metric = AnalysisMetric(
            timestamp = System.currentTimeMillis(),
            method = method,
            safe = safe,
            truthPassed = gates["credibility"] ?: true,
            harmPassed = gates["avoidance"] ?: true,
            scopePassed = gates["limits"] ?: true,
            purposePassed = gates["worth"] ?: true,
            issueCount = issueCount,
            provider = provider,
            analysisType = "claw"
        )

        addMetric(metric)
    }

    /**
     * Records a security scan result.
     */
    fun recordSecurityScan(
        scanType: String,
        issuesFound: Int,
        safe: Boolean
    ) {
        val metric = AnalysisMetric(
            timestamp = System.currentTimeMillis(),
            method = "heuristic",
            safe = safe,
            issueCount = issuesFound,
            analysisType = "security:$scanType"
        )

        addMetric(metric)
    }

    /**
     * Records a compliance check result.
     */
    fun recordComplianceCheck(
        framework: String,
        compliant: Boolean,
        findingsCount: Int
    ) {
        val metric = AnalysisMetric(
            timestamp = System.currentTimeMillis(),
            method = "heuristic",
            safe = compliant,
            issueCount = findingsCount,
            analysisType = "compliance:$framework"
        )

        addMetric(metric)
    }

    private fun addMetric(metric: AnalysisMetric) {
        state.metrics.add(metric)

        // Keep only the most recent metrics
        if (state.metrics.size > MAX_METRICS_STORED) {
            state.metrics = state.metrics.takeLast(MAX_METRICS_STORED).toMutableList()
        }
    }

    // =========================================================================
    // QUERYING METRICS
    // =========================================================================

    /**
     * Gets a summary of all tracked metrics.
     */
    fun getSummary(): MetricsSummary {
        val metrics = state.metrics

        if (metrics.isEmpty()) {
            return MetricsSummary(
                totalAnalyses = 0,
                safeCount = 0,
                unsafeCount = 0,
                semanticCount = 0,
                heuristicCount = 0,
                gateFailures = mapOf("credibility" to 0, "avoidance" to 0, "limits" to 0, "worth" to 0),
                issuesDetected = 0,
                lastAnalysis = null,
                firstAnalysis = null,
                providerUsage = emptyMap(),
                analysisByType = emptyMap()
            )
        }

        val gateFailures = mutableMapOf(
            "credibility" to 0,
            "avoidance" to 0,
            "limits" to 0,
            "worth" to 0
        )

        val providerUsage = mutableMapOf<String, Int>()
        val analysisByType = mutableMapOf<String, Int>()

        var safeCount = 0
        var unsafeCount = 0
        var semanticCount = 0
        var heuristicCount = 0
        var totalIssues = 0

        for (metric in metrics) {
            // Safe/Unsafe count
            if (metric.safe) safeCount++ else unsafeCount++

            // Method count
            if (metric.method == "semantic") semanticCount++ else heuristicCount++

            // Gate failures (only for CLAW analyses)
            if (metric.analysisType == "claw") {
                if (!metric.truthPassed) gateFailures["credibility"] = gateFailures["credibility"]!! + 1
                if (!metric.harmPassed) gateFailures["avoidance"] = gateFailures["avoidance"]!! + 1
                if (!metric.scopePassed) gateFailures["limits"] = gateFailures["limits"]!! + 1
                if (!metric.purposePassed) gateFailures["worth"] = gateFailures["worth"]!! + 1
            }

            // Issues count
            totalIssues += metric.issueCount

            // Provider usage
            metric.provider?.let {
                providerUsage[it] = (providerUsage[it] ?: 0) + 1
            }

            // Analysis type
            analysisByType[metric.analysisType] = (analysisByType[metric.analysisType] ?: 0) + 1
        }

        return MetricsSummary(
            totalAnalyses = metrics.size,
            safeCount = safeCount,
            unsafeCount = unsafeCount,
            semanticCount = semanticCount,
            heuristicCount = heuristicCount,
            gateFailures = gateFailures,
            issuesDetected = totalIssues,
            lastAnalysis = metrics.lastOrNull()?.timestamp,
            firstAnalysis = metrics.firstOrNull()?.timestamp,
            providerUsage = providerUsage,
            analysisByType = analysisByType
        )
    }

    /**
     * Gets the most recent metrics.
     */
    fun getRecentMetrics(count: Int = 10): List<AnalysisMetric> {
        return state.metrics.takeLast(count)
    }

    /**
     * Gets the total number of stored metrics.
     */
    fun getMetricsCount(): Int = state.metrics.size

    /**
     * Clears all stored metrics.
     */
    fun clearMetrics() {
        state.metrics.clear()
    }

    // =========================================================================
    // FORMATTED OUTPUT
    // =========================================================================

    /**
     * Gets a formatted dashboard string for display.
     */
    fun getFormattedDashboard(): String {
        val summary = getSummary()
        val sb = StringBuilder()

        sb.appendLine("━━━━━━━ GCLAW METRICS DASHBOARD ━━━━━━━")
        sb.appendLine()

        // Overview
        sb.appendLine("📊 OVERVIEW")
        sb.appendLine("   Total Analyses: ${summary.totalAnalyses}")

        if (summary.totalAnalyses > 0) {
            val safeRate = (summary.safeCount * 100.0 / summary.totalAnalyses).toInt()
            sb.appendLine("   Safe Rate: $safeRate% (${summary.safeCount}/${summary.totalAnalyses})")
            sb.appendLine("   Issues Detected: ${summary.issuesDetected}")
        }
        sb.appendLine()

        // Analysis Methods
        if (summary.totalAnalyses > 0) {
            sb.appendLine("🔬 ANALYSIS METHODS")
            sb.appendLine("   Semantic: ${summary.semanticCount}")
            sb.appendLine("   Heuristic: ${summary.heuristicCount}")
            sb.appendLine()
        }

        // Gate Statistics (only if CLAW analyses exist)
        val clawCount = summary.analysisByType["claw"] ?: 0
        if (clawCount > 0) {
            sb.appendLine("🚪 CLAW GATE FAILURES")
            sb.appendLine("   Credibility: ${summary.gateFailures["credibility"]}")
            sb.appendLine("   Avoidance: ${summary.gateFailures["avoidance"]}")
            sb.appendLine("   Limits: ${summary.gateFailures["limits"]}")
            sb.appendLine("   Worth: ${summary.gateFailures["worth"]}")
            sb.appendLine()
        }

        // Analysis by Type
        if (summary.analysisByType.isNotEmpty()) {
            sb.appendLine("📈 ANALYSIS BY TYPE")
            for ((type, count) in summary.analysisByType.entries.sortedByDescending { it.value }) {
                val label = when {
                    type == "claw" -> "CLAW Analysis"
                    type.startsWith("security:") -> "Security: ${type.removePrefix("security:")}"
                    type.startsWith("compliance:") -> "Compliance: ${type.removePrefix("compliance:")}"
                    else -> type
                }
                sb.appendLine("   $label: $count")
            }
            sb.appendLine()
        }

        // Provider Usage
        if (summary.providerUsage.isNotEmpty()) {
            sb.appendLine("☁️ PROVIDER USAGE")
            for ((provider, count) in summary.providerUsage.entries.sortedByDescending { it.value }) {
                sb.appendLine("   $provider: $count")
            }
            sb.appendLine()
        }

        // Time Range
        if (summary.firstAnalysis != null && summary.lastAnalysis != null) {
            val firstDate = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(java.util.Date(summary.firstAnalysis))
            val lastDate = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(java.util.Date(summary.lastAnalysis))
            sb.appendLine("📅 TIME RANGE")
            sb.appendLine("   First: $firstDate")
            sb.appendLine("   Last: $lastDate")
            sb.appendLine()
        }

        sb.appendLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        return sb.toString()
    }
}
