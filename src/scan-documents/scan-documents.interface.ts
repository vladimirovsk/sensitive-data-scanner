export interface ScanResult {
  hasSensitiveData: boolean
  matches: Record<string, string[]>
  extractedText?: string
}
