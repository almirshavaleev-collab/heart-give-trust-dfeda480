/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as donationLinkCode } from './donation-link-code.tsx'
import {
  succeededTemplate, retryTemplate, pausedTemplate, recoveredTemplate,
} from './recurring-events.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'donation-link-code': donationLinkCode,
  'recurring-payment-succeeded': succeededTemplate,
  'recurring-retry-scheduled': retryTemplate,
  'recurring-paused': pausedTemplate,
  'recurring-recovered': recoveredTemplate,
}