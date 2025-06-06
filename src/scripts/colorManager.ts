import { formatHex, oklch, wcagContrast, parse } from 'culori'

export interface ColorState {
  foregroundColor: string
  backgroundColor: string
}

export class ColorManager {
  private static instance: ColorManager
  private foregroundColor: string = '#4646ff'
  private backgroundColor: string = '#e6e64a'
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
   * Load colors from localStorage if available
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return

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

  /**
   * Save current colors to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return

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

    // Update base colors
    root.style.setProperty('--color-foreground-base', this.foregroundColor)
    root.style.setProperty('--color-background-base', this.backgroundColor)

    // Generate and update color shades using oklch
    this.updateColorShades('--color-foreground', this.foregroundColor)
    this.updateColorShades('--color-background', this.backgroundColor)
  }

  /**
   * Generate color shades using oklch and update CSS variables
   */
  private updateColorShades(baseVar: string, color: string): void {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const parsed = parse(color)

    if (!parsed) return

    // Convert to oklch for better shade generation
    const oklchColor = oklch(parsed)
    if (!oklchColor) return

    // Generate shades by adjusting lightness
    const shades = [90, 80, 70, 60, 50]

    shades.forEach((lightness, index) => {
      const shade = {
        ...oklchColor,
        l: lightness / 100,
      }

      const hex = formatHex(shade)
      root.style.setProperty(`${baseVar}-${(index + 1) * 10}`, hex)
    })
  }

  /**
   * Dispatch custom event to notify components of color changes
   */
  private dispatchColorChangeEvent(): void {
    if (typeof window === 'undefined') return

    window.dispatchEvent(
      new CustomEvent('colorsChanged', {
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
