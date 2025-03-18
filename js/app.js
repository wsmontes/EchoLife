// Initialize the chat service with an API key
function initializeChatService() {
    // Try to get API key from localStorage first
    const savedApiKey = localStorage.getItem('openai_api_key');
    
    if (savedApiKey) {
        console.log('API key found in localStorage');
        chatService.setApiKey(savedApiKey);
    } else {
        // If no saved API key, prompt the user
        const apiKey = prompt('Please enter your OpenAI API key:');
        if (apiKey) {
            console.log('New API key provided');
            chatService.setApiKey(apiKey);
            // Save for future use
            localStorage.setItem('openai_api_key', apiKey);
        } else {
            console.error('No API key provided!');
            alert('An OpenAI API key is required to use this application.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application...');
    initializeChatService();
    
    // Remove test for upload buttons since they've been removed
    console.log('Audio interface initialized');

    // DOM elements
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const chatContainer = document.getElementById('chatContainer');
    
    // State variables
    let apiKey = localStorage.getItem('openai_api_key');
    let isProcessingAudio = false;
    
    // Initialize with API key
    if (!apiKey) {
        promptForApiKey();
    } else {
        initializeWithApiKey(apiKey);
    }
    
    // Event listeners - Only keep the recording button event
    recordButton.addEventListener('click', toggleRecording);
    
    // Functions
    function promptForApiKey() {
        const key = prompt('Please enter your OpenAI API key:');
        if (key) {
            localStorage.setItem('openai_api_key', key);
            initializeWithApiKey(key);
        } else {
            alert('API key is required to use this application.');
        }
    }
    
    function initializeWithApiKey(key) {
        transcriptionService.setApiKey(key);
        chatService.setApiKey(key);
        
        // Enable conversational mode by default for more engaging responses
        chatService.setConversationMode(true);
    }
    
    async function toggleRecording() {
        if (isProcessingAudio) return;
        
        if (!audioRecorder.isRecording) {
            const started = await audioRecorder.startRecording();
            if (started) {
                recordButton.classList.add('recording');
                recordingStatus.textContent = 'Recording... Click to stop';
                recordingIndicator.classList.remove('hidden');
            } else {
                alert('Could not access microphone. Please check permissions.');
            }
        } else {
            isProcessingAudio = true;
            recordButton.classList.remove('recording');
            recordingIndicator.classList.add('hidden');
            
            // Show processing state
            recordingStatus.textContent = 'Processing...';
            recordButton.disabled = true;
            recordButton.classList.add('processing');
            
            const audioBlob = await audioRecorder.stopRecording();
            
            if (audioBlob) {
                try {
                    // Get the transcript
                    const transcript = await transcriptionService.transcribeAudio(audioBlob);
                    
                    // Add it to the chat as a user message
                    addMessageToChat('user', transcript);
                    
                    // Send directly to AI
                    const response = await chatService.sendMessage(transcript, { conversationalResponse: true });
                    addMessageToChat('assistant', response);
                    
                    // Add to audio history if we have audioHandler instance
                    if (window.audioHandler) {
                        window.audioHandler.addToAudioHistory(
                            new File([audioBlob], "recording.webm", { type: "audio/webm" }), 
                            response
                        );
                    }
                } catch (error) {
                    console.error('Error processing audio:', error);
                    alert('Error: ' + error.message);
                } finally {
                    // Reset the recording UI
                    recordingStatus.textContent = 'Click to start recording';
                    recordButton.disabled = false;
                    recordButton.classList.remove('processing');
                    isProcessingAudio = false;
                }
            } else {
                recordingStatus.textContent = 'No audio recorded. Try again.';
                recordButton.disabled = false;
                recordButton.classList.remove('processing');
                isProcessingAudio = false;
            }
        }
    }
    
    function addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);
        messageDiv.textContent = content;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to bottom
    }
    
    // Make this function available globally so audio-handler.js can use it
    window.addMessageToChat = addMessageToChat;
});
