document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const transcriptBox = document.getElementById('transcriptBox');
    const chatContainer = document.getElementById('chatContainer');
    const submitButton = document.getElementById('submitButton');
    
    // State variables
    let apiKey = localStorage.getItem('openai_api_key');
    
    // Initialize with API key
    if (!apiKey) {
        promptForApiKey();
    } else {
        initializeWithApiKey(apiKey);
    }
    
    // Event listeners
    recordButton.addEventListener('click', toggleRecording);
    submitButton.addEventListener('click', submitToAI);
    transcriptBox.addEventListener('input', () => {
        submitButton.disabled = transcriptBox.textContent.trim() === '';
    });
    
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
    }
    
    async function toggleRecording() {
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
            recordingStatus.textContent = 'Processing...';
            const audioBlob = await audioRecorder.stopRecording();
            
            recordButton.classList.remove('recording');
            recordingIndicator.classList.add('hidden');
            
            if (audioBlob) {
                try {
                    const transcript = await transcriptionService.transcribeAudio(audioBlob);
                    transcriptBox.textContent = transcript;
                    recordingStatus.textContent = 'Click to start recording';
                    submitButton.disabled = false;
                } catch (error) {
                    recordingStatus.textContent = 'Error transcribing. Try again.';
                    console.error(error);
                }
            } else {
                recordingStatus.textContent = 'No audio recorded. Try again.';
            }
        }
    }
    
    async function submitToAI() {
        const text = transcriptBox.textContent.trim();
        if (!text) return;
        
        // Add user message to chat
        addMessageToChat('user', text);
        
        // Disable submit button while processing
        submitButton.disabled = true;
        
        try {
            const response = await chatService.sendMessage(text);
            addMessageToChat('assistant', response);
        } catch (error) {
            alert('Error communicating with AI: ' + error.message);
        } finally {
            submitButton.disabled = false;
        }
    }
    
    function addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);
        messageDiv.textContent = content;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to bottom
    }
});
