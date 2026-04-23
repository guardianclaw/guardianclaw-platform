/**
 * Seed Templates Tests
 *
 * Tests for seed generation and customization in hooks/seeds.ts
 */

import { describe, it, expect } from 'vitest';
import {
  STANDARD_SEED,
  STRICT_SEED,
  SEED_TEMPLATES,
  getSeedContent,
  getSeedForLevel,
  hasSeed,
  createCustomizedSeed,
  isValidSeedTemplate,
  getRecommendedSeedTemplate,
  getSeedTemplateMetadata,
  getAllSeedTemplateMetadata,
} from '../hooks/seeds';
import { WATCH_LEVEL, GUARD_LEVEL, SHIELD_LEVEL, OFF_LEVEL } from '../config/levels';

// =============================================================================
// Seed Template Constants Tests
// =============================================================================

describe('Seed Template Constants', () => {
  describe('STANDARD_SEED', () => {
    it('should be a non-empty string', () => {
      expect(typeof STANDARD_SEED).toBe('string');
      expect(STANDARD_SEED.length).toBeGreaterThan(0);
    });

    it('should contain claw-safety-context tag', () => {
      expect(STANDARD_SEED).toContain('<claw-safety-context>');
      expect(STANDARD_SEED).toContain('</claw-safety-context>');
    });

    it('should reference CLAW principles', () => {
      expect(STANDARD_SEED).toContain('Credibility');
      expect(STANDARD_SEED).toContain('Avoidance');
      expect(STANDARD_SEED).toContain('Limits');
      expect(STANDARD_SEED).toContain('Worth');
    });

    it('should mention treating external content as untrusted', () => {
      expect(STANDARD_SEED).toContain('untrusted');
    });

    it('should mention protecting credentials', () => {
      expect(STANDARD_SEED).toContain('API keys');
      expect(STANDARD_SEED).toContain('passwords');
      expect(STANDARD_SEED).toContain('credentials');
    });
  });

  describe('STRICT_SEED', () => {
    it('should be a non-empty string', () => {
      expect(typeof STRICT_SEED).toBe('string');
      expect(STRICT_SEED.length).toBeGreaterThan(0);
    });

    it('should have high priority attribute', () => {
      expect(STRICT_SEED).toContain('priority="high"');
    });

    it('should contain mandatory rules', () => {
      expect(STRICT_SEED).toContain('MANDATORY RULES');
      expect(STRICT_SEED).toContain('1.');
      expect(STRICT_SEED).toContain('2.');
      expect(STRICT_SEED).toContain('3.');
      expect(STRICT_SEED).toContain('4.');
    });

    it('should contain CLAW protocol section', () => {
      expect(STRICT_SEED).toContain('CLAW Protocol');
      expect(STRICT_SEED).toContain('CREDIBILITY:');
      expect(STRICT_SEED).toContain('AVOIDANCE:');
      expect(STRICT_SEED).toContain('LIMITS:');
      expect(STRICT_SEED).toContain('WORTH:');
    });

    it('should mention blocking violations', () => {
      expect(STRICT_SEED).toContain('Violations will be blocked');
    });

    it('should be longer than standard seed', () => {
      expect(STRICT_SEED.length).toBeGreaterThan(STANDARD_SEED.length);
    });
  });

  describe('SEED_TEMPLATES', () => {
    it('should have three templates', () => {
      expect(Object.keys(SEED_TEMPLATES)).toHaveLength(3);
    });

    it('should have none as undefined', () => {
      expect(SEED_TEMPLATES.none).toBeUndefined();
    });

    it('should have standard as STANDARD_SEED', () => {
      expect(SEED_TEMPLATES.standard).toBe(STANDARD_SEED);
    });

    it('should have strict as STRICT_SEED', () => {
      expect(SEED_TEMPLATES.strict).toBe(STRICT_SEED);
    });
  });
});

// =============================================================================
// Seed Content Functions Tests
// =============================================================================

describe('Seed Content Functions', () => {
  describe('getSeedContent', () => {
    it('should return undefined for none', () => {
      expect(getSeedContent('none')).toBeUndefined();
    });

    it('should return standard seed for standard', () => {
      expect(getSeedContent('standard')).toBe(STANDARD_SEED);
    });

    it('should return strict seed for strict', () => {
      expect(getSeedContent('strict')).toBe(STRICT_SEED);
    });
  });

  describe('getSeedForLevel', () => {
    it('should return undefined for OFF level', () => {
      expect(getSeedForLevel(OFF_LEVEL)).toBeUndefined();
    });

    it('should return standard seed for WATCH level', () => {
      expect(getSeedForLevel(WATCH_LEVEL)).toBe(STANDARD_SEED);
    });

    it('should return standard seed for GUARD level', () => {
      expect(getSeedForLevel(GUARD_LEVEL)).toBe(STANDARD_SEED);
    });

    it('should return strict seed for SHIELD level', () => {
      expect(getSeedForLevel(SHIELD_LEVEL)).toBe(STRICT_SEED);
    });
  });

  describe('hasSeed', () => {
    it('should return false for OFF level', () => {
      expect(hasSeed(OFF_LEVEL)).toBe(false);
    });

    it('should return true for WATCH level', () => {
      expect(hasSeed(WATCH_LEVEL)).toBe(true);
    });

    it('should return true for GUARD level', () => {
      expect(hasSeed(GUARD_LEVEL)).toBe(true);
    });

    it('should return true for SHIELD level', () => {
      expect(hasSeed(SHIELD_LEVEL)).toBe(true);
    });
  });
});

// =============================================================================
// Seed Customization Tests
// =============================================================================

describe('Seed Customization', () => {
  describe('createCustomizedSeed', () => {
    it('should return undefined for none template', () => {
      const result = createCustomizedSeed('none', {
        prependContext: 'Hello',
      });
      expect(result).toBeUndefined();
    });

    it('should add prepend context', () => {
      const result = createCustomizedSeed('standard', {
        prependContext: 'You are a healthcare assistant.',
      });

      expect(result).toContain('You are a healthcare assistant.');
      expect(result).toContain(STANDARD_SEED);
      expect(result!.indexOf('healthcare')).toBeLessThan(
        result!.indexOf('claw-safety-context')
      );
    });

    it('should add append context', () => {
      const result = createCustomizedSeed('standard', {
        appendContext: 'Follow HIPAA guidelines.',
      });

      expect(result).toContain('Follow HIPAA guidelines.');
      expect(result).toContain(STANDARD_SEED);
      expect(result!.indexOf('HIPAA')).toBeGreaterThan(
        result!.indexOf('</claw-safety-context>')
      );
    });

    it('should add both prepend and append context', () => {
      const result = createCustomizedSeed('standard', {
        prependContext: 'Context before.',
        appendContext: 'Context after.',
      });

      expect(result).toContain('Context before.');
      expect(result).toContain('Context after.');

      const beforeIdx = result!.indexOf('Context before.');
      const seedIdx = result!.indexOf('claw-safety-context');
      const afterIdx = result!.indexOf('Context after.');

      expect(beforeIdx).toBeLessThan(seedIdx);
      expect(seedIdx).toBeLessThan(afterIdx);
    });

    it('should add additional rules to strict template', () => {
      const result = createCustomizedSeed('strict', {
        additionalRules: [
          'Never share patient data',
          'Log all data access',
        ],
      });

      expect(result).toContain('5. Never share patient data');
      expect(result).toContain('6. Log all data access');
    });

    it('should not add additional rules to standard template', () => {
      const result = createCustomizedSeed('standard', {
        additionalRules: ['Custom rule'],
      });

      // Standard template doesn't have numbered rules, so this should just return base + nothing added
      expect(result).toBe(STANDARD_SEED);
    });

    it('should apply custom CLAW guidance', () => {
      const result = createCustomizedSeed('strict', {
        customCLAW: {
          credibility: 'Verify all medical claims with sources',
          avoidance: 'Consider patient safety implications',
        },
      });

      expect(result).toContain('CREDIBILITY: Verify all medical claims with sources');
      expect(result).toContain('AVOIDANCE: Consider patient safety implications');
      // Unchanged ones should remain
      expect(result).toContain('LIMITS: Is this within authorized boundaries?');
      expect(result).toContain('WORTH: Does this serve a legitimate goal?');
    });

    it('should apply all custom CLAW fields', () => {
      const result = createCustomizedSeed('strict', {
        customCLAW: {
          credibility: 'Custom credibility',
          avoidance: 'Custom avoidance',
          limits: 'Custom limits',
          worth: 'Custom worth',
        },
      });

      expect(result).toContain('CREDIBILITY: Custom credibility');
      expect(result).toContain('AVOIDANCE: Custom avoidance');
      expect(result).toContain('LIMITS: Custom limits');
      expect(result).toContain('WORTH: Custom worth');
    });

    it('should combine all customization options', () => {
      const result = createCustomizedSeed('strict', {
        prependContext: 'Healthcare context.',
        appendContext: 'HIPAA compliance required.',
        additionalRules: ['Rule 5'],
        customCLAW: {
          avoidance: 'Patient safety first',
        },
      });

      expect(result).toContain('Healthcare context.');
      expect(result).toContain('HIPAA compliance required.');
      expect(result).toContain('5. Rule 5');
      expect(result).toContain('AVOIDANCE: Patient safety first');
    });
  });
});

// =============================================================================
// Seed Validation Tests
// =============================================================================

describe('Seed Validation', () => {
  describe('isValidSeedTemplate', () => {
    it('should return true for none', () => {
      expect(isValidSeedTemplate('none')).toBe(true);
    });

    it('should return true for standard', () => {
      expect(isValidSeedTemplate('standard')).toBe(true);
    });

    it('should return true for strict', () => {
      expect(isValidSeedTemplate('strict')).toBe(true);
    });

    it('should return false for invalid strings', () => {
      expect(isValidSeedTemplate('invalid')).toBe(false);
      expect(isValidSeedTemplate('STANDARD')).toBe(false);
      expect(isValidSeedTemplate('')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isValidSeedTemplate(null)).toBe(false);
      expect(isValidSeedTemplate(undefined)).toBe(false);
      expect(isValidSeedTemplate(123)).toBe(false);
      expect(isValidSeedTemplate({})).toBe(false);
      expect(isValidSeedTemplate(['standard'])).toBe(false);
    });
  });

  describe('getRecommendedSeedTemplate', () => {
    it('should return none for off', () => {
      expect(getRecommendedSeedTemplate('off')).toBe('none');
    });

    it('should return standard for watch', () => {
      expect(getRecommendedSeedTemplate('watch')).toBe('standard');
    });

    it('should return standard for guard', () => {
      expect(getRecommendedSeedTemplate('guard')).toBe('standard');
    });

    it('should return strict for shield', () => {
      expect(getRecommendedSeedTemplate('shield')).toBe('strict');
    });
  });
});

// =============================================================================
// Seed Metadata Tests
// =============================================================================

describe('Seed Metadata', () => {
  describe('getSeedTemplateMetadata', () => {
    it('should return correct metadata for none', () => {
      const meta = getSeedTemplateMetadata('none');

      expect(meta.name).toBe('none');
      expect(meta.description).toContain('No safety seed');
      expect(meta.length).toBe(0);
      expect(meta.includesCLAW).toBe(false);
      expect(meta.includesMandatoryRules).toBe(false);
      expect(meta.recommendedFor).toContain('off');
    });

    it('should return correct metadata for standard', () => {
      const meta = getSeedTemplateMetadata('standard');

      expect(meta.name).toBe('standard');
      expect(meta.description).toContain('Gentle');
      expect(meta.length).toBe(STANDARD_SEED.length);
      expect(meta.includesCLAW).toBe(true);
      expect(meta.includesMandatoryRules).toBe(false);
      expect(meta.recommendedFor).toContain('watch');
      expect(meta.recommendedFor).toContain('guard');
    });

    it('should return correct metadata for strict', () => {
      const meta = getSeedTemplateMetadata('strict');

      expect(meta.name).toBe('strict');
      expect(meta.description).toContain('Strong');
      expect(meta.length).toBe(STRICT_SEED.length);
      expect(meta.includesCLAW).toBe(true);
      expect(meta.includesMandatoryRules).toBe(true);
      expect(meta.recommendedFor).toContain('shield');
    });
  });

  describe('getAllSeedTemplateMetadata', () => {
    it('should return metadata for all templates', () => {
      const allMeta = getAllSeedTemplateMetadata();

      expect(allMeta).toHaveLength(3);
      expect(allMeta.map(m => m.name)).toEqual(['none', 'standard', 'strict']);
    });

    it('should return readonly array', () => {
      const allMeta = getAllSeedTemplateMetadata();

      // TypeScript should prevent mutation, but we can verify at runtime
      expect(Array.isArray(allMeta)).toBe(true);
    });
  });
});

// =============================================================================
// Seed Content Verification Tests
// =============================================================================

describe('Seed Content Verification', () => {
  it('should have valid XML-like structure in standard seed', () => {
    const openTag = '<claw-safety-context>';
    const closeTag = '</claw-safety-context>';

    expect(STANDARD_SEED).toContain(openTag);
    expect(STANDARD_SEED).toContain(closeTag);

    const openIdx = STANDARD_SEED.indexOf(openTag);
    const closeIdx = STANDARD_SEED.indexOf(closeTag);

    expect(openIdx).toBeLessThan(closeIdx);
  });

  it('should have valid XML-like structure in strict seed', () => {
    const openTag = '<claw-safety-context';
    const closeTag = '</claw-safety-context>';

    expect(STRICT_SEED).toContain(openTag);
    expect(STRICT_SEED).toContain(closeTag);

    const openIdx = STRICT_SEED.indexOf(openTag);
    const closeIdx = STRICT_SEED.indexOf(closeTag);

    expect(openIdx).toBeLessThan(closeIdx);
  });

  it('should not have any empty lines at start/end of seeds', () => {
    expect(STANDARD_SEED.startsWith('<')).toBe(true);
    expect(STANDARD_SEED.endsWith('>')).toBe(true);

    expect(STRICT_SEED.startsWith('<')).toBe(true);
    expect(STRICT_SEED.endsWith('>')).toBe(true);
  });

  it('should use consistent terminology', () => {
    // Both should reference "GuardianClaw"
    expect(STANDARD_SEED).toContain('GuardianClaw');
    expect(STRICT_SEED).toContain('GuardianClaw');

    // Both should mention safety
    expect(STANDARD_SEED.toLowerCase()).toContain('safety');
    expect(STRICT_SEED.toLowerCase()).toContain('safety');
  });
});
