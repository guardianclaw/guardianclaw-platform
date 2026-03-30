/**
 * @fileoverview Approval modal component for action approve/reject workflow
 *
 * Shows detailed information about pending actions and allows users to:
 * - Review CLAW gate results
 * - See action parameters
 * - Approve or reject with reason
 *
 * Features:
 * - Full accessibility support (ARIA, focus trap, keyboard navigation)
 * - Animated transitions
 * - Inline error handling (no alert())
 *
 * @author GuardianClaw Team
 * @license MIT
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { PendingApproval } from '../../types';
import { t } from '../../lib/i18n';
import { useFocusTrap, useAnnounce } from '../hooks';
import {
  getActionDisplayInfo,
  getRiskIcon,
  getRiskBadgeStyle,
  formatPercentage,
} from '../utils';
import { modalStyles } from './styles';

interface ApprovalModalProps {
  /** Pending approval to review */
  pending: PendingApproval;
  /** Callback when approved */
  onApprove: (reason: string) => void;
  /** Callback when rejected */
  onReject: (reason: string) => void;
  /** Callback to close modal */
  onClose: () => void;
  /** Whether an action is in progress */
  isLoading?: boolean;
}

/**
 * Modal for reviewing and deciding on pending approval actions
 */
export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  pending,
  onApprove,
  onReject,
  onClose,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'claw' | 'params'>('overview');
  const [validationError, setValidationError] = useState<string | null>(null);

  const reasonInputRef = useRef<HTMLTextAreaElement>(null);
  const announce = useAnnounce();

  // Focus trap for accessibility
  const containerRef = useFocusTrap<HTMLDivElement>({
    isActive: true,
    onEscape: onClose,
    restoreFocus: true,
  });

  // Extract display info from action
  const displayInfo = useMemo(() => getActionDisplayInfo(pending.action), [pending.action]);

  // Announce modal opening to screen readers
  useEffect(() => {
    announce(
      `${t('reviewAction')}: ${displayInfo.type} from ${displayInfo.sourceName}. Risk level: ${displayInfo.riskLevel}`,
      'polite'
    );
  }, [announce, displayInfo]);

  // Clear validation error when reason changes
  useEffect(() => {
    if (reason.trim()) {
      setValidationError(null);
    }
  }, [reason]);

  const validateReason = (): boolean => {
    if (!reason.trim()) {
      setValidationError(t('reasonRequired'));
      reasonInputRef.current?.focus();
      announce(t('reasonRequired'), 'assertive');
      return false;
    }
    return true;
  };

  const handleApprove = () => {
    if (isLoading) return;
    if (!validateReason()) return;
    onApprove(reason);
  };

  const handleReject = () => {
    if (isLoading) return;
    if (!validateReason()) return;
    onReject(reason);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleApprove();
    }
  };

  // Generate unique IDs for accessibility
  const titleId = 'approval-modal-title';
  const descriptionId = 'approval-modal-description';
  const errorId = 'approval-reason-error';

  return (
    <div
      style={modalStyles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
      className="animate-overlayEnter"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={modalStyles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="animate-modalEnter"
      >
        {/* Header */}
        <header style={modalStyles.header}>
          <div style={modalStyles.headerContent}>
            <span style={modalStyles.headerIcon} aria-hidden="true">
              {getRiskIcon(displayInfo.riskLevel)}
            </span>
            <div>
              <h2 id={titleId} style={modalStyles.title}>
                {t('reviewAction')}
              </h2>
              <p id={descriptionId} style={modalStyles.subtitle}>
                {displayInfo.sourceName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={modalStyles.closeButton}
            aria-label={t('cancel')}
            disabled={isLoading}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        {/* Tabs */}
        <nav style={modalStyles.tabs} role="tablist" aria-label={t('reviewAction')}>
          {(['overview', 'claw', 'params'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              id={`tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
              onClick={() => setActiveTab(tab)}
              style={{
                ...modalStyles.tab,
                ...(activeTab === tab ? modalStyles.tabActive : {}),
              }}
              tabIndex={activeTab === tab ? 0 : -1}
            >
              {tab === 'overview' && t('overview')}
              {tab === 'claw' && t('clawGates')}
              {tab === 'params' && t('parameters')}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          style={modalStyles.content}
        >
          {activeTab === 'overview' && (
            <div className="animate-fadeIn">
              <InfoRow label={t('actionType')} value={displayInfo.type} />
              <InfoRow
                label={t('riskLevel')}
                value={
                  <span
                    style={{
                      ...modalStyles.riskBadge,
                      ...getRiskBadgeStyle(displayInfo.riskLevel),
                    }}
                  >
                    {displayInfo.riskLevel.toUpperCase()}
                  </span>
                }
              />
              <InfoRow label={t('description')} value={displayInfo.description} />
              {displayInfo.estimatedValueUsd !== undefined && (
                <InfoRow
                  label={t('estimatedValue')}
                  value={`$${displayInfo.estimatedValueUsd.toFixed(2)}`}
                />
              )}
              <InfoRow
                label={t('clawOverall')}
                value={
                  <span
                    style={{
                      ...modalStyles.clawBadge,
                      background: displayInfo.clawResult.overall
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                      color: displayInfo.clawResult.overall ? '#10b981' : '#ef4444',
                    }}
                  >
                    {displayInfo.clawResult.overall ? t('passed') : t('failed')}
                  </span>
                }
              />
            </div>
          )}

          {activeTab === 'claw' && (
            <div className="animate-fadeIn">
              <div style={modalStyles.clawGrid} role="list" aria-label={t('clawGates')}>
                <CLAWGateCard
                  name="Credibility"
                  icon="T"
                  result={displayInfo.clawResult.credibility}
                />
                <CLAWGateCard
                  name="Avoidance"
                  icon="H"
                  result={displayInfo.clawResult.avoidance}
                />
                <CLAWGateCard
                  name="Limits"
                  icon="S"
                  result={displayInfo.clawResult.limits}
                />
                <CLAWGateCard
                  name="Worth"
                  icon="P"
                  result={displayInfo.clawResult.worth}
                />
              </div>
              {displayInfo.clawResult.summary && (
                <div style={modalStyles.clawSummary} role="note">
                  <strong>{t('summary')}:</strong> {displayInfo.clawResult.summary}
                </div>
              )}
            </div>
          )}

          {activeTab === 'params' && (
            <div className="animate-fadeIn">
              <pre
                style={modalStyles.paramsCode}
                role="region"
                aria-label={t('parameters')}
                tabIndex={0}
              >
                {JSON.stringify(displayInfo.params, null, 2)}
              </pre>
            </div>
          )}
        </main>

        {/* Reason Input */}
        <div style={modalStyles.reasonSection}>
          <label
            htmlFor="approval-reason"
            style={modalStyles.reasonLabel}
          >
            {t('decisionReason')}
            <span style={{ color: '#ef4444' }} aria-hidden="true"> *</span>
          </label>
          <textarea
            id="approval-reason"
            ref={reasonInputRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('enterReason')}
            style={{
              ...modalStyles.reasonInput,
              ...(validationError ? { borderColor: '#ef4444' } : {}),
            }}
            rows={3}
            aria-required="true"
            aria-invalid={!!validationError}
            aria-describedby={validationError ? errorId : undefined}
            disabled={isLoading}
          />
          {validationError && (
            <div
              id={errorId}
              role="alert"
              style={modalStyles.errorMessage}
              className="animate-shake"
            >
              <span aria-hidden="true">⚠️</span> {validationError}
            </div>
          )}
        </div>

        {/* Actions */}
        <footer style={modalStyles.actions}>
          <button
            type="button"
            onClick={handleReject}
            style={modalStyles.rejectButton}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            style={modalStyles.approveButton}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading && <span style={{ marginRight: 6 }}>⏳</span>}
            {t('approve')}
          </button>
        </footer>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <div style={modalStyles.infoRow}>
    <span style={modalStyles.infoLabel}>{label}</span>
    <span style={modalStyles.infoValue}>{value}</span>
  </div>
);

interface CLAWGateCardProps {
  name: string;
  icon: string;
  result: { passed: boolean; score: number; issues: string[] };
}

const CLAWGateCard: React.FC<CLAWGateCardProps> = React.memo(({ name, icon, result }) => (
  <article
    role="listitem"
    style={{
      ...modalStyles.clawCard,
      borderColor: result.passed
        ? 'rgba(16, 185, 129, 0.3)'
        : 'rgba(239, 68, 68, 0.3)',
    }}
    aria-label={`${name} gate: ${result.passed ? 'passed' : 'failed'} with score ${formatPercentage(result.score)}`}
  >
    <div style={modalStyles.clawCardHeader}>
      <span
        style={{
          ...modalStyles.clawIcon,
          background: result.passed
            ? 'rgba(16, 185, 129, 0.2)'
            : 'rgba(239, 68, 68, 0.2)',
          color: result.passed ? '#10b981' : '#ef4444',
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span style={modalStyles.clawName}>{name}</span>
      <span
        style={{
          ...modalStyles.clawStatus,
          color: result.passed ? '#10b981' : '#ef4444',
        }}
        aria-hidden="true"
      >
        {result.passed ? '✓' : '✗'}
      </span>
    </div>
    <div style={modalStyles.clawScore}>
      {t('score')}: {formatPercentage(result.score)}
    </div>
    {result.issues.length > 0 && (
      <ul style={modalStyles.clawIssues} aria-label="Issues">
        {result.issues.map((issue, i) => (
          <li key={i} style={modalStyles.clawIssue}>
            • {issue}
          </li>
        ))}
      </ul>
    )}
  </article>
));

CLAWGateCard.displayName = 'CLAWGateCard';

export default ApprovalModal;
