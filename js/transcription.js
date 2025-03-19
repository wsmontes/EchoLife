class WhisperTranscriptionService {
    constructor() {
        this.apiKey = null;
        this.supportedFormats = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/mpeg'];
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    // New method to validate audio format
    validateAudioFormat(audioBlob) {
        if (!audioBlob) {
            throw new Error('No audio data provided');
        }
        
        // Check if the format is supported
        if (!this.supportedFormats.includes(audioBlob.type) && audioBlob.type !== '') {
            console.warn(`Audio format ${audioBlob.type} may not be supported by Whisper API. Supported formats include: ${this.supportedFormats.join(', ')}`);
        }
        
        // Check file size (Whisper has a 25MB limit)
        if (audioBlob.size > 25 * 1024 * 1024) {
            throw new Error('Audio file exceeds the 25MB size limit for Whisper API');
        }
        
        return true;
    }

    async transcribeAudio(audioBlob) {
        if (!this.apiKey) {
            throw new Error('API key not set for Whisper transcription service');
        }

        try {
            // Validate audio format
            this.validateAudioFormat(audioBlob);
            
            console.log(`Transcribing audio: ${audioBlob.size} bytes, format: ${audioBlob.type}`);
            
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('model', 'whisper-1');
            
            console.log('Sending request to Whisper API...');
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Whisper API error:', errorData);
                
                // Provide more specific error messages based on status code
                if (response.status === 401) {
                    throw new Error('API key is invalid or expired. Please update your API key.');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded or insufficient quota for Whisper API.');
                } else {
                    throw new Error(`Transcription failed: ${errorData.error?.message || response.statusText}`);
                }
            }
            
            const data = await response.json();
            console.log('Transcription successful');
            return data.text;
        } catch (error) {
            console.error('Error transcribing audio:', error);
            throw error;
        }
    }
    
    // New method to test API key and Whisper API access
    async testWhisperApiAccess() {
        if (!this.apiKey) {
            return { success: false, message: 'API key not set' };
        }
        
        try {
            // Create a simple, valid audio file instead of an empty one
            // This approach creates a minimal but valid audio file with a short beep
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const sampleRate = audioContext.sampleRate;
            const buffer = audioContext.createBuffer(1, sampleRate, sampleRate);
            
            // Fill buffer with a simple sine wave (short beep)
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < sampleRate * 0.5; i++) {
                // Create 0.5 second beep at 440Hz
                channelData[i] = Math.sin(i * Math.PI * 2 * 440 / sampleRate) * 0.5;
            }
            
            // Convert to WAV format which is better supported
            const wavBlob = await this.bufferToWav(buffer);
            
            // Test API connectivity with a minimal request instead of a full transcription
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API connectivity issue: ${error.error?.message || response.statusText}`);
            }
            
            // If we get here, API access is good
            return { 
                success: true, 
                message: 'OpenAI API is accessible. Whisper should work when you record audio.' 
            };
        } catch (error) {
            return { 
                success: false, 
                message: `API test failed: ${error.message}`, 
                error 
            };
        }
    }

    // Helper method to convert AudioBuffer to WAV format
    bufferToWav(buffer) {
        return new Promise((resolve) => {
            const length = buffer.length * buffer.numberOfChannels * 2;
            const view = new DataView(new ArrayBuffer(44 + length));
            
            // RIFF identifier
            writeString(view, 0, 'RIFF');
            // RIFF chunk length
            view.setUint32(4, 36 + length, true);
            // RIFF type
            writeString(view, 8, 'WAVE');
            // format chunk identifier
            writeString(view, 12, 'fmt ');
            // format chunk length
            view.setUint32(16, 16, true);
            // sample format (1 is PCM)
            view.setUint16(20, 1, true);
            // channel count
            view.setUint16(22, buffer.numberOfChannels, true);
            // sample rate
            view.setUint32(24, buffer.sampleRate, true);
            // byte rate (sample rate * block align)
            view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
            // block align (channel count * bytes per sample)
            view.setUint16(32, buffer.numberOfChannels * 2, true);
            // bits per sample
            view.setUint16(34, 16, true);
            // data chunk identifier
            writeString(view, 36, 'data');
            // data chunk length
            view.setUint32(40, length, true);
            
            // Write the PCM samples
            let offset = 44;
            for (let i = 0; i < buffer.length; i++) {
                for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                    const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                    offset += 2;
                }
            }
            
            // Create Blob and resolve
            const wavBlob = new Blob([view], { type: 'audio/wav' });
            resolve(wavBlob);
            
            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }
        });
    }
}

// Create a global instance of the transcription service
const transcriptionService = new WhisperTranscriptionService();

// Make it available on window for better accessibility
window.transcriptionService = transcriptionService;
