class ChatService {
    constructor() {
        this.apiKey = null;
        this.messages = [];
        this.conversationMode = false;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    addMessage(role, content) {
        this.messages.push({
            role,
            content
        });
    }

    clearMessages() {
        this.messages = [];
    }

    // Enable or disable the conversational questioning mode
    setConversationMode(enabled) {
        this.conversationMode = enabled;
        
        // If enabling conversation mode and no system message exists, add the instruction
        if (enabled && !this.messages.some(m => m.role === 'system')) {
            this.messages.unshift({
                role: 'system',
                content: `You are an engaged, thoughtful conversation partner who listens carefully.
                When responding to the user, demonstrate genuine understanding of their message and show authentic interest.
                After briefly acknowledging what they've shared, focus on asking ONE specific, insightful question about some aspect of what they've mentioned.
                Your question should:
                - Be specific rather than generic
                - Show you've really thought about what they shared
                - Explore an interesting angle they might not have considered
                - Feel natural, like what an interested friend might ask
                - Not be condescending or overly formal
                
                Your tone should be conversational and genuine. Include a small amount of your own thoughts or perspectives to create a natural flow,
                but primarily focus on drawing out more from the user through your thoughtful question.
                
                If the user's input was transcribed from audio, respond as if you're having a natural back-and-forth conversation.`
            });
        }
    }

    async sendMessage(content, options = {}) {
        if (!this.apiKey) {
            throw new Error('API key not set for Chat service');
        }

        this.addMessage('user', content);
        
        // Prepare messages for this request
        const messages = [...this.messages];
        
        // Check if we should use conversation mode
        const useConversationalMode = options.conversationalResponse || this.conversationMode;
        
        if (useConversationalMode) {
            // Add specific instruction for this message to ensure a conversational response with a question
            messages.push({
                role: 'system',
                content: `Respond to the user's message in a conversational, engaged manner. 
                First, briefly acknowledge what they shared, adding a small amount of your own perspective.
                Then ask ONE specific, thoughtful question about something interesting from their message.
                Your response should be natural and fluid, like two people in conversation.
                Don't be robotic or overly formal - speak like a real person who's genuinely interested.`
            });
        }
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: messages,
                    max_tokens: 500
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Chat API error: ${error.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            
            // Add the actual AI response to the conversation history
            this.addMessage('assistant', aiResponse);
            
            // Format the response if needed
            return useConversationalMode ? this.formatResponse(aiResponse) : aiResponse;
        } catch (error) {
            console.error('Error sending message to chat API:', error);
            throw error;
        }
    }
    
    // Format the AI's response for better presentation
    formatResponse(response) {
        // This method can be expanded based on specific formatting needs
        // For now, just ensure it's clean and presentable
        return response.trim();
    }

    // Enable audio transcription capabilities
    async transcribeAudio(audioFile) {
        if (!this.apiKey) {
            throw new Error('API key not set for Chat service');
        }

        const formData = new FormData();
        formData.append('file', audioFile);
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
                throw new Error(`Audio transcription error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.text;
        } catch (error) {
            console.error('Error transcribing audio:', error);
            throw error;
        }
    }

    // Process WhatsApp audio files
    async processWhatsAppAudio(audioFile) {
        // WhatsApp audio files are typically in OGG/Opus format
        // We can transcribe them directly using the Whisper API
        return await this.transcribeAudio(audioFile);
    }

    // Import audio from computer or WhatsApp and add to conversation
    async importAudio(audioFile, isWhatsApp = false) {
        try {
            // Display a message indicating that audio is being processed
            const processingMessage = 'Processing audio file...';
            this.addMessage('system', processingMessage);
            
            // Get the transcription
            const transcription = isWhatsApp 
                ? await this.processWhatsAppAudio(audioFile)
                : await this.transcribeAudio(audioFile);
            
            // Remove the processing message
            this.messages = this.messages.filter(msg => msg.content !== processingMessage);
            
            // Add the transcription as a user message (but without prefix)
            this.addMessage('user', transcription);
            
            return transcription;
        } catch (error) {
            console.error('Error importing audio:', error);
            throw error;
        }
    }

    // Process audio and get AI response in one step
    async processAudioAndRespond(audioFile, isWhatsApp = false) {
        const transcription = await this.importAudio(audioFile, isWhatsApp);
        console.log("Got transcription, about to process with AI:", transcription);
        
        // Always use conversational mode for audio responses
        return await this.sendMessage(transcription, { conversationalResponse: true });
    }
}

// Create a global instance of the chat service
const chatService = new ChatService();
