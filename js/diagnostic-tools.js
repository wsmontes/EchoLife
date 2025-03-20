/**
 * Diagnostic Tools for EchoLife
 * Provides utilities for debugging and testing app components
 */

// Language diagnostics
function checkLanguageSettings() {
    console.group("Language Diagnostics");
    
    // Check translation controller
    if (window.translationController) {
        const settings = window.translationController.getSettings();
        console.log("Translation Controller Settings:", settings);
    } else {
        console.warn("Translation Controller not found");
    }
    
    // Check iOS speech service
    if (window.iosSpeechService) {
        console.log("iOS Speech Service Available:", window.iosSpeechService.isAvailable);
        console.log("iOS Speech Service Language:", window.iosSpeechService.getLanguage());
    } else {
        console.warn("iOS Speech Service not found");
    }
    
    // Check localStorage
    console.log("localStorage Language:", localStorage.getItem('echolife_language') || 'en-US (default)');
    
    // Check effective language function
    if (window.getEffectiveLanguage) {
        console.log("Effective Language:", window.getEffectiveLanguage());
    } else {
        console.error("getEffectiveLanguage function not found!");
    }
    
    console.groupEnd();
}

// Word cloud diagnostics
function checkWordCloud() {
    console.group("Word Cloud Diagnostics");
    
    if (window.wordCloud) {
        console.log("Word Cloud Initialized:", true);
        console.log("Word Cloud Language:", window.wordCloud.language);
        console.log("Words in Cloud:", window.wordCloud.words.size);
        console.log("Container Size:", 
            window.wordCloud.containerWidth + "x" + window.wordCloud.containerHeight);
    } else {
        console.error("Word Cloud not initialized!");
    }
    
    console.groupEnd();
}

// Test transcription
async function testWhisperTranscription() {
    console.group("Whisper API Transcription Test");
    
    if (!window.transcriptionService) {
        console.error("Transcription service not found!");
        console.groupEnd();
        return;
    }
    
    try {
        const button = document.getElementById('testWhisperButton');
        if (button) {
            const originalText = button.textContent;
            button.textContent = getTranslation('testing', localStorage.getItem('echolife_language') || 'en-US');
            button.disabled = true;
        }
        
        console.log("Testing Whisper API connection...");
        const result = await transcriptionService.testWhisperApiAccess();
        console.log("Test Result:", result);
        
        if (result.success) {
            console.log("%cWhisper API is working! ✓", "color: green; font-weight: bold");
        } else {
            console.error("%cWhisper API test failed! ✗", "color: red; font-weight: bold");
            console.error("Error details:", result.message);
        }
        
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
    } catch (error) {
        console.error("Test failed with exception:", error);
    }
    
    console.groupEnd();
}

// Run all diagnostics
function runAllDiagnostics() {
    console.group("EchoLife Diagnostics");
    console.log("Running diagnostics at:", new Date().toISOString());
    
    // Device info
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    console.log("Device:", {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isIOS: isIOS,
        isAndroid: /android/i.test(navigator.userAgent),
        isMobile: /Mobi/i.test(navigator.userAgent)
    });
    
    checkLanguageSettings();
    checkWordCloud();
    
    console.log("API Key configured:", localStorage.getItem('openai_api_key') ? "Yes" : "No");
    
    // Audio capabilities
    const audioCapabilities = {
        backgroundRecordingSupported: window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function',
        webmSupport: window.MediaRecorder ? MediaRecorder.isTypeSupported('audio/webm') : false,
        mp4Support: window.MediaRecorder ? MediaRecorder.isTypeSupported('audio/mp4') : false,
        wavSupport: window.MediaRecorder ? MediaRecorder.isTypeSupported('audio/wav') : false
    };
    console.log("Audio Capabilities:", audioCapabilities);
    
    console.groupEnd();
}

// Add diagnostic button to the page if in development
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in development mode
    const isDev = window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' ||
                 window.location.hostname.includes('.local');
    
    if (isDev) {
        const footer = document.querySelector('footer');
        if (footer) {
            const diagButton = document.createElement('button');
            diagButton.textContent = 'Run Diagnostics';
            diagButton.style.marginTop = '20px';
            diagButton.style.padding = '8px 16px';
            diagButton.style.backgroundColor = '#f1f3f5';
            diagButton.style.border = '1px solid #dee2e6';
            diagButton.style.borderRadius = '4px';
            diagButton.style.cursor = 'pointer';
            
            diagButton.addEventListener('click', runAllDiagnostics);
            
            footer.appendChild(diagButton);
            
            // Add Whisper test button
            const whisperButton = document.createElement('button');
            whisperButton.id = 'testWhisperButton';
            whisperButton.textContent = 'Test Whisper API';
            whisperButton.style.marginTop = '10px';
            whisperButton.style.marginLeft = '10px';
            whisperButton.style.padding = '8px 16px';
            whisperButton.style.backgroundColor = '#e9ecef';
            whisperButton.style.border = '1px solid #dee2e6';
            whisperButton.style.borderRadius = '4px';
            whisperButton.style.cursor = 'pointer';
            
            whisperButton.addEventListener('click', testWhisperTranscription);
            
            footer.appendChild(whisperButton);
        }
    }
    
    // Run quick language check on startup to detect issues
    setTimeout(() => {
        try {
            console.log("[DIAGNOSTIC] Startup language check:", window.getEffectiveLanguage());
        } catch (e) {
            console.error("[DIAGNOSTIC] Startup language check failed:", e);
        }
    }, 2000);
});

// Export diagnostic functions
window.diagnostics = {
    checkLanguageSettings,
    checkWordCloud,
    testWhisperTranscription,
    runAllDiagnostics
};
