import { ColorManager } from './colorManager'

// Make ColorManager available globally
declare global {
  interface Window {
    ColorManager: ColorManager
    // Add input value storage functions
    storeInputValue: (inputId: string, value: string) => void
    getStoredInputValue: (inputId: string) => string
  }
}

// Simple localStorage keys for input values
const INPUT_VALUES_KEY = 'color-input-values'

// Store input value in localStorage
function storeInputValue(inputId: string, value: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(INPUT_VALUES_KEY) || '{}')
    stored[inputId] = value
    localStorage.setItem(INPUT_VALUES_KEY, JSON.stringify(stored))
  } catch (e) {
    console.warn('Failed to store input value:', e)
  }
}

// Get input value from localStorage
function getStoredInputValue(inputId: string): string {
  try {
    const stored = JSON.parse(localStorage.getItem(INPUT_VALUES_KEY) || '{}')
    return stored[inputId] || ''
  } catch (e) {
    console.warn('Failed to get stored input value:', e)
    return ''
  }
}

// Initialize and expose ColorManager and functions globally
window.ColorManager = ColorManager.getInstance()
window.storeInputValue = storeInputValue
window.getStoredInputValue = getStoredInputValue

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.ColorManager.init()
  })
} else {
  window.ColorManager.init()
}

// Handle view transitions
document.addEventListener('astro:page-load', () => {
  window.ColorManager.init()
})

export {} // Ensure this is treated as a module
