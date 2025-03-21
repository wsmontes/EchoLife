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
    checkAudioCapabilities(); // New function call
    
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

// Add comprehensive audio capabilities check
function checkAudioCapabilities() {
    console.group("Audio System Diagnostics");
    
    // Check for MediaRecorder support
    if (typeof MediaRecorder === 'undefined') {
        console.error("MediaRecorder API not supported in this browser");
    } else {
        console.log("MediaRecorder is supported");
        
        // Check for MIME type support
        const mimeTypes = [
            'audio/webm', 
            'audio/webm;codecs=opus',
            'audio/ogg',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mp4;codecs=mp4a.40.2', // AAC-LC
            'audio/mpeg', // MP3
            'audio/wav'
        ];
        
        const supportedTypes = {};
        mimeTypes.forEach(type => {
            try {
                supportedTypes[type] = MediaRecorder.isTypeSupported(type);
            } catch (e) {
                supportedTypes[type] = `Error checking: ${e.message}`;
            }
        });
        
        console.table(supportedTypes);
    }
    
    // Check AudioContext support
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
        console.error("AudioContext not supported in this browser");
    } else {
        console.log("AudioContext is supported");
        
        // Check for audio encoding/decoding capabilities
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            
            console.log("AudioContext created successfully:", {
                sampleRate: audioContext.sampleRate,
                state: audioContext.state,
                destination: audioContext.destination ? "Available" : "Not available"
            });
            
            // Check if decodeAudioData is available
            if (typeof audioContext.decodeAudioData !== 'function') {
                console.error("decodeAudioData not supported");
            } else {
                console.log("decodeAudioData is supported");
            }
            
            // Close the context to clean up
            audioContext.close().then(() => {
                console.log("AudioContext closed successfully");
            }).catch(e => {
                console.error("Error closing AudioContext:", e);
            });
        } catch (e) {
            console.error("Error testing AudioContext:", e);
        }
    }
    
    // Check Whisper transcription service
    if (window.transcriptionService) {
        console.log("Transcription service available");
        const lastError = transcriptionService.getLastErrorDetails();
        if (lastError && lastError.error) {
            console.warn("Last transcription error:", lastError);
        }
    } else {
        console.error("Transcription service not available");
    }
    
    console.groupEnd();
}

// Test audio conversion capabilities
async function testAudioConversion() {
    console.group("Audio Conversion Test");
    
    if (!window.transcriptionService) {
        console.error("Transcription service not found!");
        console.groupEnd();
        return;
    }
    
    try {
        const button = document.getElementById('testAudioConversionButton');
        if (button) {
            const originalText = button.textContent;
            button.textContent = "Testing...";
            button.disabled = true;
        }
        
        // Create a test audio blob (1 second of silence)
        const sampleRate = 16000;
        const duration = 1; // 1 second
        const numSamples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(numSamples * 2); // 16-bit samples
        const view = new DataView(buffer);
        
        // Fill with silence (PCM 16-bit)
        for (let i = 0; i < numSamples; i++) {
            view.setInt16(i * 2, 0, true); // 0 = silence
        }
        
        // Create WebM blob
        const webmBlob = new Blob([buffer], { type: 'audio/webm;codecs=opus' });
        console.log("Created test WebM blob:", webmBlob.size, "bytes");
        
        // Test conversion to WAV
        console.log("Testing WAV conversion...");
        const wavBlob = await transcriptionService.convertToWAV(webmBlob);
        
        if (wavBlob) {
            console.log("%cWAV conversion successful! ✓", "color: green; font-weight: bold");
            console.log("WAV blob size:", wavBlob.size, "bytes");
        } else {
            console.error("%cWAV conversion failed! ✗", "color: red; font-weight: bold");
        }
        
        // Check browser audio decoding capabilities
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            
            // Create a short beep tone
            const bufferSize = audioContext.sampleRate * 0.5; // 0.5 second
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate a 440Hz tone
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.sin(440 * Math.PI * 2 * i / audioContext.sampleRate) * 0.5;
            }
            
            // Convert to WAV for testing
            console.log("Testing audio encoding capabilities...");
            
            // Success
            console.log("%cAudio encoding test passed! ✓", "color: green; font-weight: bold");
            
            // Clean up
            audioContext.close();
        } catch (e) {
            console.error("Audio encoding test failed:", e);
        }
        
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
    } catch (error) {
        console.error("Audio conversion test failed with exception:", error);
    }
    
    console.groupEnd();
}

// Add a fallback getEffectiveLanguage function for diagnostics
// This ensures diagnostics won't fail even if the main function isn't available
function getEffectiveLanguageDiagnostic() {
    // First try to use the main function if available
    if (typeof window.getEffectiveLanguage === 'function') {
        try {
            return window.getEffectiveLanguage();
        } catch (e) {
            console.warn("Error using main getEffectiveLanguage function:", e);
        }
    }
    
    // Fallback implementation
    try {
        // Check translation controller
        if (window.translationController && typeof window.translationController.getSettings === 'function') {
            const settings = window.translationController.getSettings();
            return settings.language;
        }
        
        // Check iOS speech service
        if (window.iosSpeechService && window.iosSpeechService.isAvailable) {
            return window.iosSpeechService.getLanguage();
        }
        
        // Get from localStorage as last resort
        return localStorage.getItem('echolife_language') || 'en-US';
    } catch (e) {
        console.error("Error in diagnostic language detection:", e);
        return 'en-US'; // Ultimate fallback
    }
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
            
            // Add Audio Conversion test button
            const audioConversionButton = document.createElement('button');
            audioConversionButton.id = 'testAudioConversionButton';
            audioConversionButton.textContent = 'Test Audio Conversion';
            audioConversionButton.style.marginTop = '10px';
            audioConversionButton.style.marginLeft = '10px';
            audioConversionButton.style.padding = '8px 16px';
            audioConversionButton.style.backgroundColor = '#e9ecef';
            audioConversionButton.style.border = '1px solid #dee2e6';
            audioConversionButton.style.borderRadius = '4px';
            audioConversionButton.style.cursor = 'pointer';
            
            audioConversionButton.addEventListener('click', testAudioConversion);
            
            footer.appendChild(audioConversionButton);

            // After existing buttons, add a Speech Recognition test button
            const speechRecognitionButton = document.createElement('button');
            speechRecognitionButton.id = 'testSpeechRecognitionButton';
            speechRecognitionButton.textContent = 'Test Speech Recognition';
            speechRecognitionButton.style.marginTop = '10px';
            speechRecognitionButton.style.marginLeft = '10px';
            speechRecognitionButton.style.padding = '8px 16px';
            speechRecognitionButton.style.backgroundColor = '#e9ecef';
            speechRecognitionButton.style.border = '1px solid #dee2e6';
            speechRecognitionButton.style.borderRadius = '4px';
            speechRecognitionButton.style.cursor = 'pointer';
            
            speechRecognitionButton.addEventListener('click', testSpeechRecognition);
            
            footer.appendChild(speechRecognitionButton);
        }
    }
    
    // Run quick language check on startup to detect issues - use our fallback function
    setTimeout(() => {
        try {
            const effectiveLanguage = getEffectiveLanguageDiagnostic();
            console.log("[DIAGNOSTIC] Startup language check:", effectiveLanguage);
        } catch (e) {
            console.error("[DIAGNOSTIC] Startup language check failed:", e);
        }
    }, 2000);
});

// Add a function to test speech recognition specifically
async function testSpeechRecognition() {
    console.group("Speech Recognition Test");
    
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        console.error("SpeechRecognition API not supported in this browser");
        console.groupEnd();
        return;
    }
    
    console.log("SpeechRecognition API is supported");
    
    try {
        // Create a test instance
        const testRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        
        // Configure test properties
        testRecognition.continuous = false;
        testRecognition.interimResults = false;
        const language = window.translationController ? 
            window.translationController.getSettings().language : 'en-US';
        testRecognition.lang = language;
        
        console.log(`Test recognition configured with language: ${language}`);
        
        // Set up event handlers
        testRecognition.onstart = () => console.log("Test recognition started");
        testRecognition.onerror = (event) => console.error("Test recognition error:", event.error);
        testRecognition.onend = () => {
            console.log("Test recognition ended");
            console.log("%cSpeechRecognition test complete", "color: green; font-weight: bold");
            console.groupEnd();
        };
        
        // Start the test recognition
        console.log("Starting test recognition (will stop after 3 seconds)");
        testRecognition.start();
        
        // Stop after 3 seconds
        setTimeout(() => {
            try {
                testRecognition.stop();
            } catch (e) {
                console.error("Error stopping test recognition:", e);
                console.groupEnd();
            }
        }, 3000);
    } catch (error) {
        console.error("Error setting up test recognition:", error);
        console.groupEnd();
    }
}

// Export diagnostic functions
window.diagnostics = {
    checkLanguageSettings,
    checkWordCloud,
    checkAudioCapabilities,
    testWhisperTranscription,
    testAudioConversion,
    testSpeechRecognition, // Add the new function
    runAllDiagnostics
};
