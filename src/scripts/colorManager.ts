import { formatHex, oklch, wcagContrast, parse } from 'culori'

export interface ColorState {
  foregroundColor: string
  backgroundColor: string
}

export class ColorManager {
  private static instance: ColorManager
  private foregroundColor: string = '#521b92'
  private backgroundColor: string = '#ffd478'
  private isInitialized: boolean = false

  // Storage key for localStorage
  private static STORAGE_KEY = 'color-contrast-checker'

  private constructor() {
    this.loadFromStorage()
    this.setupViewTransitionListeners()
  }

  static getInstance(): ColorManager {
    if (!ColorManager.instance) {
      ColorManager.instance = new ColorManager()
    }
    return ColorManager.instance
  }

  /**
   * Setup listeners for Astro view transitions
   */
  private setupViewTransitionListeners(): void {
    if (typeof document === 'undefined') return

    // Listen for page load events (including view transitions)
    document.addEventListener('astro:page-load', () => {
      // Re-initialize after view transition
      setTimeout(() => {
        this.init()
      }, 50)
    })

    // Listen for before swap to maintain state
    document.addEventListener('astro:before-swap', () => {
      // Ensure we save current state before page swap
      this.saveToStorage()
    })
  }

  /**
   * Load colors from URL parameters first, then localStorage as fallback
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return

    // First, try to load from URL parameters
    if (this.loadFromURLParams()) {
      return // URL params found and loaded successfully
    }

    // Fallback to localStorage (with browser environment check)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(ColorManager.STORAGE_KEY)
        if (stored) {
          const { foregroundColor, backgroundColor } = JSON.parse(stored) as ColorState
          this.foregroundColor = foregroundColor || this.foregroundColor
          this.backgroundColor = backgroundColor || this.backgroundColor
        }
      } catch (error) {
        console.warn('Failed to load colors from localStorage:', error)
      }
    }
  }

  /**
   * Load colors from URL parameters
   * @returns true if URL parameters were found and loaded
   */
  private loadFromURLParams(): boolean {
    if (typeof window === 'undefined') return false

    try {
      const urlParams = new URLSearchParams(window.location.search)
      const fgParam = urlParams.get('fg')
      const bgParam = urlParams.get('bg')

      if (fgParam || bgParam) {
        if (fgParam) {
          // Add # prefix if not present
          const fgColor = fgParam.startsWith('#') ? fgParam : `#${fgParam}`
          if (this.isValidColor(fgColor)) {
            const hex = this.toHex(fgColor)
            if (hex) this.foregroundColor = hex
          }
        }

        if (bgParam) {
          // Add # prefix if not present
          const bgColor = bgParam.startsWith('#') ? bgParam : `#${bgParam}`
          if (this.isValidColor(bgColor)) {
            const hex = this.toHex(bgColor)
            if (hex) this.backgroundColor = hex
          }
        }

        return true // URL params were processed
      }
    } catch (error) {
      console.warn('Failed to load colors from URL parameters:', error)
    }

    return false
  }

  // Debounce timer for URL updates
  private urlUpdateTimeout: number | null = null

  /**
   * Update URL parameters with current colors (without creating history entry)
   */
  private updateURLParams(): void {
    if (typeof window === 'undefined') return

    // Clear existing timeout
    if (this.urlUpdateTimeout) {
      clearTimeout(this.urlUpdateTimeout)
    }

    // Debounce URL updates to prevent rapid changes during color picker dragging
    this.urlUpdateTimeout = window.setTimeout(() => {
      try {
        const url = new URL(window.location.href)
        // Strip # prefix for cleaner URLs (we'll add it back when reading)
        const fgParam = this.foregroundColor.startsWith('#') ? this.foregroundColor.slice(1) : this.foregroundColor
        const bgParam = this.backgroundColor.startsWith('#') ? this.backgroundColor.slice(1) : this.backgroundColor

        url.searchParams.set('fg', fgParam)
        url.searchParams.set('bg', bgParam)

        // Use replaceState to update URL without creating history entry
        window.history.replaceState({}, '', url.toString())
      } catch (error) {
        // Only log if it's not a rate limiting error
        if (error instanceof Error && !error.message?.includes('insecure')) {
          console.warn('Failed to update URL parameters:', error)
        }
      }
    }, 150) // 150ms debounce
  }

  /**
   * Save current colors to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return

    try {
      const state: ColorState = {
        foregroundColor: this.foregroundColor,
        backgroundColor: this.backgroundColor,
      }
      localStorage.setItem(ColorManager.STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.warn('Failed to save colors to localStorage:', error)
    }
  }

  /**
   * Validate if a color string is valid
   */
  isValidColor(color: string): boolean {
    return parse(color) !== undefined
  }

  /**
   * Convert any valid color to hex format
   */
  toHex(color: string): string | null {
    const parsed = parse(color)
    return parsed ? formatHex(parsed) : null
  }

  /**
   * Update foreground color and save to storage
   */
  setForegroundColor(color: string): boolean {
    if (!this.isValidColor(color)) return false

    const hex = this.toHex(color)
    if (!hex) return false

    this.foregroundColor = hex
    this.updateCSSVariables()
    this.saveToStorage()
    this.updateURLParams()
    this.dispatchColorChangeEvent()
    return true
  }

  /**
   * Update background color and save to storage
   */
  setBackgroundColor(color: string): boolean {
    if (!this.isValidColor(color)) return false

    const hex = this.toHex(color)
    if (!hex) return false

    this.backgroundColor = hex
    this.updateCSSVariables()
    this.saveToStorage()
    this.updateURLParams()
    this.dispatchColorChangeEvent()
    return true
  }

  /**
   * Get current foreground color
   */
  getForegroundColor(): string {
    return this.foregroundColor
  }

  /**
   * Get current background color
   */
  getBackgroundColor(): string {
    return this.backgroundColor
  }

  /**
   * Calculate contrast ratio between current colors
   */
  getContrastRatio(): number {
    const fg = parse(this.foregroundColor)
    const bg = parse(this.backgroundColor)

    if (!fg || !bg) return 1

    return wcagContrast(fg, bg)
  }

  /**
   * Check if current colors pass WCAG standards
   */
  getWCAGStatus(): {
    normalAA: boolean
    normalAAA: boolean
    largeAA: boolean
    largeAAA: boolean
    ratio: number
  } {
    const ratio = this.getContrastRatio()

    return {
      normalAA: ratio >= 4.5,
      normalAAA: ratio >= 7,
      largeAA: ratio >= 3,
      largeAAA: ratio >= 4.5,
      ratio: Math.round(ratio * 10) / 10,
    }
  }

  /**
   * Update CSS custom properties with current colors
   */
  private updateCSSVariables(): void {
    if (typeof document === 'undefined') return

    const root = document.documentElement

    // Update base colors - CSS will automatically generate shades via oklch(from var(...))
    root.style.setProperty('--color-foreground-base', this.foregroundColor)
    root.style.setProperty('--color-background-base', this.backgroundColor)
  }

  /**
   * Dispatch custom event to notify components of color changes
   */
  private dispatchColorChangeEvent(): void {
    if (typeof window === 'undefined') return

    window.dispatchEvent(
      new CustomEvent('colorManagerUpdate', {
        detail: {
          foregroundColor: this.foregroundColor,
          backgroundColor: this.backgroundColor,
          contrastRatio: this.getContrastRatio(),
          wcagStatus: this.getWCAGStatus(),
        },
      }),
    )
  }

  /**
   * Initialize the color manager (call this when DOM is ready)
   */
  init(): void {
    // Reload from storage in case it changed
    this.loadFromStorage()

    // Update CSS variables
    this.updateCSSVariables()

    // Update URL parameters to reflect current state
    this.updateURLParams()

    // Mark as initialized
    this.isInitialized = true

    // Dispatch event to notify components
    this.dispatchColorChangeEvent()
  }

  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Force refresh from localStorage (useful for view transitions)
   */
  refresh(): void {
    this.loadFromStorage()
    this.updateCSSVariables()
    this.dispatchColorChangeEvent()
  }

  /**
   * Get current state for components
   */
  getState(): ColorState & {
    contrastRatio: number
    wcagStatus: {
      normalAA: boolean
      normalAAA: boolean
      largeAA: boolean
      largeAAA: boolean
      ratio: number
    }
  } {
    return {
      foregroundColor: this.foregroundColor,
      backgroundColor: this.backgroundColor,
      contrastRatio: this.getContrastRatio(),
      wcagStatus: this.getWCAGStatus(),
    }
  }
}
