class ChatService {
    constructor() {
        this.apiKey = null;
        this.messages = [];
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

    async sendMessage(content) {
        if (!this.apiKey) {
            throw new Error('API key not set for Chat service');
        }

        this.addMessage('user', content);
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: this.messages,
                    max_tokens: 500
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Chat API error: ${error.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            
            this.addMessage('assistant', aiResponse);
            return aiResponse;
        } catch (error) {
            console.error('Error sending message to chat API:', error);
            throw error;
        }
    }
}

// Create a global instance of the chat service
const chatService = new ChatService();
