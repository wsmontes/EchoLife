/**
 * Translation Controller for Echo Life
 * Manages translation preferences and language settings
 */

class TranslationController {
    constructor() {
        // Default settings
        this.currentLanguage = localStorage.getItem('echolife_language') || 'en-US';
        this.translateEnabled = localStorage.getItem('echolife_translate_enabled') === 'true' || false;
        
        // Initialize state
        this.initialized = false;
        
        // Initialize when DOM is ready
        if (document.readyState !== 'loading') {
            this.initialize();
        } else {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        }
    }
    
    initialize() {
        // Setup UI elements
        this.languageSelector = document.getElementById('languageSelector');
        this.translationToggle = document.getElementById('translationToggle');
        this.translationToggleLabel = document.getElementById('translationToggleLabel');
        
        if (!this.languageSelector || !this.translationToggle) {
            console.error('Language controls not found in DOM');
            return;
        }
        
        // Set initial states
        this.languageSelector.value = this.currentLanguage;
        this.translationToggle.checked = this.translateEnabled;
        this.updateToggleLabel();
        
        // Add event listeners
        this.languageSelector.addEventListener('change', (e) => this.handleLanguageChange(e));
        this.translationToggle.addEventListener('change', (e) => this.handleTranslationToggleChange(e));
        
        // Mark as initialized
        this.initialized = true;
        
        console.log(`Translation controller initialized: language=${this.currentLanguage}, translate=${this.translateEnabled}`);
        
        // Announce initial state to other components
        this.announceSettings();
    }
    
    handleLanguageChange(event) {
        const newLanguage = event.target.value;
        
        if (newLanguage === this.currentLanguage) return;
        
        this.currentLanguage = newLanguage;
        localStorage.setItem('echolife_language', newLanguage);
        
        // Update UI display text based on new language
        updateUILanguage(newLanguage);
        
        // Update toggle label
        this.updateToggleLabel();
        
        // Announce change to all components
        this.announceSettings();
        
        console.log(`Language changed to: ${newLanguage}`);
    }
    
    handleTranslationToggleChange(event) {
        const translateEnabled = event.target.checked;
        
        if (translateEnabled === this.translateEnabled) return;
        
        this.translateEnabled = translateEnabled;
        localStorage.setItem('echolife_translate_enabled', translateEnabled);
        
        // Update toggle label
        this.updateToggleLabel();
        
        // Announce change to all components
        this.announceSettings();
        
        console.log(`Translation toggle changed to: ${translateEnabled}`);
    }
    
    updateToggleLabel() {
        if (!this.translationToggleLabel) return;
        
        // Display correct label based on language and toggle state
        if (this.currentLanguage === 'pt-BR') {
            this.translationToggleLabel.textContent = this.translateEnabled ? 
                'Traduzir para Inglês' : 'Manter Português';
        } else {
            this.translationToggleLabel.textContent = this.translateEnabled ? 
                'Translate to Portuguese' : 'Keep English';
        }
    }
    
    announceSettings() {
        // Create and dispatch a custom event with the settings
        const event = new CustomEvent('translationSettingsChanged', {
            detail: {
                language: this.currentLanguage,
                translateEnabled: this.translateEnabled,
                // Calculate target language for translation
                targetLanguage: this.translateEnabled ? 
                    (this.currentLanguage === 'pt-BR' ? 'en-US' : 'pt-BR') : 
                    this.currentLanguage
            }
        });
        
        window.dispatchEvent(event);
    }
    
    // Public method to get current settings
    getSettings() {
        return {
            language: this.currentLanguage,
            translateEnabled: this.translateEnabled,
            targetLanguage: this.translateEnabled ? 
                (this.currentLanguage === 'pt-BR' ? 'en-US' : 'pt-BR') : 
                this.currentLanguage
        };
    }
    
    // Get the language to use for transcription (the interface language, not the target)
    getTranscriptionLanguage() {
        // When translation is enabled, we want to detect in the current language but translate to the other
        // When disabled, we just use the current language
        return this.currentLanguage;
    }
    
    // Get the language for the final output text
    getOutputLanguage() {
        if (this.translateEnabled) {
            // If translation is enabled, output in the opposite of the current UI language
            return this.currentLanguage === 'pt-BR' ? 'en-US' : 'pt-BR';
        } else {
            // If translation is disabled, output in the current UI language
            return this.currentLanguage;
        }
    }
}

// Create a global instance of the translation controller
const translationController = new TranslationController();

// Make it globally accessible
window.translationController = translationController;
