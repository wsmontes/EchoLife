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
        
        // Event callbacks
        this.onTranscriptUpdate = null;
        this.onFinalTranscript = null;
        this.onError = null;
        
        // Initialize only if available AND on iOS
        if (this.isAvailable && this.isIOS) {
            this.initialize();
            console.log(`iOS Speech Service initialized. Version: ${this.iosVersion || 'unknown'}`);
        } else if (this.isIOS) {
            console.log('iOS device detected but Speech Recognition is not available');
        } else {
            console.log('Non-iOS device - iOS Speech Service will not be used');
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
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US'; // Default to English
        
        // Set up event handlers
        this.recognition.onresult = this.handleResult.bind(this);
        this.recognition.onerror = this.handleError.bind(this);
        this.recognition.onend = this.handleEnd.bind(this);
    }
    
    handleResult(event) {
        let interim = '';
        let final = this.finalTranscript;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final += transcript + ' ';
            } else {
                interim += transcript;
            }
        }
        
        this.finalTranscript = final;
        this.interimTranscript = interim;
        
        // Call update callback with both transcripts
        if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(final, interim);
        }
    }
    
    handleError(event) {
        console.error('iOS Speech Recognition error:', event.error);
        
        // Don't treat 'no-speech' as an error - it's a normal outcome
        if (event.error !== 'no-speech' && this.onError) {
            this.onError(event.error);
        }
        
        // Auto-restart on network errors if still supposed to be listening
        if (this.isListening && (event.error === 'network' || event.error === 'service-not-allowed')) {
            console.log('Attempting to restart iOS Speech Recognition after error');
            setTimeout(() => this.restartListening(), 1000);
        }
    }
    
    handleEnd() {
        console.log('iOS Speech Recognition ended');
        
        // Auto-restart if we're still supposed to be listening
        if (this.isListening) {
            console.log('Auto-restarting iOS Speech Recognition');
            this.restartListening();
        } else if (this.onFinalTranscript) {
            // If we're done listening, provide the final transcript
            this.onFinalTranscript(this.finalTranscript);
        }
    }
    
    restartListening() {
        if (this.isListening) {
            try {
                this.recognition.start();
                console.log('iOS Speech Recognition restarted');
            } catch (e) {
                console.error('Failed to restart iOS Speech Recognition:', e);
                
                // If already running error, try stopping first
                if (e.name === 'InvalidStateError') {
                    try {
                        this.recognition.stop();
                        setTimeout(() => {
                            this.recognition.start();
                        }, 500);
                    } catch (stopError) {
                        console.error('Error during restart sequence:', stopError);
                    }
                }
            }
        }
    }
    
    startListening() {
        if (!this.isAvailable || !this.recognition) {
            return false;
        }
        
        try {
            // Reset transcript
            this.finalTranscript = '';
            this.interimTranscript = '';
            
            // Start recognition
            this.recognition.start();
            this.isListening = true;
            console.log('iOS Speech Recognition started');
            return true;
        } catch (e) {
            console.error('Error starting iOS Speech Recognition:', e);
            
            // Try to handle "already running" error
            if (e.name === 'InvalidStateError') {
                try {
                    this.recognition.stop();
                    setTimeout(() => {
                        this.recognition.start();
                        this.isListening = true;
                    }, 500);
                    return true;
                } catch (stopError) {
                    console.error('Error in stop-start sequence:', stopError);
                }
            }
            
            return false;
        }
    }
    
    stopListening() {
        if (!this.isAvailable || !this.recognition) {
            return false;
        }
        
        try {
            this.isListening = false;
            this.recognition.stop();
            console.log('iOS Speech Recognition stopped');
            
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
}

// Create a global instance - safe for all platforms
const iosSpeechService = new IOSSpeechService();

// Make it globally available
window.iosSpeechService = iosSpeechService;
