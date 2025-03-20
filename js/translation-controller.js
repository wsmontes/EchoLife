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
        
        // Update other services directly
        this.updateServices();
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
        
        // Update services directly
        this.updateServices();
        
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
        
        // Update services directly
        this.updateServices();
        
        console.log(`Translation toggle changed to: ${translateEnabled}`);
    }
    
    updateToggleLabel() {
        if (!this.translationToggleLabel) return;
        
        const language = this.currentLanguage === 'pt-BR' ? 'pt-BR' : 'en-US';
        
        // Determine the appropriate translation key based on current state
        const key = this.translateEnabled ? 
            (language === 'pt-BR' ? 'translation_enabled_pt' : 'translation_enabled_en') :
            (language === 'pt-BR' ? 'translation_disabled_pt' : 'translation_disabled_en');
        
        // Use the translation system for consistency
        this.translationToggleLabel.textContent = getTranslation(key, language);
    }
    
    updateServices() {
        // Directly update Chat service if available
        if (window.chatService) {
            window.chatService.setLanguage(this.currentLanguage);
        }
        
        // Update iOS speech service if available
        if (window.iosSpeechService && window.iosSpeechService.isAvailable) {
            window.iosSpeechService.setLanguage(this.currentLanguage);
        }
        
        // Update speech recognition if available
        if (window.speechRecognition) {
            window.speechRecognition.lang = this.currentLanguage;
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
            // The source language for speech/input is always the UI language
            sourceLanguage: this.currentLanguage,
            // The target language depends on whether translation is enabled
            targetLanguage: this.translateEnabled ? 
                (this.currentLanguage === 'pt-BR' ? 'en-US' : 'pt-BR') : 
                this.currentLanguage
        };
    }
    
    // Get the language to use for transcription (the interface language, not the target)
    getTranscriptionLanguage() {
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
    
    // Utility method to get human-readable language name
    getLanguageName(langCode = null) {
        if (!langCode) langCode = this.currentLanguage;
        
        switch (langCode) {
            case 'pt-BR': return 'Portuguese (Brazil)';
            case 'en-US': return 'English (US)';
            default: return langCode;
        }
    }
}

// Create a global instance of the translation controller
const translationController = new TranslationController();

// Make it globally accessible
window.translationController = translationController;
