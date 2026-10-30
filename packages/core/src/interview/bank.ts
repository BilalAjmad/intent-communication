/**
 * Interview Bank (intent.md 6.3-6.5)
 * The complete question bank with seeds, slots, and metadata.
 */

import { Bank, BankSeed, SeedType, SeedTier, Milestone } from '@intent/schema'

export type { Bank, BankSeed, SeedType, SeedTier, Milestone }

/**
 * Complete interview bank with all seeds from intent.md 6.3-6.5
 * 35 interview seeds, 6 deep-dive, 5 control = 46 total
 */
export const INTERVIEW_BANK = {
  version: 1,
  seeds: [
    // GOAL (6 seeds)
    {
      id: 'goal.purpose', slot: 'goal.purpose', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Determines the entire interview scope and feature set',
      profileKey: 'goal.purpose',
      options: [
        { id: 'ecommerce', label: 'E-commerce', description: 'Sell products online' },
        { id: 'saas', label: 'SaaS', description: 'Software as a service' },
        { id: 'content', label: 'Content', description: 'Blog, media, documentation' },
        { id: 'dashboard', label: 'Dashboard', description: 'Internal tools, analytics' },
        { id: 'social', label: 'Social', description: 'Community, messaging, feed' },
        { id: 'other', label: 'Other', description: 'Something else' },
      ],
      default: { rule: 'not-delegable' },
    },
    {
      id: 'goal.platform', slot: 'goal.platform', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Determines target platforms and technical constraints',
      profileKey: 'goal.platform',
      options: [
        { id: 'web', label: 'Web', description: 'Browser-based application' },
        { id: 'mobile', label: 'Mobile', description: 'iOS/Android native or hybrid' },
        { id: 'desktop', label: 'Desktop', description: 'Electron, Tauri, native' },
        { id: 'multi', label: 'Multiple', description: 'Web + mobile + desktop' },
      ],
      default: { rule: 'prefer-web' },
    },
    {
      id: 'goal.success', slot: 'goal.success', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Defines success metrics for the project',
      profileKey: 'goal.success',
      options: [
        { id: 'users', label: 'User count', description: 'Number of active users' },
        { id: 'revenue', label: 'Revenue', description: 'MRR, ARR, or transaction volume' },
        { id: 'engagement', label: 'Engagement', description: 'Time spent, sessions, retention' },
        { id: 'conversion', label: 'Conversion', description: 'Funnel conversion rates' },
        { id: 'other', label: 'Other', description: 'Custom success metric' },
      ],
      default: { rule: 'prefer-users' },
    },
    {
      id: 'goal.protoUse', slot: 'goal.protoUse', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines if prototype is throwaway or evolves to production',
      profileKey: 'goal.protoUse',
      options: [
        { id: 'throwaway', label: 'Throwaway', description: 'Validate idea, then rebuild' },
        { id: 'evolve', label: 'Evolve to production', description: 'Ship the prototype' },
        { id: 'unsure', label: 'Unsure', description: 'Decide later' },
      ],
      default: { rule: 'prefer-throwaway' },
    },
    {
      id: 'goal.timeline', slot: 'goal.timeline', type: 'deep-dive', tier: 'P3', since: 'M2',
      whyAsked: 'Determines scope and team size',
      profileKey: 'goal.timeline',
      options: [
        { id: 'asap', label: 'ASAP', description: 'Ship in weeks' },
        { id: 'months', label: '2-3 months', description: 'Standard timeline' },
        { id: 'flexible', label: 'Flexible', description: 'No hard deadline' },
      ],
      default: { rule: 'prefer-months' },
    },
    {
      id: 'goal.team', slot: 'goal.team', type: 'deep-dive', tier: 'P3', since: 'M2',
      whyAsked: 'Determines collaboration features and handoff needs',
      profileKey: 'goal.team',
      options: [
        { id: 'solo', label: 'Solo', description: 'Single builder' },
        { id: 'small', label: 'Small team', description: '2-5 people' },
        { id: 'large', label: 'Large team', description: '5+ with handoff needs' },
      ],
      default: { rule: 'prefer-solo' },
    },
,
// USERS (4 seeds)
    {
      id: 'users.primary', slot: 'users.primary', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Determines default assumptions about technical skill and context',
      profileKey: 'users.primary',
      options: [
        { id: 'developers', label: 'Developers', description: 'Technical users, API-first' },
        { id: 'designers', label: 'Designers', description: 'Visual, pixel-perfect focus' },
        { id: 'product', label: 'Product managers', description: 'Feature-focused, metrics-driven' },
        { id: 'general', label: 'General audience', description: 'Non-technical end users' },
      ],
      default: { rule: 'prefer-developers' },
    }
    {
      id: 'users.skill', slot: 'users.skill', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines complexity of UI and onboarding needs',
      profileKey: 'users.skill',
      options: [
        { id: 'expert', label: 'Expert', description: 'Power users, keyboard shortcuts' },
        { id: 'intermediate', label: 'Intermediate', description: 'Comfortable with standard UI' },
        { id: 'novice', label: 'Novice', description: 'Needs guidance, simple flows' },
      ],
      default: { rule: 'prefer-intermediate' },
    }
    {
      id: 'users.a11y', slot: 'users.a11y', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines accessibility baseline requirements',
      profileKey: 'users.a11y',
      options: [
        { id: 'full', label: 'Full WCAG AA', description: 'Screen reader, keyboard, contrast' },
        { id: 'basic', label: 'Basic', description: 'Color contrast, keyboard only' },
        { id: 'none', label: 'None', description: 'No accessibility requirements' },
      ],
      default: { rule: 'prefer-full' },
    }
    {
      id: 'users.context', slot: 'users.context', type: 'interview', tier: 'P3', since: 'M1',
      whyAsked: 'Determines responsive breakpoints and touch targets',
      profileKey: 'users.context',
      options: [
        { id: 'desktop', label: 'Desktop', description: 'Mouse/keyboard, large screens' },
        { id: 'mobile', label: 'Mobile-first', description: 'Touch, small screens, portrait' },
        { id: 'both', label: 'Responsive', description: 'Adapts to all form factors' },
      ],
      default: { rule: 'prefer-responsive' },
    }

    // SCREENS (4 seeds)
    {
      id: 'screens.list', slot: 'screens.list', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Defines the app structure and navigation',
      profileKey: 'screens.list',
      options: [
        { id: 'one', label: 'Single screen', description: 'Landing page or dashboard' },
        { id: 'few', label: '2-5 screens', description: 'Simple app with few views' },
        { id: 'many', label: 'Many screens', description: 'Complex app with deep navigation' },
      ],
      default: { rule: 'prefer-few' },
    }
    {
      id: 'screens.nav', slot: 'screens.nav', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Determines navigation pattern and layout',
      profileKey: 'screens.nav',
      options: [
        { id: 'tabs', label: 'Tabs', description: 'Bottom/top tab bar' },
        { id: 'drawer', label: 'Drawer', description: 'Hamburger/side menu' },
        { id: 'stack', label: 'Stack', description: 'Linear push/pop navigation' },
      ],
      default: { rule: 'prefer-tabs' },
    }
    {
      id: 'screens.auth', slot: 'screens.auth', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines auth screens and user flow',
      profileKey: 'screens.auth',
      options: [
        { id: 'none', label: 'No auth', description: 'Public app, no login' },
        { id: 'email', label: 'Email/password', description: 'Traditional auth' },
        { id: 'social', label: 'Social login', description: 'OAuth providers' },
        { id: 'magic', label: 'Magic link', description: 'Email-based passwordless' },
      ],
      default: { rule: 'prefer-none' },
    }
    {
      id: 'screens.start', slot: 'screens.start', type: 'interview', tier: 'P3', since: 'M1',
      whyAsked: 'Determines first screen user sees',
      profileKey: 'screens.start',
      options: [
        { id: 'dashboard', label: 'Dashboard', description: 'Data overview, metrics' },
        { id: 'home', label: 'Home/feed', description: 'Content feed or landing' },
        { id: 'onboarding', label: 'Onboarding', description: 'Welcome and setup flow' },
      ],
      default: { rule: 'prefer-dashboard' },
    }

    // FLOW (4 seeds)
    {
      id: 'flow.main', slot: 'flow.main', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Defines the core user journey',
      profileKey: 'flow.main',
      options: [
        { id: 'browse', label: 'Browse & select', description: 'Catalog, search, pick' },
        { id: 'create', label: 'Create & edit', description: 'Forms, editors, builders' },
        { id: 'dashboard', label: 'Monitor & act', description: 'Metrics, alerts, actions' },
        { id: 'social', label: 'Social', description: 'Feed, comments, messaging' },
      ],
      default: { rule: 'prefer-browse' },
    }
    {
      id: 'flow.after', slot: 'flow.after', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines post-action behavior and feedback',
      profileKey: 'flow.after',
      options: [
        { id: 'list', label: 'Back to list', description: 'Return to index view' },
        { id: 'detail', label: 'Stay on detail', description: 'Keep context on item' },
        { id: 'next', label: 'Next task', description: 'Suggest next action' },
      ],
      default: { rule: 'prefer-list' },
    }
    {
      id: 'flow.links', slot: 'flow.links', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines deep linking and sharing needs',
      profileKey: 'flow.links',
      options: [
        { id: 'none', label: 'No deep links', description: 'No sharing needed' },
        { id: 'share', label: 'Share items', description: 'Copy link to item' },
        { id: 'invite', label: 'Invite collaborators', description: 'Team sharing' },
      ],
      default: { rule: 'prefer-share' },
    }
    {
      id: 'flow.back', slot: 'flow.back', type: 'interview', tier: 'P3', since: 'M1',
      whyAsked: 'Determines back navigation behavior',
      profileKey: 'flow.back',
      options: [
        { id: 'standard', label: 'Standard back', description: 'Browser/history back' },
        { id: 'contextual', label: 'Contextual back', description: 'Returns to parent view' },
        { id: 'persistent', label: 'Persistent nav', description: 'Always-visible back button' },
      ],
      default: { rule: 'prefer-standard' },
    }

    // STYLE (4 seeds)
    {
      id: 'style.color', slot: 'style.color', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Sets brand colors and semantic palette',
      profileKey: 'style.color',
      options: [
        { id: 'brand', label: 'Use brand colors', description: 'Primary, secondary, accent from brand' },
        { id: 'neutral', label: 'Neutral grays', description: 'Minimal, professional' },
        { id: 'vibrant', label: 'Vibrant', description: 'Bold, energetic palette' },
      ],
      default: { rule: 'prefer-brand' },
    }
    {
      id: 'style.typography', slot: 'style.typography', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Sets font stack and type scale',
      profileKey: 'style.typography',
      options: [
        { id: 'system', label: 'System fonts', description: 'Native, fast, familiar' },
        { id: 'google', label: 'Google Fonts', description: 'Inter, Roboto, etc.' },
        { id: 'custom', label: 'Custom font', description: 'Uploaded or licensed font' },
      ],
      default: { rule: 'prefer-system' },
    }
    {
      id: 'style.spacing', slot: 'style.spacing', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Sets spacing scale and density',
      profileKey: 'style.spacing',
      options: [
        { id: 'compact', label: 'Compact', description: 'Dense, data-heavy' },
        { id: 'comfortable', label: 'Comfortable', description: 'Balanced, readable' },
        { id: 'spacious', label: 'Spacious', description: 'Airy, editorial' },
      ],
      default: { rule: 'prefer-comfortable' },
    }
    {
      id: 'style.corner', slot: 'style.corner', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Sets border radius personality',
      profileKey: 'style.corner',
      options: [
        { id: 'sharp', label: 'Sharp (0px)', description: 'Modern, technical' },
        { id: 'rounded', label: 'Rounded (8px)', description: 'Friendly, approachable' },
        { id: 'pill', label: 'Pill (full)', description: 'Playful, mobile-first' },
      ],
      default: { rule: 'prefer-rounded' },
    }

    // CONTENT (4 seeds)
    {
      id: 'content.text', slot: 'content.text', type: 'interview', tier: 'P1', since: 'M1',
      whyAsked: 'Determines copy strategy and tone',
      profileKey: 'content.text',
      options: [
        { id: 'concise', label: 'Concise', description: 'Short, scannable, action-oriented' },
        { id: 'conversational', label: 'Conversational', description: 'Friendly, human tone' },
        { id: 'technical', label: 'Technical', description: 'Precise, detailed, developer-focused' },
      ],
      default: { rule: 'prefer-concise' },
    }
    {
      id: 'content.media', slot: 'content.media', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines image/video handling and optimization',
      profileKey: 'content.media',
      options: [
        { id: 'light', label: 'Light', description: 'Icons, illustrations, small images' },
        { id: 'rich', label: 'Rich media', description: 'Photos, videos, galleries' },
        { id: 'none', label: 'Text only', description: 'No media, fastest' },
      ],
      default: { rule: 'prefer-light' },
    }
    {
      id: 'content.empty', slot: 'content.empty', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines empty state messaging and illustrations',
      profileKey: 'content.empty',
      options: [
        { id: 'illustrated', label: 'Illustrated', description: 'Custom empty state illustrations' },
        { id: 'minimal', label: 'Minimal', description: 'Text only, simple icon' },
        { id: 'action', label: 'Action-oriented', description: 'CTA to create first item' },
      ],
      default: { rule: 'prefer-illustrated' },
    }
    {
      id: 'content.error', slot: 'content.error', type: 'interview', tier: 'P2', since: 'M1',
      whyAsked: 'Determines error messaging tone and recovery actions',
      profileKey: 'content.error',
      options: [
        { id: 'friendly', label: 'Friendly', description: 'Helpful, non-technical, retry button' },
        { id: 'technical', label: 'Technical', description: 'Error codes, details for devs' },
        { id: 'minimal', label: 'Minimal', description: 'Generic message, retry only' },
      ],
      default: { rule: 'prefer-friendly' },
    }

    // EDGE CASES (4 seeds)
    {
      id: 'edge.auth', slot: 'edge.auth', type: 'deep-dive', tier: 'P2', since: 'M2',
      whyAsked: 'Determines auth edge case handling',
      profileKey: 'edge.auth',
      options: [
        { id: 'strict', label: 'Strict', description: 'Force login, block unauthenticated' },
        { id: 'graceful', label: 'Graceful', description: 'Allow limited access, prompt login' },
        { id: 'none', label: 'None', description: 'No auth, public only' },
      ],
      default: { rule: 'prefer-graceful' },
    }

    {
      id: 'edge.error', slot: 'edge.error', type: 'deep-dive', tier: 'P2', since: 'M2',
      whyAsked: 'Determines error boundary behavior',
      profileKey: 'edge.error',
      options: [
        { id: 'recover', label: 'Auto-recover', description: 'Retry, fallback UI' },
        { id: 'report', label: 'Report & block', description: 'Show error, send to Sentry' },
        { id: 'crash', label: 'Crash', description: 'Fail fast, show error boundary' },
      ],
      default: { rule: 'prefer-recover' },
    }
    {
      id: 'edge.empty', slot: 'edge.empty', type: 'deep-dive', tier: 'P2', since: 'M2',
      whyAsked: 'Determines empty state behavior',
      profileKey: 'edge.empty',
      options: [
        { id: 'guide', label: 'Guide user', description: 'Show CTA to create first item' },
        { id: 'hide', label: 'Hide section', description: 'Collapse empty sections' },
        { id: 'placeholder', label: 'Show placeholder', description: 'Gray box with label' },
      ],
      default: { rule: 'prefer-guide' },
    }
    {
      id: 'edge.performance', slot: 'edge.performance', type: 'deep-dive', tier: 'P3', since: 'M3',
      whyAsked: 'Determines performance budgets and optimization',
      profileKey: 'edge.performance',
      options: [
        { id: 'fast', label: 'Fast', description: 'Sub-100ms interactions, lazy load' },
        { id: 'balanced', label: 'Balanced', description: 'Reasonable defaults' },
        { id: 'rich', label: 'Rich', description: 'Animations, effects, no compromise' },
      ],
      default: { rule: 'prefer-balanced' },
    }
    // CONTROL SEEDS (5 seeds)
    {
      id: 'control.test1', slot: 'control.test1', type: 'control', tier: 'P1', since: 'M1',
      whyAsked: 'Attention check - must answer "Skip"',
      profileKey: null,
      options: [
        { id: 'skip', label: 'Skip', description: 'This is an attention check' },
        { id: 'option1', label: 'Option 1', description: 'Wrong answer' },
        { id: 'option2', label: 'Option 2', description: 'Wrong answer' },
      ],
      default: { notDelegable: true },
    }
    {
      id: 'control.test2', slot: 'control.test2', type: 'control', tier: 'P1', since: 'M1',
      whyAsked: 'Attention check - must answer "Don't know, you choose"',
      profileKey: null,
      options: [
        { id: 'skip', label: 'Don't know, you choose', description: 'This is an attention check' },
        { id: 'option1', label: 'Option 1', description: 'Wrong answer' },
      ],
      default: { notDelegable: true },
    }
    {
      id: 'control.test3', slot: 'control.test3', type: 'control', tier: 'P1', since: 'M1',
      whyAsked: 'Attention check - validates reading comprehension',
      profileKey: null,
      options: [
        { id: 'correct', label: 'The correct answer', description: 'This is the right choice' },
        { id: 'wrong1', label: 'Wrong', description: 'Incorrect' },
      ],
      default: { notDelegable: true },
    }
    {
      id: 'control.test4', slot: 'control.test4', type: 'control', tier: 'P1', since: 'M1',
      whyAsked: 'Attention check - validates attention to detail',
      profileKey: null,
      options: [
        { id: 'skip', label: 'Don't know, you choose', description: 'This is an attention check' },
        { id: 'option1', label: 'Option 1', description: 'Wrong answer' },
      ],
      default: { notDelegable: true },
    }
    {
      id: 'control.test5', slot: 'control.test5', type: 'control', tier: 'P1', since: 'M1',
      whyAsked: 'Attention check - final validation',
      profileKey: null,
      options: [
        { id: 'skip', label: 'Don't know, you choose', description: 'This is an attention check' },
        { id: 'option1', label: 'Option 1', description: 'Wrong answer' },
      ],
      default: { notDelegable: true },
    }
  ],
}

export function getBank() {
  return { version: 1, seeds: INTERVIEW_BANK.seeds }
}

export function getSeed(id: string) {
  return INTERVIEW_BANK.seeds.find(s => s.id === id)
}

export function getSeedsByTopic(topic: string) {
  return INTERVIEW_BANK.seeds.filter(s => s.id.startsWith(topic + '.'))
}

export function getSeedsBySince(since: 'M1' | 'M2' | 'M3') {
  return INTERVIEW_BANK.seeds.filter(s => s.since === since)
}