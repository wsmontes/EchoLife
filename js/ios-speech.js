/**
 * iOS Speech Recognition Service
 * Uses the Web SpeechRecognition API which leverages native iOS speech recognition on iOS devices
 */
class IOSSpeechService {
    constructor() {
        // Check if this is an iOS device first
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // Only try to use speech recognition if on iOS
        this.isAvailable = this.isIOS && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
        this.recognition = null;
        this.isListening = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.iosVersion = this.getIOSVersion();
        
        // Enhanced transcript collection
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.allResults = []; // Track all final results for complete transcript
        this.transcriptBuffer = [];  // Buffer to store all recognized segments
        this.recognitionInProgress = false;
        this.lastProcessedIndex = 0;
        
        // Event callbacks
        this.onTranscriptUpdate = null;
        this.onFinalTranscript = null;
        this.onError = null;
        
        // Store current language setting and make it visible for debugging
        this.currentLanguage = localStorage.getItem('echolife_language') || 'en-US';
        
        // Initialize only if available AND on iOS
        if (this.isAvailable && this.isIOS) {
            this.initialize();
            console.log(`iOS Speech Service initialized. Version: ${this.iosVersion || 'unknown'}, Language: ${this.currentLanguage}`);
        } else {
            // For safety, on non‐iOS or if not available log and set recognition to null
            console.warn('iOS native speech recognition is not available on this device.');
            this.recognition = null;
        }
    }
    
    getIOSVersion() {
        if (this.isIOS) {
            const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
            return match ? parseInt(match[1], 10) : null;
        }
        return null;
    }
    
    initialize() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            // Configure recognition
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            
            // Get the user's language preference
            this.currentLanguage = localStorage.getItem('echolife_language') || 'en-US';
            this.recognition.lang = this.currentLanguage; // Set to the user's preferred language
            
            this.recognition.maxAlternatives = 1;
            
            // Set up event handlers
            this.recognition.onresult = this.handleResult.bind(this);
            this.recognition.onerror = this.handleError.bind(this);
            this.recognition.onend = this.handleEnd.bind(this);
            
            console.log(`iOS Speech Recognition initialized with language: ${this.currentLanguage}`);
        } catch (e) {
            console.error("Failed to initialize iOS Speech Recognition:", e);
            this.isAvailable = false;
        }
    }
    
    handleResult(event) {
        // Improved result handling to ensure complete transcript
        const results = Array.from(event.results);
        
        // Process all results from the lastProcessedIndex
        let interimText = '';
        let hasNewFinal = false;
        
        // Debug info to track what's happening
        console.log(`Processing results: ${this.lastProcessedIndex} to ${results.length-1}`);
        
        for (let i = this.lastProcessedIndex; i < results.length; i++) {
            const result = results[i];
            const transcript = result[0].transcript.trim();
            
            if (result.isFinal) {
                // Store all final results in our buffer
                this.transcriptBuffer.push(transcript);
                this.allResults.push(transcript);
                hasNewFinal = true;
                console.log(`Final segment added: "${transcript}"`);
            } else {
                interimText += transcript + ' ';
            }
        }
        
        // Update the last processed index to avoid reprocessing
        this.lastProcessedIndex = results.length;
        
        // Reconstruct the final transcript from the buffer
        this.finalTranscript = this.transcriptBuffer.join(' ');
        this.interimTranscript = interimText;
        
        // Update the combined transcript for immediate access
        const combinedTranscript = this.finalTranscript + ' ' + this.interimTranscript;
        
        // Debug
        if (hasNewFinal) {
            console.log(`Updated final transcript (${this.transcriptBuffer.length} segments)`, this.finalTranscript);
        }
        
        // Call update callback with both transcripts
        if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(this.finalTranscript, this.interimTranscript);
        }
    }
    
    handleError(event) {
        console.error('iOS Speech Recognition error:', event.error);
        
        // Don't treat 'no-speech' as an error - it's a normal outcome
        if (event.error !== 'no-speech' && this.onError) {
            this.onError(event.error);
        }
        
        // Auto-restart on network errors or permission errors if still supposed to be listening
        if (this.isListening && (event.error === 'network' || event.error === 'service-not-allowed' || event.error === 'not-allowed')) {
            console.log('Attempting to restart iOS Speech Recognition after error');
            setTimeout(() => this.restartListening(), 1000);
        }
    }
    
    handleEnd() {
        console.log('iOS Speech Recognition ended');
        this.recognitionInProgress = false;
        
        // When recognition ends, make sure we've included all final segments
        this.ensureCompleteTranscript();
        
        // Auto-restart if we're still supposed to be listening
        if (this.isListening) {
            console.log('Auto-restarting iOS Speech Recognition');
            this.restartListening();
        } else if (this.onFinalTranscript) {
            // If we're done listening, provide the final transcript
            console.log(`Providing final transcript (${this.transcriptBuffer.length} segments):`, this.finalTranscript);
            this.onFinalTranscript(this.finalTranscript);
        }
    }
    
    ensureCompleteTranscript() {
        // Make sure our final transcript includes everything
        if (this.allResults.length > this.transcriptBuffer.length) {
            console.log("Adding missed segments to final transcript");
            this.transcriptBuffer = [...this.allResults];
            this.finalTranscript = this.transcriptBuffer.join(' ');
        }
    }
    
    restartListening() {
        if (this.isListening && !this.recognitionInProgress) {
            // Small delay before restarting to prevent rapid start/stop cycles
            setTimeout(() => {
                try {
                    this.recognition.start();
                    this.recognitionInProgress = true;
                    console.log('iOS Speech Recognition restarted');
                } catch (e) {
                    console.error('Failed to restart iOS Speech Recognition:', e);
                    
                    // If already running error, try stopping first
                    if (e.name === 'InvalidStateError') {
                        try {
                            this.recognition.stop();
                            setTimeout(() => {
                                this.recognition.start();
                                this.recognitionInProgress = true;
                            }, 500);
                        } catch (stopError) {
                            console.error('Error during restart sequence:', stopError);
                        }
                    }
                }
            }, 300);
        }
    }
    
    startListening() {
        if (!this.isAvailable || !this.recognition) {
            console.log("iOS Speech Recognition not available");
            return false;
        }
        
        try {
            // Reset transcript and related state
            this.finalTranscript = '';
            this.interimTranscript = '';
            this.transcriptBuffer = [];
            this.allResults = [];
            this.lastProcessedIndex = 0;
            
            // Start recognition
            this.recognition.start();
            this.isListening = true;
            this.recognitionInProgress = true;
            console.log('iOS Speech Recognition started');
            return true;
        } catch (e) {
            console.error('Error starting iOS Speech Recognition:', e);
            
            // Try to handle "already running" error
            if (e.name === 'InvalidStateError') {
                try {
                    console.log("Recognition already running, stopping and restarting");
                    this.recognition.stop();
                    setTimeout(() => {
                        try {
                            this.recognition.start();
                            this.isListening = true;
                            this.recognitionInProgress = true;
                            console.log("Recognition restarted successfully");
                        } catch (startError) {
                            console.error("Error restarting recognition:", startError);
                            this.isAvailable = false; // Mark as unavailable if we can't restart
                            return false;
                        }
                    }, 300);
                    return true;
                } catch (stopError) {
                    console.error('Error in stop-start sequence:', stopError);
                    this.isAvailable = false; // Mark as unavailable if we can't recover
                }
            }
            
            return false;
        }
    }
    
    stopListening() {
        if (!this.isAvailable || !this.recognition) {
            return this.finalTranscript || '';
        }
        
        try {
            this.isListening = false;
            
            // Make sure to include all segments before stopping
            this.ensureCompleteTranscript();
            
            console.log(`Stopping iOS Speech Recognition with transcript (${this.transcriptBuffer.length} segments):`, this.finalTranscript);
            this.recognition.stop();
            
            return this.finalTranscript;
        } catch (e) {
            console.error('Error stopping iOS Speech Recognition:', e);
            return this.finalTranscript; // Return what we have anyway
        }
    }
    
    // Set the callback for real-time transcript updates
    setTranscriptUpdateCallback(callback) {
        this.onTranscriptUpdate = callback;
    }
    
    // Set the callback for the final transcript
    setFinalTranscriptCallback(callback) {
        this.onFinalTranscript = callback;
    }
    
    // Set the callback for errors
    setErrorCallback(callback) {
        this.onError = callback;
    }
    
    // Check if this should be the preferred transcription method
    isPreferredMethod() {
        // Use iOS speech recognition as the preferred method ONLY on iOS devices where it's available
        return this.isIOS && this.isAvailable;
    }
    
    // Get the current transcript (both final and interim)
    getCurrentTranscript() {
        return {
            final: this.finalTranscript,
            interim: this.interimTranscript,
            combined: this.finalTranscript + this.interimTranscript
        };
    }
    
    // Add method to update recognition language
    setLanguage(languageCode) {
        if (this.recognition) {
            // Store the language for reference by other components
            this.currentLanguage = languageCode;
            this.recognition.lang = languageCode;
            console.log(`iOS Speech Recognition language set to: ${languageCode}`);
            
            // Restart recognition if it's active to apply the new language
            if (this.isListening && this.recognitionInProgress) {
                try {
                    this.recognition.stop();
                    setTimeout(() => {
                        try {
                            this.recognition.start();
                            console.log('Restarted iOS Speech Recognition with new language');
                        } catch (e) {
                            console.error('Error starting iOS Speech Recognition after language change:', e);
                        }
                    }, 300);
                } catch (e) {
                    console.error('Error stopping iOS Speech Recognition for language change:', e);
                }
            }
        }
    }

    // Get the current language
    getLanguage() {
        return this.currentLanguage;
    }
}

// Create a global instance - safe for all platforms
const iosSpeechService = new IOSSpeechService();

// Make it globally available
window.iosSpeechService = iosSpeechService;
