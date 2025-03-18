class WhisperTranscriptionService {
    constructor() {
        this.apiKey = null;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    async transcribeAudio(audioBlob) {
        if (!this.apiKey) {
            throw new Error('API key not set for Whisper transcription service');
        }

        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('model', 'whisper-1');
        
        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Transcription API error: ${error.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            return data.text;
        } catch (error) {
            console.error('Error transcribing audio:', error);
            throw error;
        }
    }
}

// Create a global instance of the transcription service
const transcriptionService = new WhisperTranscriptionService();
