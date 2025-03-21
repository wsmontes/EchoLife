/**
 * Translation dictionary for Echo Life application
 * Contains all translatable text in English and Portuguese
 */

const translations = {
    // Header section
    'app_title': {
        'en-US': 'Echo Life',
        'pt-BR': 'Echo Life'
    },
    'app_tagline': {
        'en-US': 'Speak and connect with AI',
        'pt-BR': 'Fale e conecte-se com a IA'
    },
    'edit_api_key': {
        'en-US': 'Edit API Key',
        'pt-BR': 'Editar Chave API'
    },
    
    // Word cloud section
    'words_appear': {
        'en-US': 'Words will appear as you speak...',
        'pt-BR': 'Palavras aparecerão enquanto você fala...'
    },
    
    // Recording section
    'click_to_start': {
        'en-US': 'Click to start recording',
        'pt-BR': 'Clique para iniciar a gravação'
    },
    'recording': {
        'en-US': 'Recording... Click to stop',
        'pt-BR': 'Gravando... Clique para parar'
    },
    'processing': {
        'en-US': 'Processing...',
        'pt-BR': 'Processando...'
    },
    'transcribing': {
        'en-US': 'Transcribing audio...',
        'pt-BR': 'Transcrevendo áudio...'
    },
    'transcription_failed': {
        'en-US': 'Transcription failed. Try using the upload option.',
        'pt-BR': 'Transcrição falhou. Tente usar a opção de upload.'
    },
    'ios_recording_hint': {
        'en-US': 'Click to record (iOS users: upload option recommended)',
        'pt-BR': 'Clique para gravar (Usuários iOS: opção de upload recomendada)'
    },
    'ios_users_note': {
        'en-US': 'iOS users: upload option recommended',
        'pt-BR': 'Usuários iOS: opção de upload recomendada'
    },
    
    // New translation keys for audio conversion errors
    'audio_conversion_failed': {
        'en-US': 'Audio conversion failed. Try uploading a MP3/WAV file instead.',
        'pt-BR': 'Conversão de áudio falhou. Tente fazer upload de um arquivo MP3/WAV.'
    },
    'audio_format_unsupported': {
        'en-US': 'Audio format not supported. Try a different browser or upload a MP3/WAV file.',
        'pt-BR': 'Formato de áudio não suportado. Tente um navegador diferente ou faça upload de um arquivo MP3/WAV.'
    },
    'audio_too_short': {
        'en-US': 'Audio is too short. Please record at least 0.5 seconds.',
        'pt-BR': 'Áudio muito curto. Por favor, grave pelo menos 0,5 segundos.'
    },
    'audio_too_large': {
        'en-US': 'Audio is too large (max 25MB). Record a shorter clip or use lower quality.',
        'pt-BR': 'Áudio muito grande (máx. 25MB). Grave um clipe mais curto ou use qualidade inferior.'
    },
    
    // Microphone sensitivity translations
    'mic_sensitivity': {
        'en-US': 'Mic Sensitivity',
        'pt-BR': 'Sensibilidade do Mic'
    },
    'auto_sensitivity': {
        'en-US': 'Auto',
        'pt-BR': 'Auto'
    },
    'maximum_sensitivity': {
        'en-US': 'Maximum',
        'pt-BR': 'Máximo'
    },
    
    // Upload section
    'upload_audio': {
        'en-US': 'Upload Audio',
        'pt-BR': 'Carregar Áudio'
    },
    'drop_audio': {
        'en-US': 'Drop audio file here',
        'pt-BR': 'Solte o arquivo de áudio aqui'
    },
    'or': {
        'en-US': 'or',
        'pt-BR': 'ou'
    },
    'click_to_select': {
        'en-US': 'Click to select audio file',
        'pt-BR': 'Clique para selecionar um arquivo de áudio'
    },
    'supported_formats': {
        'en-US': 'Supported formats: MP3, WAV, M4A, AAC, OPUS, OGG',
        'pt-BR': 'Formatos suportados: MP3, WAV, M4A, AAC, OPUS, OGG'
    },
    'whatsapp_support': {
        'en-US': 'WhatsApp voice messages are fully supported.',
        'pt-BR': 'Mensagens de voz do WhatsApp são totalmente suportadas.'
    },
    'whatsapp_hint': {
        'en-US': 'WhatsApp voice messages are fully supported.',
        'pt-BR': 'Mensagens de voz do WhatsApp são totalmente suportadas.'
    },
    
    // AI Response section
    'ai_response': {
        'en-US': 'AI Response',
        'pt-BR': 'Resposta da IA'
    },
    'get_ai_feedback': {
        'en-US': 'Get AI Feedback',
        'pt-BR': 'Obter Feedback da IA'
    },
    
    // Export section
    'export_options': {
        'en-US': 'Export Options',
        'pt-BR': 'Opções de Exportação'
    },
    'export_txt': {
        'en-US': 'Export TXT',
        'pt-BR': 'Exportar TXT'
    },
    'export_srt': {
        'en-US': 'Export SRT',
        'pt-BR': 'Exportar SRT'
    },
    'export_audio': {
        'en-US': 'Export Audio',
        'pt-BR': 'Exportar Áudio'
    },
    'export_video': {
        'en-US': 'Export Video+Subs',
        'pt-BR': 'Exportar Vídeo+Legendas'
    },
    
    // Subtitle preview section
    'subtitle_preview': {
        'en-US': 'Subtitle Preview',
        'pt-BR': 'Pré-visualização de Legendas'
    },
    'subtitles_will_appear': {
        'en-US': 'Subtitles will appear here during playback',
        'pt-BR': 'As legendas aparecerão aqui durante a reprodução'
    },
    'subtitles_appear': {
        'en-US': 'Subtitles will appear here during playback',
        'pt-BR': 'As legendas aparecerão aqui durante a reprodução'
    },
    'close_preview': {
        'en-US': 'Close Preview',
        'pt-BR': 'Fechar Pré-visualização'
    },
    'preview_with_subtitles': {
        'en-US': 'Preview with Subtitles',
        'pt-BR': 'Visualizar com Legendas'
    },
    'preview_subtitles': {
        'en-US': 'Preview with Subtitles',
        'pt-BR': 'Visualizar com Legendas'
    },
    
    // Tags section
    'ai_response_tags': {
        'en-US': 'AI Response Tags',
        'pt-BR': 'Tags de Resposta da IA'
    },
    'tags_will_appear': {
        'en-US': 'Tags from AI responses will appear here',
        'pt-BR': 'Tags das respostas da IA aparecerão aqui'
    },
    'tags_appear': {
        'en-US': 'Tags from AI responses will appear here',
        'pt-BR': 'Tags das respostas da IA aparecerão aqui'
    },
    
    // History section
    'recent_audios': {
        'en-US': 'Recent Audios',
        'pt-BR': 'Áudios Recentes'
    },
    'history_appear': {
        'en-US': 'Your uploaded audio history will appear here',
        'pt-BR': 'Seu histórico de áudios carregados aparecerá aqui'
    },
    'no_response_yet': {
        'en-US': 'No response yet',
        'pt-BR': 'Sem resposta ainda'
    },
    
    // Diagnostic tools
    'test_whisper_api': {
        'en-US': 'Test Whisper API',
        'pt-BR': 'Testar API Whisper'
    },
    'test_whisper': {
        'en-US': 'Test Whisper API',
        'pt-BR': 'Testar API Whisper'
    },
    'testing': {
        'en-US': 'Testing...',
        'pt-BR': 'Testando...'
    },
    
    // Error messages
    'error': {
        'en-US': 'Error',
        'pt-BR': 'Erro'
    },
    'mic_permission_error': {
        'en-US': 'Could not access microphone. Please check permissions.',
        'pt-BR': 'Não foi possível acessar o microfone. Verifique as permissões.'
    },
    'no_audio_recorded': {
        'en-US': 'No audio recorded. Try again.',
        'pt-BR': 'Nenhum áudio gravado. Tente novamente.'
    },
    'audio_processing_error': {
        'en-US': 'Error processing audio: ',
        'pt-BR': 'Erro ao processar áudio: '
    },
    
    // Video export
    'export_for_quicktime': {
        'en-US': 'Export for QuickTime Player',
        'pt-BR': 'Exportar para QuickTime Player'
    },
    'generate_apple_compatible': {
        'en-US': 'Generate Apple-Compatible MP4',
        'pt-BR': 'Gerar MP4 Compatível com Apple'
    },
    'cancel': {
        'en-US': 'Cancel',
        'pt-BR': 'Cancelar'
    },
    
    // Translation toggle
    'translation_enabled_pt': {
        'en-US': 'Translation On',
        'pt-BR': 'Tradução Ativada'
    },
    'translation_disabled_pt': {
        'en-US': 'Translation Off',
        'pt-BR': 'Tradução Desativada'
    },
    'translation_enabled_en': {
        'en-US': 'Translation On',
        'pt-BR': 'Tradução Ativada'
    },
    'translation_disabled_en': {
        'en-US': 'Translation Off',
        'pt-BR': 'Tradução Desativada'
    },
    
    // Copyright text
    'copyright': {
        'en-US': 'Echo Life &copy; 2023',
        'pt-BR': 'Echo Life &copy; 2023'
    }
};

/**
 * Get a translation for a given key and language
 * @param {string} key - The translation key
 * @param {string} language - The language code (defaults to current setting)
 * @returns {string} - The translated text or the key if translation not found
 */
function getTranslation(key, language) {
    // Default to stored language preference if not specified
    if (!language) {
        language = localStorage.getItem('echolife_language') || 'en-US';
    }
    
    // Check if translation exists
    if (translations[key] && translations[key][language]) {
        return translations[key][language];
    }
    
    // Fallback to English if the specific language translation doesn't exist
    if (translations[key] && translations[key]['en-US']) {
        console.warn(`Missing translation for key '${key}' in language '${language}', using English fallback`);
        return translations[key]['en-US'];
    }
    
    // Return the key itself if no translation found
    console.warn(`Translation key not found: ${key}`);
    return key;
}

// Make available globally
window.getTranslation = getTranslation;
window.translations = translations;

// Function to update UI text based on selected language
function updateUILanguage(language) {
    if (!translations) {
        console.error('Translations not loaded');
        return;
    }
    
    // Only proceed with a valid language
    if (language !== 'en-US' && language !== 'pt-BR') {
        console.error('Invalid language:', language);
        return;
    }
    
    try {
        // Update document title
        document.title = getTranslation('app_title', language) + ' - Voice to AI';
        
        // Update app title and tagline
        const appTitle = document.querySelector('header h1');
        const appTagline = document.querySelector('header p');
        
        if (appTitle) appTitle.textContent = getTranslation('app_title', language);
        if (appTagline) appTagline.textContent = getTranslation('app_tagline', language);
        
        // Update API key button
        const apiKeyButton = document.getElementById('editApiKeyButton');
        if (apiKeyButton) {
            const buttonText = getTranslation('edit_api_key', language);
            const iconEl = apiKeyButton.querySelector('i');
            if (iconEl) {
                apiKeyButton.innerHTML = '';
                apiKeyButton.appendChild(iconEl);
                apiKeyButton.append(' ' + buttonText);
            } else {
                apiKeyButton.textContent = buttonText;
            }
        }
        
        // Update word cloud placeholder
        const wordCloudPlaceholder = document.querySelector('.word-cloud-placeholder');
        if (wordCloudPlaceholder) wordCloudPlaceholder.textContent = getTranslation('words_appear', language);
        
        // Update recording section
        const recordingStatus = document.getElementById('recordingStatus');
        if (recordingStatus) {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                recordingStatus.innerHTML = `${getTranslation('click_to_start', language)}<br><small>${getTranslation('ios_users_note', language)}</small>`;
            } else {
                recordingStatus.textContent = getTranslation('click_to_start', language);
            }
        }
        
        // Update upload section
        const uploadTitle = document.querySelector('.audio-drop-section h2');
        if (uploadTitle) uploadTitle.textContent = getTranslation('upload_audio', language);
        
        const dropText = document.querySelector('.drop-text');
        if (dropText) {
            const p1 = dropText.querySelector('p:nth-child(1)');
            const p2 = dropText.querySelector('p:nth-child(2)');
            const p3 = dropText.querySelector('p:nth-child(3)');
            const p4 = dropText.querySelector('p.supported-formats');
            
            if (p1) p1.textContent = getTranslation('drop_audio', language);
            if (p2) p2.textContent = getTranslation('or', language);
            if (p3) p3.textContent = getTranslation('click_to_select', language);
            if (p4) p4.textContent = getTranslation('supported_formats', language);
        }
        
        const whatsappHint = document.querySelector('.whatsapp-hint');
        if (whatsappHint) whatsappHint.textContent = getTranslation('whatsapp_hint', language);
        
        // Update all other sections using getTranslation
        // ...existing updateUILanguage implementation...
        
        // Store selected language in local storage for persistence
        localStorage.setItem('echolife_language', language);
        
        console.log(`UI language updated to: ${language}`);
    } catch (error) {
        console.error('Error updating UI language:', error);
    }
}

// Initialize language from local storage or browser preference
document.addEventListener('DOMContentLoaded', () => {
    // Look for stored preference first
    let language = localStorage.getItem('echolife_language');
    
    // If no stored preference, use browser language
    if (!language) {
        const browserLang = navigator.language || navigator.userLanguage;
        language = browserLang.startsWith('pt') ? 'pt-BR' : 'en-US'; // Default to en-US if not Portuguese
    }
    
    // Update the language selector UI
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        languageSelector.value = language;
    }
    
    // Update the UI with the selected language
    try {
        updateUILanguage(language);
    } catch (error) {
        console.error('Error initializing UI language:', error);
    }
});

// Make these functions globally available
window.updateUILanguage = updateUILanguage;

// Function to get language display names
function getLanguageDisplayName(langCode) {
    switch (langCode) {
        case 'pt-BR': return 'Portuguese (Brazil)';
        case 'en-US': return 'English (US)';
        case 'pt': return 'Portuguese';
        case 'en': return 'English';
        default: return langCode;
    }
}

// Function to detect if text is likely Portuguese
function detectPortuguese(text) {
    if (!text || typeof text !== 'string') return false;
    
    // Portuguese-specific words/patterns
    const portuguesePatterns = [
        /\b(eu|você|ele|ela|nós|eles)\b/i,
        /\b(está|estou|estamos|falar|falando|obrigado|obrigada)\b/i,
        /\b(não|sim|como|quando|onde|porque|quem)\b/i,
        /\b(um|uma|uns|umas|o|a|os|as|do|da|dos|das)\b/i,
        /ção\b|\bções\b|mente\b|\bçã/i,
        /\b(muito|muita|muitos|muitas|pouco|poucas)\b/i
    ];
    
    // Score based on pattern matches
    let score = 0;
    for (const pattern of portuguesePatterns) {
        if (pattern.test(text)) {
            score++;
        }
    }
    
    // Portuguese-specific characters
    const portugueseChars = ['ç', 'ã', 'õ', 'á', 'é', 'í', 'ó', 'ú', 'â', 'ê', 'ô'];
    for (const char of portugueseChars) {
        if (text.includes(char)) {
            score += 2; // Weight these higher as they're very specific to Portuguese
        }
    }
    
    // Return true if score is above a threshold
    // Scale threshold based on text length
    const threshold = Math.min(3, Math.max(1, Math.floor(text.length / 50)));
    return score >= threshold;
}

// Function to get the most likely language of text
function detectTextLanguage(text) {
    if (!text || typeof text !== 'string') return 'en-US'; // Default to English
    
    if (detectPortuguese(text)) {
        return 'pt-BR';
    }
    
    return 'en-US';
}

// Make these functions globally available
window.getLanguageDisplayName = getLanguageDisplayName;
window.detectPortuguese = detectPortuguese;
window.detectTextLanguage = detectTextLanguage;
