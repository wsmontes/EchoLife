/**
 * Translation Controller for Echo Life
 * Manages translation preferences and language settings
 */

class TranslationController {
    constructor() {
        this.language = localStorage.getItem('echolife_language') || 'en-US';
        this.translateEnabled = localStorage.getItem('echolife_translate_enabled') === 'true';
        
        this.toggleLabel = document.getElementById('translationToggleLabel');
        this.languageSelector = document.getElementById('languageSelector');
        this.translationToggle = document.getElementById('translationToggle');
        
        this.init();
    }
    
    init() {
        // Set initial state
        if (this.languageSelector) {
            this.languageSelector.value = this.language;
        }
        
        if (this.translationToggle) {
            this.translationToggle.checked = this.translateEnabled;
        }
        
        // Update the toggle label based on current language
        this.updateToggleLabel();
        
        // Translate all interface elements on initialization
        this.translateInterface();
        
        // Set up event listeners
        if (this.languageSelector) {
            this.languageSelector.addEventListener('change', (e) => {
                this.language = e.target.value;
                localStorage.setItem('echolife_language', this.language);
                this.updateToggleLabel();
                
                // Translate all interface elements
                this.translateInterface();
                
                // Dispatch language changed event
                window.dispatchEvent(new CustomEvent('languageChanged', {
                    detail: { language: this.language }
                }));
                
                // Dispatch combined settings event
                this.dispatchSettingsChanged();
            });
        }
        
        if (this.translationToggle) {
            this.translationToggle.addEventListener('change', (e) => {
                this.translateEnabled = e.target.checked;
                localStorage.setItem('echolife_translate_enabled', this.translateEnabled);
                
                // Dispatch translation settings event
                this.dispatchSettingsChanged();
            });
        }
    }
    
    updateToggleLabel() {
        if (this.toggleLabel) {
            this.toggleLabel.textContent = this.language === 'pt-BR' ? 'Tradução' : 'Translate';
        }
    }
    
    // Translate the entire interface based on current language
    translateInterface() {
        // Header section
        this.updateElementText('header h1', 'app_title');
        this.updateElementText('header p', 'app_tagline');
        this.updateElementText('#editApiKeyButton', 'edit_api_key');
        
        // Word cloud placeholder
        this.updateElementText('.word-cloud-placeholder', 'words_appear');
        
        // Recording section
        this.updateElementText('#recordingStatus', 'click_to_start');
        
        // Upload section
        this.updateElementText('.audio-drop-section h2', 'upload_audio');
        this.updateElementText('.drop-text p:nth-child(1)', 'drop_audio', '.drop-text');
        this.updateElementText('.drop-text p:nth-child(2)', 'or', '.drop-text');
        this.updateElementText('.drop-text p:nth-child(3)', 'click_to_select', '.drop-text');
        this.updateElementText('.drop-text p.supported-formats', 'supported_formats', '.drop-text');
        this.updateElementText('.whatsapp-hint', 'whatsapp_support');
        
        // Chat section
        this.updateElementText('.chat-section h2', 'ai_response');
        this.updateElementText('#feedbackButton', 'get_ai_feedback');
        
        // Export section
        this.updateElementText('.export-container h3', 'export_options');
        this.updateElementText('#exportTxtBtn', 'export_txt');
        this.updateElementText('#exportSrtBtn', 'export_srt');
        this.updateElementText('#exportAudioBtn', 'export_audio');
        this.updateElementText('#exportVideoBtn', 'export_video');
        
        // Subtitle preview
        this.updateElementText('.subtitle-preview-container h4', 'subtitle_preview');
        this.updateElementText('#previewSubtitleDisplay', 'subtitles_will_appear');
        this.updateElementText('#closePreviewBtn', 'close_preview');
        this.updateElementText('#previewSubtitlesBtn', 'preview_with_subtitles');
        
        // Tags section
        this.updateElementText('.tag-section h3', 'ai_response_tags');
        this.updateElementText('.tag-placeholder', 'tags_will_appear');
        
        // History section
        this.updateElementText('.audio-history-section h2', 'recent_audios');
        this.updateElementText('.empty-history-message', 'history_appear');
        
        // Update all "No response yet" badges if present
        document.querySelectorAll('.no-response-badge').forEach(badge => {
            badge.textContent = getTranslation('no_response_yet', this.language);
        });
        
        // Diagnostic tools
        this.updateElementText('#testWhisperButton', 'test_whisper_api');
    }
    
    // Helper method to update text of an element if it exists
    updateElementText(selector, translationKey, parentSelector = null) {
        let elements;
        
        if (parentSelector) {
            const parents = document.querySelectorAll(parentSelector);
            if (!parents || parents.length === 0) return;
            
            elements = [];
            parents.forEach(parent => {
                const matches = parent.querySelectorAll(selector);
                if (matches) {
                    matches.forEach(el => elements.push(el));
                }
            });
        } else {
            elements = document.querySelectorAll(selector);
        }
        
        if (!elements || elements.length === 0) return;
        
        elements.forEach(element => {
            // Only update text nodes, preserve any child elements
            if (element.childNodes.length === 0 || 
                (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE)) {
                element.textContent = getTranslation(translationKey, this.language);
            } else {
                // For elements with children, find the text nodes and update them
                for (let i = 0; i < element.childNodes.length; i++) {
                    if (element.childNodes[i].nodeType === Node.TEXT_NODE) {
                        // Only update non-empty text nodes
                        if (element.childNodes[i].textContent.trim()) {
                            // Get text content of the entire element first
                            const fullText = element.textContent;
                            // Find icon or span elements (to preserve)
                            const iconEl = element.querySelector('i, span');
                            
                            // Get the translated text
                            const translated = getTranslation(translationKey, this.language);
                            
                            // If there's an icon, make sure to keep it
                            if (iconEl) {
                                // Reset the content to just the translated text
                                element.textContent = translated;
                                // Re-add the icon at the beginning
                                element.prepend(iconEl);
                                // Add a space after the icon
                                if (iconEl.nextSibling && iconEl.nextSibling.nodeType === Node.TEXT_NODE) {
                                    iconEl.nextSibling.textContent = ' ' + iconEl.nextSibling.textContent.trim();
                                }
                            } else {
                                // No icon, just update the text
                                element.textContent = translated;
                            }
                            
                            break;
                        }
                    }
                }
            }
        });
    }
    
    dispatchSettingsChanged() {
        window.dispatchEvent(new CustomEvent('translationSettingsChanged', {
            detail: {
                language: this.language,
                translateEnabled: this.translateEnabled,
                targetLanguage: this.language === 'pt-BR' ? 'en-US' : 'pt-BR'
            }
        }));
    }
    
    getSettings() {
        return {
            language: this.language,
            translateEnabled: this.translateEnabled,
            targetLanguage: this.language === 'pt-BR' ? 'en-US' : 'pt-BR'
        };
    }
}

// Initialize the translation controller when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.translationController = new TranslationController();
});
