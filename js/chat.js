class ChatService {
    constructor() {
        this.apiKey = null;
        this.messages = [];
        this.conversationMode = false;
        this.language = localStorage.getItem('echolife_language') || 'en-US';
        
        // Listen for language/translation changes
        window.addEventListener('translationSettingsChanged', (e) => {
            this.language = e.detail.language;
            console.log(`Chat service updated with language: ${this.language}, translation: ${e.detail.translateEnabled}`);
        });
    }

    setApiKey(key) {
        this.apiKey = key;
    }
    
    setLanguage(language) {
        this.language = language;
        console.log(`Chat service language set to: ${language}`);
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
            const isPortuguese = this.language === 'pt-BR';
            
            this.messages.unshift({
                role: 'system',
                content: isPortuguese ? 
                `Você é um parceiro de conversa atencioso e reflexivo que ouve cuidadosamente.
                Ao responder ao usuário, demonstre compreensão genuína da mensagem dele e mostre interesse autêntico.
                Após reconhecer brevemente o que foi compartilhado, concentre-se em fazer UMA pergunta específica e perspicaz sobre algum aspecto do que foi mencionado.
                Sua pergunta deve:
                - Ser específica em vez de genérica
                - Mostrar que você realmente pensou sobre o que foi compartilhado
                - Explorar um ângulo interessante que eles podem não ter considerado
                - Soar natural, como o que um amigo interessado perguntaria
                - Não ser condescendente ou excessivamente formal
                
                Seu tom deve ser conversacional e genuíno. Inclua uma pequena quantidade de seus próprios pensamentos ou perspectivas para criar um fluxo natural,
                mas concentre-se principalmente em extrair mais do usuário através de sua pergunta cuidadosa.
                
                Se a entrada do usuário foi transcrita de áudio, responda como se estivesse tendo uma conversa natural de ida e volta.` :
                
                `You are an engaged, thoughtful conversation partner who listens carefully.
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

        // Get translation settings
        const translationSettings = window.translationController ? 
            window.translationController.getSettings() : 
            { language: this.language, translateEnabled: false };
        
        // Get preferred language and translation settings
        const language = options.language || this.language || 'en-US';
        const isPortuguese = language === 'pt-BR';
        const translateEnabled = translationSettings.translateEnabled;
        const targetLanguage = translationSettings.targetLanguage;
        
        console.log(`Sending message with language: ${language}, translation: ${translateEnabled ? 'enabled' : 'disabled'}`);
        
        // Add user message to history
        this.addMessage('user', content);
        
        // Prepare messages for this request
        const messages = [...this.messages];
        
        // Check if we should use conversation mode
        const useConversationalMode = options.conversationalResponse || this.conversationMode;
        
        if (useConversationalMode) {
            // Add language-specific conversation instruction
            messages.push({
                role: 'system',
                content: isPortuguese ?
                `Responda à mensagem do usuário de maneira conversacional e engajada. 
                Primeiro, reconheça brevemente o que ele compartilhou, adicionando uma pequena quantidade de sua própria perspectiva.
                Em seguida, faça UMA pergunta específica e reflexiva sobre algo interessante da mensagem dele.
                Sua resposta deve ser natural e fluida, como duas pessoas em conversa.
                Não seja robótico ou excessivamente formal - fale como uma pessoa real que está genuinamente interessada.` :
                
                `Respond to the user's message in a conversational, engaged manner. 
                First, briefly acknowledge what they shared, adding a small amount of your own perspective.
                Then ask ONE specific, thoughtful question about something interesting from their message.
                Your response should be natural and fluid, like two people in conversation.
                Don't be robotic or overly formal - speak like a real person who's genuinely interested.`
            });
        }
        
        // If translation is enabled, add translation instruction
        if (translateEnabled) {
            const outputLanguage = targetLanguage === 'pt-BR' ? 'Portuguese (Brazilian)' : 'English';
            
            messages.push({
                role: 'system',
                content: `Please respond in ${outputLanguage} regardless of the language of the user's message.`
            });
            
            console.log(`Added translation instruction to respond in: ${outputLanguage}`);
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
